// src/app/api/lms/assignments/[assignmentId]/files/route.ts
// 과제 첨부파일 API - 2단계 업로드 (서명 URL → 직접 업로드)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'md', 'doc', 'docx', 'hwp', 'hwpx'];

// GET /api/lms/assignments/[assignmentId]/files - 첨부파일 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { assignmentId } = await params;

    try {
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, user_id')
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignment) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      const isAdmin = auth.role === 'admin' || auth.tier === 'ENTERPRISE';
      if (!isAdmin && assignment.user_id !== auth.userId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' } },
          { status: 403 }
        );
      }

      const { data: files, error: filesError } = await supabase
        .from('assignment_files')
        .select('id, file_name, mime_type, file_size, file_path, created_at')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      if (filesError) {
        console.error('[Files GET Error]', filesError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '파일 목록 조회 실패' } },
          { status: 500 }
        );
      }

      const filesWithUrls = await Promise.all(
        (files || []).map(async (file) => {
          const { data } = await supabase.storage
            .from('assignment-files')
            .createSignedUrl(file.file_path, 3600);

          return {
            id: file.id,
            file_name: file.file_name,
            file_type: file.mime_type,
            file_size: file.file_size,
            storage_path: file.file_path,
            created_at: file.created_at,
            url: data?.signedUrl || '',
          };
        })
      );

      return NextResponse.json({
        success: true,
        data: { files: filesWithUrls },
      });
    } catch (error) {
      console.error('[Files GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/assignments/[assignmentId]/files - 파일 업로드
// 2가지 모드 지원:
// 1) mode=signedUrl: 서명된 업로드 URL 발급 (대용량 파일용, 클라이언트가 직접 Storage 업로드)
// 2) 기본: FormData로 서버 경유 업로드 (4.5MB 이하 파일)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { assignmentId } = await params;

    try {
      // 과제 소유권 확인
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, user_id, status')
        .eq('id', assignmentId)
        .single();

      if (assignmentError || !assignment) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      if (assignment.user_id !== auth.userId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '본인의 과제만 수정할 수 있습니다' } },
          { status: 403 }
        );
      }

      if (assignment.status === 'reviewed') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: '리뷰된 과제는 수정할 수 없습니다' } },
          { status: 400 }
        );
      }

      // 기존 파일 개수 확인
      const { count } = await supabase
        .from('assignment_files')
        .select('id', { count: 'exact', head: true })
        .eq('assignment_id', assignmentId);

      if ((count || 0) >= 5) {
        return NextResponse.json(
          { success: false, error: { code: 'LIMIT_EXCEEDED', message: '파일은 최대 5개까지 첨부할 수 있습니다' } },
          { status: 400 }
        );
      }

      // Content-Type으로 모드 분기
      const contentType = request.headers.get('content-type') || '';

      // === 모드 1: 서명된 업로드 URL 발급 (JSON 요청) ===
      if (contentType.includes('application/json')) {
        const body = await request.json();
        const { fileName, fileSize, fileType } = body;

        if (!fileName || !fileSize) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: 'fileName과 fileSize는 필수입니다' } },
            { status: 400 }
          );
        }

        // 파일 크기 확인
        if (fileSize > MAX_FILE_SIZE) {
          return NextResponse.json(
            { success: false, error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 10MB를 초과할 수 없습니다' } },
            { status: 400 }
          );
        }

        // 확장자 확인
        const ext = fileName.split('.').pop()?.toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext || '')) {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_FILE_TYPE', message: '허용되지 않는 파일 형식입니다' } },
            { status: 400 }
          );
        }

        // Storage 경로 생성
        const timestamp = Date.now();
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${auth.userId}/${assignmentId}/${timestamp}_${sanitizedFileName}`;

        // 서명된 업로드 URL 생성
        const { data: signedData, error: signedError } = await supabase.storage
          .from('assignment-files')
          .createSignedUploadUrl(storagePath);

        if (signedError || !signedData) {
          console.error('[Signed URL Error]', signedError);
          return NextResponse.json(
            { success: false, error: { code: 'UPLOAD_ERROR', message: '업로드 URL 생성 실패' } },
            { status: 500 }
          );
        }

        // DB에 파일 레코드 미리 생성 (pending 상태)
        const { data: fileRecord, error: dbError } = await supabase
          .from('assignment_files')
          .insert({
            assignment_id: assignmentId,
            file_name: fileName,
            mime_type: fileType || 'application/octet-stream',
            file_size: fileSize,
            file_path: storagePath,
          })
          .select()
          .single();

        if (dbError) {
          console.error('[File DB Error]', dbError);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '파일 정보 저장 실패' } },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: {
            mode: 'signedUrl',
            signedUrl: signedData.signedUrl,
            token: signedData.token,
            storagePath,
            file: {
              id: fileRecord.id,
              file_name: fileRecord.file_name,
              file_type: fileRecord.mime_type,
              file_size: fileRecord.file_size,
              storage_path: storagePath,
              created_at: fileRecord.created_at,
              url: '', // 업로드 완료 후 GET으로 조회
            },
          },
        }, { status: 201 });
      }

      // === 모드 2: 기존 FormData 업로드 (4.5MB 이하) ===
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '파일이 필요합니다' } },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 10MB를 초과할 수 없습니다' } },
          { status: 400 }
        );
      }

      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext || '')) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_FILE_TYPE', message: '허용되지 않는 파일 형식입니다' } },
          { status: 400 }
        );
      }

      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${auth.userId}/${assignmentId}/${timestamp}_${sanitizedFileName}`;

      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('assignment-files')
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('[File Upload Error]', uploadError);
        return NextResponse.json(
          { success: false, error: { code: 'UPLOAD_ERROR', message: '파일 업로드 실패' } },
          { status: 500 }
        );
      }

      const { data: fileRecord, error: dbError } = await supabase
        .from('assignment_files')
        .insert({
          assignment_id: assignmentId,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          file_path: storagePath,
        })
        .select()
        .single();

      if (dbError) {
        await supabase.storage.from('assignment-files').remove([storagePath]);
        console.error('[File DB Error]', dbError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '파일 정보 저장 실패' } },
          { status: 500 }
        );
      }

      const { data: urlData } = await supabase.storage
        .from('assignment-files')
        .createSignedUrl(storagePath, 3600);

      return NextResponse.json(
        {
          success: true,
          data: {
            file: {
              id: fileRecord.id,
              file_name: fileRecord.file_name,
              file_type: fileRecord.mime_type,
              file_size: fileRecord.file_size,
              storage_path: fileRecord.file_path,
              created_at: fileRecord.created_at,
              url: urlData?.signedUrl || '',
            },
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[File Upload Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/assignments/[assignmentId]/files - 파일 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { assignmentId } = await params;

    try {
      const body = await request.json();
      const { fileId } = body;

      if (!fileId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'fileId는 필수입니다' } },
          { status: 400 }
        );
      }

      const { data: fileRecord, error: fileError } = await supabase
        .from('assignment_files')
        .select(`
          id,
          file_path,
          assignments!inner (
            id,
            user_id,
            status
          )
        `)
        .eq('id', fileId)
        .eq('assignment_id', assignmentId)
        .single();

      if (fileError || !fileRecord) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '파일을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      const assignmentData = fileRecord.assignments as unknown as { user_id: string; status: string };

      if (assignmentData.user_id !== auth.userId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '본인의 파일만 삭제할 수 있습니다' } },
          { status: 403 }
        );
      }

      if (assignmentData.status === 'reviewed') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: '리뷰된 과제의 파일은 삭제할 수 없습니다' } },
          { status: 400 }
        );
      }

      await supabase.storage.from('assignment-files').remove([fileRecord.file_path]);

      const { error: dbError } = await supabase
        .from('assignment_files')
        .delete()
        .eq('id', fileId);

      if (dbError) {
        console.error('[File DB Delete Error]', dbError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '파일 삭제 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { deleted: true, fileId },
      });
    } catch (error) {
      console.error('[File Delete Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
