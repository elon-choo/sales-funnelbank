-- ============================================
-- 007_functions_triggers.sql
-- 함수 및 트리거
-- v2.0: approval_changed_at 추가
-- ============================================

-- profiles에 approval_changed_at 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS approval_changed_at TIMESTAMPTZ;

-- ============================================
-- 승인 상태 변경 시 세션 무효화 트리거
-- v2.0: approval_changed_at 자동 업데이트
-- ============================================

CREATE OR REPLACE FUNCTION invalidate_user_sessions()
RETURNS TRIGGER AS $$
BEGIN
    -- is_approved가 변경된 경우
    IF OLD.is_approved IS DISTINCT FROM NEW.is_approved THEN
        -- approval_changed_at 업데이트
        NEW.approval_changed_at := NOW();

        -- 모든 Refresh Token 폐기
        UPDATE refresh_tokens
        SET revoked = TRUE, revoked_at = NOW()
        WHERE user_id = NEW.id AND revoked = FALSE;

        -- 세션 무효화
        UPDATE user_sessions
        SET invalidated_at = NOW()
        WHERE user_id = NEW.id AND invalidated_at IS NULL;

        -- 감사 로그
        INSERT INTO audit_logs (user_id, action, severity, details)
        VALUES (
            NEW.id,
            'sessions_invalidated',
            CASE WHEN NEW.is_approved THEN 'info' ELSE 'warning' END,
            jsonb_build_object(
                'reason', 'approval_status_changed',
                'old_status', OLD.is_approved,
                'new_status', NEW.is_approved,
                'changed_by', current_user
            )
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성
DROP TRIGGER IF EXISTS on_approval_change ON profiles;
CREATE TRIGGER on_approval_change
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION invalidate_user_sessions();

-- ============================================
-- 사용자 토큰 사용량 조회 함수
-- ============================================

CREATE OR REPLACE FUNCTION get_user_token_usage(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_tier TEXT;
    v_daily_limit INTEGER;
    v_used_today INTEGER;
    v_reserved INTEGER;
    v_today_start TIMESTAMPTZ;
    v_today_end TIMESTAMPTZ;
BEGIN
    -- 타임존 고려한 오늘 범위
    v_today_start := DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Seoul');
    v_today_end := v_today_start + INTERVAL '1 day';

    -- 사용자 티어 확인
    SELECT tier INTO v_tier
    FROM profiles
    WHERE id = p_user_id AND deleted_at IS NULL;

    IF v_tier IS NULL THEN
        RETURN jsonb_build_object('error', 'user_not_found');
    END IF;

    -- 티어별 일일 한도
    v_daily_limit := CASE v_tier
        WHEN 'FREE' THEN 100000
        WHEN 'PRO' THEN 500000
        WHEN 'ENTERPRISE' THEN 2000000
        ELSE 100000
    END;

    -- 오늘 사용량
    SELECT COALESCE(SUM(tokens_used), 0) INTO v_used_today
    FROM token_usage
    WHERE user_id = p_user_id
        AND created_at >= v_today_start
        AND created_at < v_today_end;

    -- 대기 중인 예약량
    SELECT COALESCE(SUM(estimated_tokens), 0) INTO v_reserved
    FROM token_reservations
    WHERE user_id = p_user_id
        AND status = 'reserved'
        AND created_at > NOW() - INTERVAL '10 minutes';

    RETURN jsonb_build_object(
        'tier', v_tier,
        'daily_limit', v_daily_limit,
        'used_today', v_used_today,
        'reserved', v_reserved,
        'available', GREATEST(v_daily_limit - v_used_today - v_reserved, 0),
        'usage_percentage', ROUND((v_used_today::NUMERIC / v_daily_limit) * 100, 2),
        'reset_at', v_today_end AT TIME ZONE 'Asia/Seoul'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 정리 함수들
-- ============================================

-- 오래된 감사 로그 정리 (90일)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- CRITICAL 레벨은 삭제하지 않음
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
        AND severity != 'critical';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 30일 초과 삭제 데이터 영구 삭제
CREATE OR REPLACE FUNCTION permanently_delete_expired_data()
RETURNS JSONB AS $$
DECLARE
    v_profiles INTEGER := 0;
    v_landing_pages INTEGER := 0;
    v_qa_sessions INTEGER := 0;
BEGIN
    -- 30일 초과 삭제된 qa_sessions 먼저 삭제 (FK)
    DELETE FROM qa_sessions
    WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_qa_sessions = ROW_COUNT;

    -- 30일 초과 삭제된 landing_pages 삭제
    DELETE FROM landing_pages
    WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_landing_pages = ROW_COUNT;

    -- 30일 초과 삭제된 profiles 삭제
    DELETE FROM profiles
    WHERE deleted_at IS NOT NULL
        AND deleted_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_profiles = ROW_COUNT;

    RETURN jsonb_build_object(
        'profiles_deleted', v_profiles,
        'landing_pages_deleted', v_landing_pages,
        'qa_sessions_deleted', v_qa_sessions,
        'executed_at', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- 오래된 세션 정리 (30일)
CREATE OR REPLACE FUNCTION cleanup_old_sessions()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM user_sessions
    WHERE created_at < NOW() - INTERVAL '30 days';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 폐기된 리프레시 토큰 정리 (7일 이상 지난 것)
CREATE OR REPLACE FUNCTION cleanup_revoked_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens
    WHERE revoked = TRUE
        AND revoked_at < NOW() - INTERVAL '7 days';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;
