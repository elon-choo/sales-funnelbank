-- ============================================
-- 009_schema_fixes.sql
-- v2.0 스키마 수정 및 추가 인덱스
-- ============================================

-- ============================================
-- 복합 인덱스 최적화
-- ============================================

-- 사용자별 오늘 토큰 사용량 (최빈 쿼리)
DROP INDEX IF EXISTS idx_token_usage_user_date;
CREATE INDEX idx_token_usage_daily ON token_usage (
    user_id,
    created_at DESC
);

-- 활성 예약 조회 최적화
CREATE INDEX IF NOT EXISTS idx_token_reservations_active
    ON token_reservations(user_id, created_at DESC)
    WHERE status = 'reserved';

-- ============================================
-- 데이터 정합성 체크 함수
-- ============================================

CREATE OR REPLACE FUNCTION check_data_consistency()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details JSONB
) AS $$
BEGIN
    -- 1. 프로필 없는 Auth 사용자 체크
    RETURN QUERY
    SELECT
        'orphan_auth_users'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'WARNING' END,
        jsonb_build_object('count', COUNT(*))
    FROM auth.users u
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id);

    -- 2. 만료된 예약 체크
    RETURN QUERY
    SELECT
        'expired_reservations'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'NEEDS_CLEANUP' END,
        jsonb_build_object('count', COUNT(*))
    FROM token_reservations
    WHERE status = 'reserved'
        AND created_at < NOW() - INTERVAL '10 minutes';

    -- 3. 30일 초과 삭제 데이터 체크
    RETURN QUERY
    SELECT
        'expired_soft_deletes'::TEXT,
        'INFO',
        jsonb_build_object(
            'profiles', (SELECT COUNT(*) FROM profiles WHERE deleted_at < NOW() - INTERVAL '30 days'),
            'landing_pages', (SELECT COUNT(*) FROM landing_pages WHERE deleted_at < NOW() - INTERVAL '30 days'),
            'qa_sessions', (SELECT COUNT(*) FROM qa_sessions WHERE deleted_at < NOW() - INTERVAL '30 days')
        );

    -- 4. 폐기된 리프레시 토큰 체크
    RETURN QUERY
    SELECT
        'old_revoked_tokens'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'OK' ELSE 'NEEDS_CLEANUP' END,
        jsonb_build_object('count', COUNT(*))
    FROM refresh_tokens
    WHERE revoked = TRUE AND revoked_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 통계 함수
-- ============================================

CREATE OR REPLACE FUNCTION get_system_stats()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_users', (SELECT COUNT(*) FROM profiles WHERE deleted_at IS NULL),
        'approved_users', (SELECT COUNT(*) FROM profiles WHERE is_approved = TRUE AND deleted_at IS NULL),
        'pending_users', (SELECT COUNT(*) FROM profiles WHERE is_approved = FALSE AND deleted_at IS NULL),
        'total_landing_pages', (SELECT COUNT(*) FROM landing_pages WHERE deleted_at IS NULL),
        'published_landing_pages', (SELECT COUNT(*) FROM landing_pages WHERE status = 'published' AND deleted_at IS NULL),
        'active_sessions', (SELECT COUNT(*) FROM user_sessions WHERE invalidated_at IS NULL AND created_at > NOW() - INTERVAL '7 days'),
        'tokens_used_today', (
            SELECT COALESCE(SUM(tokens_used), 0)
            FROM token_usage
            WHERE created_at >= DATE_TRUNC('day', NOW() AT TIME ZONE 'Asia/Seoul')
        ),
        'security_events_today', (
            SELECT COUNT(*)
            FROM security_events
            WHERE created_at >= DATE_TRUNC('day', NOW())
        ),
        'generated_at', NOW()
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;
