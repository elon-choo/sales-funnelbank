-- ============================================
-- 005_rate_limits.sql
-- Rate Limiting 테이블 및 함수
-- ============================================

CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,       -- IP 또는 user_id
    endpoint TEXT NOT NULL,         -- API 엔드포인트
    request_count INTEGER NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 복합 유니크 키 (윈도우별 단일 레코드)
    CONSTRAINT unique_rate_limit UNIQUE (identifier, endpoint, window_start)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits(identifier, endpoint, window_start DESC);
-- 정리용 인덱스
CREATE INDEX IF NOT EXISTS idx_rate_limits_cleanup
    ON rate_limits(window_start);

-- RLS 활성화 (서버 사이드 전용)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Rate Limit 체크 함수 (Fail-Closed)
-- v2.0: 에러 발생 시 차단 (Fail-Closed)
-- ============================================

CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_endpoint TEXT,
    p_limit INTEGER,
    p_window_seconds INTEGER
)
RETURNS JSONB AS $$
DECLARE
    v_window_start TIMESTAMPTZ;
    v_current_count INTEGER;
    v_result JSONB;
BEGIN
    -- 윈도우 시작 시간 계산 (슬라이딩 윈도우)
    v_window_start := DATE_TRUNC('second', NOW())
        - ((EXTRACT(EPOCH FROM NOW())::BIGINT % p_window_seconds) * INTERVAL '1 second');

    -- 현재 카운트 조회 및 증가 (UPSERT)
    INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
    VALUES (p_identifier, p_endpoint, 1, v_window_start)
    ON CONFLICT (identifier, endpoint, window_start)
    DO UPDATE SET request_count = rate_limits.request_count + 1
    RETURNING request_count INTO v_current_count;

    -- 제한 초과 확인
    IF v_current_count > p_limit THEN
        v_result := jsonb_build_object(
            'allowed', FALSE,
            'current', v_current_count,
            'limit', p_limit,
            'reset_at', v_window_start + (p_window_seconds * INTERVAL '1 second'),
            'retry_after', EXTRACT(EPOCH FROM (v_window_start + (p_window_seconds * INTERVAL '1 second') - NOW()))::INTEGER
        );
    ELSE
        v_result := jsonb_build_object(
            'allowed', TRUE,
            'current', v_current_count,
            'limit', p_limit,
            'remaining', p_limit - v_current_count
        );
    END IF;

    RETURN v_result;

EXCEPTION WHEN OTHERS THEN
    -- v2.0 Fail-Closed: 에러 발생 시 차단
    RETURN jsonb_build_object(
        'allowed', FALSE,
        'error', TRUE,
        'message', 'Rate limit check failed',
        'retry_after', 60
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 오래된 Rate Limit 정리 함수
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM rate_limits
    WHERE window_start < NOW() - INTERVAL '1 hour';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
