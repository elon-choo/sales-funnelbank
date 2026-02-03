-- ============================================================
-- 010_lms_core_tables.sql
-- 세퍼마 LMS 핵심 테이블 생성
-- 날짜: 2026-02-03
-- PRD: T12_PRD_최종.md v2.0
-- 스키마 설계: T15_DB_스키마.sql
-- ============================================================
--
-- 구조:
--   1. profiles 테이블 확장 (lms_role 컬럼 추가)
--   2. 커스텀 함수 (current_user_id, is_lms_admin, set_user_context)
--   3. LMS 테이블 생성 (12개)
--   4. 인덱스
--   5. RLS 정책
--   6. DB 함수 (pick_next_feedback_jobs, recover_zombie_jobs 등)
--   7. 시드 데이터
-- ============================================================

BEGIN;

-- ============================================================
-- 1. profiles 테이블 확장
-- ============================================================

-- lms_role 컬럼 추가 (student | admin)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS lms_role TEXT DEFAULT 'student'
CHECK (lms_role IN ('student', 'admin'));

-- role 컬럼 추가 (기존 시스템 호환)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
CHECK (role IN ('user', 'admin'));

-- deleted_at 소프트 삭제 컬럼 추가
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_lms_role ON profiles(lms_role);


-- ============================================================
-- 2. 커스텀 함수 (RLS 보조 방어용)
-- ============================================================

-- 2.1 현재 사용자 ID 반환
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2.2 현재 사용자 티어 반환
CREATE OR REPLACE FUNCTION current_user_tier()
RETURNS TEXT AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_tier', true), '');
EXCEPTION
  WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2.3 LMS 관리자 판별 (ENTERPRISE 하위 호환 포함)
CREATE OR REPLACE FUNCTION is_lms_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    NULLIF(current_setting('app.current_user_lms_role', true), '') = 'admin'
    OR NULLIF(current_setting('app.current_user_tier', true), '') = 'ENTERPRISE'
  );
EXCEPTION
  WHEN OTHERS THEN RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 2.4 세션 변수 설정 (CTO-001: RLS 보조 방어용)
CREATE OR REPLACE FUNCTION set_user_context(
  p_user_id UUID,
  p_user_tier TEXT DEFAULT 'FREE',
  p_user_lms_role TEXT DEFAULT 'student'
)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', p_user_id::text, false);
  PERFORM set_config('app.current_user_tier', p_user_tier, false);
  PERFORM set_config('app.current_user_lms_role', p_user_lms_role, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2.5 세션 변수 초기화
CREATE OR REPLACE FUNCTION reset_user_context()
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_user_id', '', false);
  PERFORM set_config('app.current_user_tier', '', false);
  PERFORM set_config('app.current_user_lms_role', '', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 3. LMS 테이블 생성 (12개)
-- ============================================================

-- 3.1 기수 (courses)
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'active', 'completed')),
  total_weeks INTEGER NOT NULL DEFAULT 10,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- 3.2 주차 (course_weeks)
CREATE TABLE IF NOT EXISTS course_weeks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  week_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  assignment_type TEXT NOT NULL DEFAULT 'plan'
    CHECK (assignment_type IN ('plan', 'funnel', 'free')),
  deadline TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (course_id, week_number)
);

-- 3.3 주차별 과제 항목 구성 (week_assignment_configs)
CREATE TABLE IF NOT EXISTS week_assignment_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES course_weeks(id) ON DELETE RESTRICT,
  field_key TEXT NOT NULL,
  field_label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'textarea'
    CHECK (field_type IN ('textarea', 'file', 'text')),
  placeholder TEXT,
  help_text TEXT,
  is_required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 수강생 등록 (course_enrollments)
CREATE TABLE IF NOT EXISTS course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'dropped')),
  email_opt_out BOOLEAN NOT NULL DEFAULT false,
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (user_id, course_id)
);

-- 3.5 과제 제출 (assignments)
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  week_id UUID NOT NULL REFERENCES course_weeks(id),
  content JSONB NOT NULL DEFAULT '{}',
  version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft', 'submitted', 'processing', 'feedback_ready')),
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT chk_content_not_empty
    CHECK (jsonb_typeof(content) = 'object' AND content != '{}'::jsonb),
  CONSTRAINT chk_content_size
    CHECK (octet_length(content::text) < 100000)
);

