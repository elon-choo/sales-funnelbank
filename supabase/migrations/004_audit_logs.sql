-- ============================================
-- 004_audit_logs.sql
-- 감사 로그 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    severity TEXT DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),  -- v2.0 추가
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);  -- v2.0 추가
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
-- 보안 이벤트 빠른 조회
CREATE INDEX IF NOT EXISTS idx_audit_logs_security
    ON audit_logs(created_at DESC)
    WHERE severity IN ('error', 'critical');

-- RLS 활성화
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- security_events 테이블 (v2.0 신규)
-- 보안 이벤트 전용 테이블 (빠른 조회용)
-- ============================================

CREATE TABLE IF NOT EXISTS security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL CHECK (event_type IN (
        'token_reuse',
        'rate_limit_exceeded',
        'cors_blocked',
        'prompt_injection_detected',
        'brute_force_attempt',
        'suspicious_activity'
    )),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    ip_address INET,
    details JSONB NOT NULL DEFAULT '{}',
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_unresolved
    ON security_events(created_at DESC) WHERE resolved = FALSE;

-- RLS 활성화
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- 감사 대상 액션 정의 (COMMENT)
COMMENT ON TABLE audit_logs IS '
감사 대상 액션:
- signup: 회원가입
- login: 로그인
- login_failed: 로그인 실패
- logout: 로그아웃
- password_change: 비밀번호 변경
- profile_update: 프로필 수정
- approval_change: 승인 상태 변경
- sessions_invalidated: 세션 무효화
- token_reuse_detected: 토큰 재사용 감지 (CRITICAL)
- landing_page_created: LP 생성
- landing_page_updated: LP 수정
- landing_page_deleted: LP 삭제 (soft)
- landing_page_restored: LP 복구
- landing_page_permanently_deleted: LP 영구 삭제
- ai_generation: AI 생성 요청
- ai_generation_failed: AI 생성 실패
- rate_limit_exceeded: Rate Limit 초과
- cors_blocked: CORS 차단
- prompt_injection_blocked: Prompt Injection 차단
- error: 일반 에러
';
