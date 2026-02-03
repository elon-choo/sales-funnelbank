-- ============================================
-- 006_token_reservations.sql
-- 토큰 예약 테이블 및 함수
-- v2.0: Advisory Lock hashtext() 수정
-- ============================================

CREATE TABLE IF NOT EXISTS token_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    estimated_tokens INTEGER NOT NULL CHECK (estimated_tokens > 0),
    actual_tokens INTEGER,
    status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'confirmed', 'cancelled', 'expired')),
    error_reason TEXT,  -- v2.0 추가: 실패 사유
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_token_reservations_user_id ON token_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_token_reservations_status ON token_reservations(status);
-- 대기 중인 예약 조회 최적화
CREATE INDEX IF NOT EXISTS idx_token_reservations_user_pending
    ON token_reservations(user_id, created_at DESC)
    WHERE status = 'reserved';

-- RLS 활성화
ALTER TABLE token_reservations ENABLE ROW LEVEL SECURITY;

-- token_usage에 reservation_id 추가 (v2.0)
ALTER TABLE token_usage
ADD COLUMN IF NOT EXISTS reservation_id UUID REFERENCES token_reservations(id);

-- ============================================
-- 토큰 예약 함수 (Advisory Lock 수정됨)
-- v2.0: hashtext() 대신 hash_numeric 사용
-- ============================================

-- 안전한 해시 함수 (bigint 반환)
CREATE OR REPLACE FUNCTION safe_user_hash(p_user_id UUID)
RETURNS BIGINT AS $$
BEGIN
    -- UUID를 안정적인 bigint로 변환
    -- 충돌 확률 최소화를 위해 상위/하위 비트 조합
    RETURN (
        ('x' || substr(p_user_id::TEXT, 1, 8))::BIT(32)::BIGINT << 32
    ) | (
        ('x' || substr(p_user_id::TEXT, 10, 8))::BIT(32)::BIGINT
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION check_and_reserve_tokens(
    p_user_id UUID,
    p_estimated_tokens INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_tier TEXT;
    v_daily_limit INTEGER;
    v_used_today INTEGER;
    v_reserved_pending INTEGER;
    v_available INTEGER;
    v_reservation_id UUID;
    v_lock_key BIGINT;
BEGIN
    -- v2.0: 안전한 락 키 생성
    v_lock_key := safe_user_hash(p_user_id);

    -- Advisory Lock 획득 (트랜잭션 범위)
    PERFORM pg_advisory_xact_lock(v_lock_key);

    -- 사용자 티어 확인
    SELECT tier INTO v_tier
    FROM profiles
    WHERE id = p_user_id AND deleted_at IS NULL;

    IF v_tier IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'user_not_found'
        );
    END IF;

    -- 티어별 일일 한도
    v_daily_limit := CASE v_tier
        WHEN 'FREE' THEN 100000
        WHEN 'PRO' THEN 500000
        WHEN 'ENTERPRISE' THEN 2000000
        ELSE 100000
    END;

    -- 오늘 사용량 조회 (타임존 고려)
    SELECT COALESCE(SUM(tokens_used), 0) INTO v_used_today
    FROM token_usage
    WHERE user_id = p_user_id
      AND created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Seoul')
      AND created_at < DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Seoul') + INTERVAL '1 day';

    -- 대기 중인 예약량 조회 (10분 이내)
    SELECT COALESCE(SUM(estimated_tokens), 0) INTO v_reserved_pending
    FROM token_reservations
    WHERE user_id = p_user_id
      AND status = 'reserved'
      AND created_at > NOW() - INTERVAL '10 minutes';

    -- 사용 가능 토큰 계산
    v_available := v_daily_limit - v_used_today - v_reserved_pending;

    IF v_available < p_estimated_tokens THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'insufficient_tokens',
            'available', GREATEST(v_available, 0),
            'requested', p_estimated_tokens,
            'daily_limit', v_daily_limit,
            'used_today', v_used_today,
            'reserved', v_reserved_pending,
            'reset_at', (DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Seoul') + INTERVAL '1 day') AT TIME ZONE 'Asia/Seoul'
        );
    END IF;

    -- 예약 생성
    INSERT INTO token_reservations (user_id, estimated_tokens, status)
    VALUES (p_user_id, p_estimated_tokens, 'reserved')
    RETURNING id INTO v_reservation_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'reservation_id', v_reservation_id,
        'available_after', v_available - p_estimated_tokens,
        'daily_limit', v_daily_limit,
        'expires_at', NOW() + INTERVAL '10 minutes'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 토큰 확정 함수
-- v2.0: token_usage에 reservation_id 연결
-- ============================================

CREATE OR REPLACE FUNCTION confirm_token_usage(
    p_reservation_id UUID,
    p_actual_tokens INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_reservation RECORD;
BEGIN
    -- 예약 조회 및 업데이트
    UPDATE token_reservations
    SET
        status = 'confirmed',
        actual_tokens = p_actual_tokens,
        confirmed_at = NOW()
    WHERE id = p_reservation_id AND status = 'reserved'
    RETURNING * INTO v_reservation;

    IF v_reservation IS NULL THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'reservation_not_found_or_already_processed'
        );
    END IF;

    -- token_usage에 실제 사용량 기록 (reservation_id 연결)
    INSERT INTO token_usage (user_id, tokens_used, action, reservation_id, metadata)
    VALUES (
        v_reservation.user_id,
        p_actual_tokens,
        'generate',
        p_reservation_id,
        jsonb_build_object(
            'estimated', v_reservation.estimated_tokens,
            'difference', v_reservation.estimated_tokens - p_actual_tokens
        )
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'estimated', v_reservation.estimated_tokens,
        'actual', p_actual_tokens,
        'difference', v_reservation.estimated_tokens - p_actual_tokens,
        'refunded', GREATEST(v_reservation.estimated_tokens - p_actual_tokens, 0)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 토큰 예약 취소 함수
-- ============================================

CREATE OR REPLACE FUNCTION cancel_token_reservation(
    p_reservation_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_updated INTEGER;
BEGIN
    UPDATE token_reservations
    SET
        status = 'cancelled',
        error_reason = p_reason
    WHERE id = p_reservation_id AND status = 'reserved';

    GET DIAGNOSTICS v_updated = ROW_COUNT;

    IF v_updated = 0 THEN
        RETURN jsonb_build_object(
            'success', FALSE,
            'error', 'reservation_not_found_or_already_processed'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'message', 'Reservation cancelled'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 만료된 예약 정리 함수
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_reservations()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE token_reservations
    SET
        status = 'expired',
        error_reason = 'Reservation expired after 10 minutes'
    WHERE status = 'reserved'
      AND created_at < NOW() - INTERVAL '10 minutes';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