-- 3.6 과제 첨부파일 (assignment_files)
CREATE TABLE IF NOT EXISTS assignment_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id) ON DELETE RESTRICT,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 AI 피드백 (feedbacks)
CREATE TABLE IF NOT EXISTS feedbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  week_id UUID NOT NULL REFERENCES course_weeks(id),
  content TEXT NOT NULL,
  summary TEXT,
  scores JSONB,
  version INTEGER NOT NULL DEFAULT 1,
  assignment_version INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'approved', 'sent', 'rejected')),
  tokens_input INTEGER,
  tokens_output INTEGER,
  generation_time_ms INTEGER,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_comment TEXT,
  pdf_path TEXT,          -- [Phase 2]
  sent_at TIMESTAMPTZ,    -- [Phase 2]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_feedbacks_assignment_version UNIQUE (assignment_id, version)
);

-- 3.8 피드백 생성 작업 큐 (feedback_jobs)
CREATE TABLE IF NOT EXISTS feedback_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES assignments(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  worker_type VARCHAR(10) NOT NULL DEFAULT 'edge'
    CHECK (worker_type IN ('cron', 'edge')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- active job 단일 보장
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_jobs_active_assignment
  ON feedback_jobs(assignment_id)
  WHERE status IN ('pending', 'processing');

-- 3.9 RAG 데이터셋 관리 (rag_datasets)
CREATE TABLE IF NOT EXISTS rag_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.10 RAG-주차 매핑 (rag_week_mappings)
CREATE TABLE IF NOT EXISTS rag_week_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id UUID NOT NULL REFERENCES course_weeks(id),
  rag_dataset_id UUID NOT NULL REFERENCES rag_datasets(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, rag_dataset_id)
);

-- 3.11 RAG 청크 (rag_chunks)
CREATE TABLE IF NOT EXISTS rag_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES rag_datasets(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  category TEXT,
  chunk_type TEXT,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, chunk_index)
);

-- 3.12 시스템 설정 (system_settings)
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ============================================================
-- 4. 인덱스
-- ============================================================

-- course_enrollments
CREATE INDEX IF NOT EXISTS idx_enrollments_user_active
  ON course_enrollments(user_id)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_enrollments_course
  ON course_enrollments(course_id);

-- course_weeks
CREATE INDEX IF NOT EXISTS idx_weeks_course_number
  ON course_weeks(course_id, week_number);

-- assignments
CREATE INDEX IF NOT EXISTS idx_assignments_user_week_version
  ON assignments(user_id, week_id, version DESC);

CREATE INDEX IF NOT EXISTS idx_assignments_course_status
  ON assignments(course_id, status);

