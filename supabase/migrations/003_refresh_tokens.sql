-- ============================================
-- 003_refresh_tokens.sql
-- Refresh Token 관리 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    revoked BOOLEAN NOT NULL DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- 유니크 제약 (해시 충돌 방지)
    CONSTRAINT unique_token_hash UNIQUE (token_hash)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
-- 활성 토큰 조회 최적화
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
    ON refresh_tokens(user_id) WHERE revoked = FALSE;

-- RLS 활성화 (서버 사이드 전용 - 정책 없음)
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- user_sessions 테이블
-- ============================================

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    ip_address INET,
    user_agent TEXT,
    device_info JSONB DEFAULT '{}',  -- v2.0 추가
    invalidated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
-- 활성 세션 조회 최적화
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_active
    ON user_sessions(user_id, created_at DESC)
    WHERE invalidated_at IS NULL;

-- RLS 활성화
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
