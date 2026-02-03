-- ============================================
-- 002_soft_delete.sql
-- Soft Delete 컬럼 추가
-- ============================================

-- profiles에 deleted_at 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- 부분 인덱스: 삭제되지 않은 레코드만
CREATE INDEX IF NOT EXISTS idx_profiles_active
    ON profiles(id) WHERE deleted_at IS NULL;

-- landing_pages에 deleted_at 추가
ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
-- 복합 인덱스: 사용자별 활성 랜딩페이지
CREATE INDEX IF NOT EXISTS idx_landing_pages_user_active
    ON landing_pages(user_id, created_at DESC) WHERE deleted_at IS NULL;
-- 복합 인덱스: 삭제된 랜딩페이지 (30일 이내)
CREATE INDEX IF NOT EXISTS idx_landing_pages_deleted_recovery
    ON landing_pages(user_id, deleted_at)
    WHERE deleted_at IS NOT NULL;

-- qa_sessions에 deleted_at 추가
ALTER TABLE qa_sessions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_qa_sessions_active
    ON qa_sessions(user_id) WHERE deleted_at IS NULL;