-- feedbacks
CREATE INDEX IF NOT EXISTS idx_feedbacks_assignment_created
  ON feedbacks(assignment_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feedbacks_user
  ON feedbacks(user_id);

CREATE INDEX IF NOT EXISTS idx_feedbacks_status
  ON feedbacks(status);

CREATE INDEX IF NOT EXISTS idx_feedbacks_course_status
  ON feedbacks(course_id, status);

-- feedback_jobs
CREATE INDEX IF NOT EXISTS idx_feedback_jobs_pending
  ON feedback_jobs(status, created_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_feedback_jobs_worker_type
  ON feedback_jobs(worker_type, status);

-- rag_chunks
CREATE INDEX IF NOT EXISTS idx_rag_chunks_dataset
  ON rag_chunks(dataset_id);

CREATE INDEX IF NOT EXISTS idx_rag_chunks_category
  ON rag_chunks(category);


-- ============================================================
-- 5. RLS 활성화 + 정책
-- ============================================================

-- RLS 활성화
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_weeks ENABLE ROW LEVEL SECURITY;
ALTER TABLE week_assignment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE rag_week_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 수강생 정책 (보조 방어)
CREATE POLICY "enrolled_courses_select" ON courses FOR SELECT
  USING (
    id IN (SELECT course_id FROM course_enrollments
           WHERE user_id = current_user_id() AND status = 'active')
    OR is_lms_admin()
  );

CREATE POLICY "enrolled_weeks_select" ON course_weeks FOR SELECT
  USING (
    course_id IN (SELECT course_id FROM course_enrollments
                  WHERE user_id = current_user_id() AND status = 'active')
    OR is_lms_admin()
  );

CREATE POLICY "enrolled_configs_select" ON week_assignment_configs FOR SELECT
  USING (
    week_id IN (SELECT id FROM course_weeks WHERE course_id IN
      (SELECT course_id FROM course_enrollments
       WHERE user_id = current_user_id() AND status = 'active'))
    OR is_lms_admin()
  );

CREATE POLICY "own_enrollments_select" ON course_enrollments FOR SELECT
  USING (user_id = current_user_id() OR is_lms_admin());

CREATE POLICY "own_assignments_select" ON assignments FOR SELECT
  USING (user_id = current_user_id() OR is_lms_admin());

CREATE POLICY "own_assignments_insert" ON assignments FOR INSERT
  WITH CHECK (user_id = current_user_id());

CREATE POLICY "own_assignments_update" ON assignments FOR UPDATE
  USING (user_id = current_user_id() AND status IN ('draft', 'submitted'));

CREATE POLICY "own_files_insert" ON assignment_files FOR INSERT
  WITH CHECK (
    assignment_id IN (SELECT id FROM assignments
      WHERE user_id = current_user_id())
  );

CREATE POLICY "own_files_select" ON assignment_files FOR SELECT
  USING (
    assignment_id IN (SELECT id FROM assignments
      WHERE user_id = current_user_id())
    OR is_lms_admin()
  );

CREATE POLICY "own_feedbacks_select" ON feedbacks FOR SELECT
  USING (user_id = current_user_id() OR is_lms_admin());

-- 관리자 정책
CREATE POLICY "admin_manage_courses" ON courses FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_manage_weeks" ON course_weeks FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_manage_configs" ON week_assignment_configs FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_manage_enrollments" ON course_enrollments FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_manage_assignments" ON assignments FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_manage_files" ON assignment_files FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_manage_feedbacks" ON feedbacks FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_manage_feedback_jobs" ON feedback_jobs FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_only_rag" ON rag_datasets FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_only_rag_chunks" ON rag_chunks FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_only_rag_mappings" ON rag_week_mappings FOR ALL
  USING (is_lms_admin());

CREATE POLICY "admin_only_settings" ON system_settings FOR ALL
  USING (is_lms_admin());


-- ============================================================
-- 6. DB 함수
-- ============================================================

-- 6.1 피드백 Job 선택 (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION pick_next_feedback_jobs(p_limit INTEGER DEFAULT 5)
RETURNS TABLE (
  job_id UUID,
  job_assignment_id UUID,
  job_attempts INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH picked AS (
    SELECT fj.id, fj.assignment_id, fj.attempts
    FROM feedback_jobs fj
    WHERE fj.status = 'pending'
    ORDER BY fj.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE feedback_jobs fj
  SET
    status = 'processing',
    started_at = now(),
    attempts = fj.attempts + 1
  FROM picked
  WHERE fj.id = picked.id
  RETURNING fj.id AS job_id, fj.assignment_id AS job_assignment_id, fj.attempts AS job_attempts;
END;
$$ LANGUAGE plpgsql;

-- 6.2 좀비 Job 복구
CREATE OR REPLACE FUNCTION recover_zombie_jobs()
RETURNS INTEGER AS $$
DECLARE
  recovered_count INTEGER;
BEGIN
  WITH zombies AS (
    UPDATE feedback_jobs
    SET
      status = 'pending',
      started_at = NULL
    WHERE status = 'processing'
      AND (
        (worker_type = 'cron' AND started_at < now() - INTERVAL '5 minutes')
        OR
        (worker_type = 'edge' AND started_at < now() - INTERVAL '10 minutes')
      )
      AND attempts < max_attempts
    RETURNING id
  )
  SELECT count(*) INTO recovered_count FROM zombies;

  -- max_attempts 초과 시 failed로 전환
  UPDATE feedback_jobs
  SET
    status = 'failed',
    error_message = COALESCE(error_message, '') || ' [zombie_recovered_exceeded_max_attempts]',
    completed_at = now()
  WHERE status = 'processing'
    AND (
      (worker_type = 'cron' AND started_at < now() - INTERVAL '5 minutes')
      OR
      (worker_type = 'edge' AND started_at < now() - INTERVAL '10 minutes')
    )
    AND attempts >= max_attempts;

  RETURN recovered_count;
END;
$$ LANGUAGE plpgsql;

-- 6.3 기수 통계 조회
CREATE OR REPLACE FUNCTION get_course_stats(p_course_id UUID)
RETURNS TABLE (
  total_enrollments BIGINT,
  active_enrollments BIGINT,
  total_assignments BIGINT,
  total_feedbacks BIGINT,
  pending_jobs BIGINT,
  processing_jobs BIGINT,
  completed_jobs BIGINT,
  failed_jobs BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM course_enrollments
     WHERE course_id = p_course_id AND deleted_at IS NULL)::BIGINT AS total_enrollments,
    (SELECT count(*) FROM course_enrollments
     WHERE course_id = p_course_id AND status = 'active' AND deleted_at IS NULL)::BIGINT AS active_enrollments,
    (SELECT count(*) FROM assignments
     WHERE course_id = p_course_id AND deleted_at IS NULL)::BIGINT AS total_assignments,
    (SELECT count(*) FROM feedbacks
     WHERE course_id = p_course_id)::BIGINT AS total_feedbacks,
    (SELECT count(*) FROM feedback_jobs fj
     JOIN assignments a ON a.id = fj.assignment_id
     WHERE a.course_id = p_course_id AND fj.status = 'pending')::BIGINT AS pending_jobs,
    (SELECT count(*) FROM feedback_jobs fj
     JOIN assignments a ON a.id = fj.assignment_id
     WHERE a.course_id = p_course_id AND fj.status = 'processing')::BIGINT AS processing_jobs,
    (SELECT count(*) FROM feedback_jobs fj
     JOIN assignments a ON a.id = fj.assignment_id
     WHERE a.course_id = p_course_id AND fj.status = 'completed')::BIGINT AS completed_jobs,
    (SELECT count(*) FROM feedback_jobs fj
     JOIN assignments a ON a.id = fj.assignment_id
     WHERE a.course_id = p_course_id AND fj.status = 'failed')::BIGINT AS failed_jobs;
END;
$$ LANGUAGE plpgsql STABLE;

-- 6.4 과제 제출 통계 조회
CREATE OR REPLACE FUNCTION get_submission_stats(p_course_id UUID)
RETURNS TABLE (
  week_id UUID,
  week_number INTEGER,
  week_title TEXT,
  total_enrolled BIGINT,
  submitted_count BIGINT,
  feedback_ready_count BIGINT,
  submission_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cw.id AS week_id,
    cw.week_number,
    cw.title AS week_title,
    (SELECT count(*) FROM course_enrollments
     WHERE course_id = p_course_id AND status = 'active' AND deleted_at IS NULL)::BIGINT AS total_enrolled,
    (SELECT count(DISTINCT a.user_id) FROM assignments a
     WHERE a.week_id = cw.id AND a.status != 'draft' AND a.deleted_at IS NULL)::BIGINT AS submitted_count,
    (SELECT count(DISTINCT a.user_id) FROM assignments a
     WHERE a.week_id = cw.id AND a.status = 'feedback_ready' AND a.deleted_at IS NULL)::BIGINT AS feedback_ready_count,
    CASE
      WHEN (SELECT count(*) FROM course_enrollments
            WHERE course_id = p_course_id AND status = 'active' AND deleted_at IS NULL) = 0
      THEN 0
      ELSE ROUND(
        (SELECT count(DISTINCT a.user_id) FROM assignments a
         WHERE a.week_id = cw.id AND a.status != 'draft' AND a.deleted_at IS NULL)::NUMERIC
        /
        (SELECT count(*) FROM course_enrollments
         WHERE course_id = p_course_id AND status = 'active' AND deleted_at IS NULL)::NUMERIC
        * 100, 1
      )
    END AS submission_rate
  FROM course_weeks cw
  WHERE cw.course_id = p_course_id AND cw.deleted_at IS NULL
  ORDER BY cw.week_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- updated_at 트리거 적용
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'courses', 'course_weeks', 'course_enrollments',
    'assignments', 'feedbacks'
  ])
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trigger_update_%I_updated_at ON %I;
       CREATE TRIGGER trigger_update_%I_updated_at
         BEFORE UPDATE ON %I
         FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END;
$$;


-- ============================================================
-- 7. 시드 데이터
-- ============================================================

INSERT INTO system_settings (key, value) VALUES
  ('review_mode_enabled', 'false'::jsonb),
  ('ai_model', '"sonnet-4"'::jsonb),
  ('ai_max_tokens', '20000'::jsonb),
  ('ai_temperature', '0.7'::jsonb),
  ('feedback_concurrent_limit', '5'::jsonb),
  ('daily_cost_warning_threshold', '20'::jsonb),
  ('daily_cost_limit', '40'::jsonb),
  ('monthly_cost_limit', '800'::jsonb)
ON CONFLICT (key) DO NOTHING;

COMMIT;
