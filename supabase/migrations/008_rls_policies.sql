-- ============================================
-- 008_rls_policies.sql
-- RLS 정책 통합 (v2.0)
-- 기존 OR 조합 정책 제거 후 단일 정책으로 재구성
-- ============================================

-- ============================================
-- profiles RLS 정책
-- ============================================

-- 기존 정책 모두 삭제
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update approval status" ON profiles;

-- 단일 SELECT 정책: 본인 OR 관리자
CREATE POLICY "profiles_select_policy" ON profiles
FOR SELECT USING (
    -- 본인 (삭제되지 않은 경우)
    (auth.uid() = id AND deleted_at IS NULL)
    OR
    -- 관리자 (모든 프로필 조회 가능)
    EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
            AND admin.tier = 'ENTERPRISE'
            AND admin.is_approved = TRUE
            AND admin.deleted_at IS NULL
    )
);

-- 단일 UPDATE 정책: 본인만
CREATE POLICY "profiles_update_policy" ON profiles
FOR UPDATE USING (
    auth.uid() = id AND deleted_at IS NULL
)
WITH CHECK (
    auth.uid() = id AND deleted_at IS NULL
);

-- 관리자 승인 상태 변경용 (Service Role에서만 사용)
-- 클라이언트는 이 정책으로 접근 불가

-- ============================================
-- landing_pages RLS 정책
-- ============================================

DROP POLICY IF EXISTS "Users can view own landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Users can view own active landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Users can view own deleted landing pages for recovery" ON landing_pages;
DROP POLICY IF EXISTS "Users can create landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Users can update own landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Users can update own active landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Users can soft delete own landing pages" ON landing_pages;
DROP POLICY IF EXISTS "Anyone can view published landing pages" ON landing_pages;

-- SELECT: 본인 활성 + 본인 삭제(30일내) + 발행됨
CREATE POLICY "landing_pages_select_policy" ON landing_pages
FOR SELECT USING (
    -- 본인 활성 랜딩페이지
    (user_id = auth.uid() AND deleted_at IS NULL)
    OR
    -- 본인 삭제된 랜딩페이지 (30일 이내, 복구용)
    (user_id = auth.uid() AND deleted_at IS NOT NULL AND deleted_at > NOW() - INTERVAL '30 days')
    OR
    -- 발행된 랜딩페이지 (공개)
    (status = 'published' AND deleted_at IS NULL)
);

-- INSERT: 본인만
CREATE POLICY "landing_pages_insert_policy" ON landing_pages
FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- UPDATE: 본인만 (삭제/복구 포함)
CREATE POLICY "landing_pages_update_policy" ON landing_pages
FOR UPDATE USING (
    user_id = auth.uid()
)
WITH CHECK (
    user_id = auth.uid()
);

-- DELETE: 사용 안 함 (Soft Delete만 사용)

-- ============================================
-- qa_sessions RLS 정책
-- ============================================

DROP POLICY IF EXISTS "Users can view own sessions" ON qa_sessions;
DROP POLICY IF EXISTS "Users can view own active sessions" ON qa_sessions;
DROP POLICY IF EXISTS "Users can create sessions" ON qa_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON qa_sessions;
DROP POLICY IF EXISTS "Users can update own active sessions" ON qa_sessions;

-- SELECT: 본인 활성
CREATE POLICY "qa_sessions_select_policy" ON qa_sessions
FOR SELECT USING (
    user_id = auth.uid() AND deleted_at IS NULL
);

-- INSERT: 본인만
CREATE POLICY "qa_sessions_insert_policy" ON qa_sessions
FOR INSERT WITH CHECK (
    user_id = auth.uid()
);

-- UPDATE: 본인만
CREATE POLICY "qa_sessions_update_policy" ON qa_sessions
FOR UPDATE USING (
    user_id = auth.uid() AND deleted_at IS NULL
)
WITH CHECK (
    user_id = auth.uid()
);

-- ============================================
-- token_usage RLS 정책
-- ============================================

DROP POLICY IF EXISTS "Users can view own token usage" ON token_usage;
DROP POLICY IF EXISTS "System can insert token usage" ON token_usage;

-- SELECT: 본인만
CREATE POLICY "token_usage_select_policy" ON token_usage
FOR SELECT USING (
    user_id = auth.uid()
);

-- INSERT: Service Role만 (함수 통해서만)

-- ============================================
-- token_reservations RLS 정책
-- ============================================

DROP POLICY IF EXISTS "Users can view own reservations" ON token_reservations;

-- SELECT: 본인만
CREATE POLICY "token_reservations_select_policy" ON token_reservations
FOR SELECT USING (
    user_id = auth.uid()
);

-- INSERT/UPDATE: Service Role만 (함수 통해서만)

-- ============================================
-- user_sessions RLS 정책
-- ============================================

DROP POLICY IF EXISTS "Users can view own sessions" ON user_sessions;

-- SELECT: 본인만 (활성 세션)
CREATE POLICY "user_sessions_select_policy" ON user_sessions
FOR SELECT USING (
    user_id = auth.uid() AND invalidated_at IS NULL
);

-- ============================================
-- audit_logs RLS 정책
-- ============================================

DROP POLICY IF EXISTS "Users can view own audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Admins can view all audit logs" ON audit_logs;

-- SELECT: 본인 OR 관리자
CREATE POLICY "audit_logs_select_policy" ON audit_logs
FOR SELECT USING (
    -- 본인 로그
    user_id = auth.uid()
    OR
    -- 관리자 (모든 로그)
    EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
            AND admin.tier = 'ENTERPRISE'
            AND admin.is_approved = TRUE
            AND admin.deleted_at IS NULL
    )
);

-- INSERT: Service Role만

-- ============================================
-- security_events RLS 정책
-- ============================================

-- 관리자만 조회 가능
CREATE POLICY "security_events_select_policy" ON security_events
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
            AND admin.tier = 'ENTERPRISE'
            AND admin.is_approved = TRUE
            AND admin.deleted_at IS NULL
    )
);

-- INSERT/UPDATE: Service Role만

-- ============================================
-- refresh_tokens, rate_limits
-- 클라이언트 직접 접근 불가 (Service Role만)
-- 정책 없음 = 접근 차단
-- ============================================
