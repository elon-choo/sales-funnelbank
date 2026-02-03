-- 011_storage_setup.sql
-- Supabase Storage 버킷 및 정책 설정
-- 실행: Supabase Dashboard > SQL Editor 또는 supabase db push

-- 참고: storage.buckets 테이블은 Supabase가 관리하므로
-- 직접 INSERT는 Dashboard 또는 API를 통해 해야 합니다.
-- 아래는 정책 설정 예시입니다.

-- ============================================================
-- Storage 버킷 생성 (Dashboard에서 수동으로 해야 함)
-- ============================================================
-- 버킷명: assignment-files
-- 공개 여부: Public (또는 Private + Signed URLs)
-- 파일 크기 제한: 10MB
-- 허용 MIME 타입: application/pdf, image/*, text/plain, application/msword, application/vnd.openxmlformats-*

-- ============================================================
-- Storage RLS 정책 (버킷 생성 후 적용)
-- ============================================================

-- 1. 본인 폴더에만 업로드 허용
-- 정책명: Users can upload to their own folder
-- 적용 대상: INSERT
-- 조건: (bucket_id = 'assignment-files') AND (auth.uid()::text = (storage.foldername(name))[1])

-- 2. 본인 파일만 조회 허용 (또는 공개)
-- 정책명: Users can view their own files
-- 적용 대상: SELECT
-- 조건: (bucket_id = 'assignment-files') AND (auth.uid()::text = (storage.foldername(name))[1])

-- 3. 본인 파일만 삭제 허용
-- 정책명: Users can delete their own files
-- 적용 대상: DELETE
-- 조건: (bucket_id = 'assignment-files') AND (auth.uid()::text = (storage.foldername(name))[1])

-- 4. 관리자는 모든 파일 접근 가능
-- 정책명: Admins can access all files
-- 적용 대상: ALL
-- 조건: (bucket_id = 'assignment-files') AND (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND (tier = 'ENTERPRISE' OR role = 'admin')))

-- ============================================================
-- 대체 방법: Supabase CLI로 버킷 생성
-- ============================================================
-- npx supabase storage create assignment-files --public

-- ============================================================
-- API를 통한 버킷 생성 (서버에서 실행)
-- ============================================================
-- const { data, error } = await supabase.storage.createBucket('assignment-files', {
--   public: true,
--   fileSizeLimit: 10485760, // 10MB
--   allowedMimeTypes: ['application/pdf', 'image/*', 'text/plain']
-- });

-- ============================================================
-- assignment_files 테이블 delete_file 함수 (Optional)
-- ============================================================
-- 파일 레코드 삭제 시 Storage에서도 자동 삭제하는 트리거

CREATE OR REPLACE FUNCTION delete_storage_file()
RETURNS TRIGGER AS $$
BEGIN
  -- Storage 파일 삭제는 트리거에서 직접 불가능
  -- 애플리케이션 레벨에서 처리 필요
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 트리거 생성 (참고용 - 실제 삭제는 API에서 처리)
-- CREATE TRIGGER on_assignment_file_delete
-- BEFORE DELETE ON assignment_files
-- FOR EACH ROW
-- EXECUTE FUNCTION delete_storage_file();

-- ============================================================
-- 완료 메시지
-- ============================================================
-- Storage 버킷 설정은 Supabase Dashboard에서 수동으로 완료하세요:
-- 1. Storage > Create new bucket > "assignment-files"
-- 2. Public bucket으로 설정 (또는 Private + Signed URLs)
-- 3. Policies 탭에서 위 정책들 추가
