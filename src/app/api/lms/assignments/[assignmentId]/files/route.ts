// src/app/api/lms/assignments/[assignmentId]/files/route.ts
// 과제 첨부파일 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// GET /api/lms/assignments/[assignmentId]/files - 첨부파일 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { assignmentId } = await params;

    try {
      // 과제 소유권 확인
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

      // 본인 과제인지 확인 (관리자는 모든 과제 접근 가능)
      const isAdmin = auth.role === 'admin' || auth.tier === 'ENTERPRISE';
      if (!isAdmin && assignment.user_id !== auth.userId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' } },
          { status: 403 }
        );
      }

      // 첨부파일 목록 조회
      const { data: files, error: filesError } = await supabase
        .from('assignment_files')
        .select('id, file_name, file_type, file_size, storage_path, created_at')
        .eq('assignment_id', assignmentId)
        .order('created_at', { ascending: true });

      if (filesError) {
        console.error('[Files GET Error]', filesError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '파일 목록 조회 실패' } },
          { status: 500 }
        );
      }

      // 각 파일의 공개 URL 생성
      const filesWithUrls = await Promise.all(
        (files || []).map(async (file) => {
          const { data } = supabase.storage
            .from('assignment-files')
            .getPublicUrl(file.storage_path);

          return {
            ...file,
            url: data.publicUrl,
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

      // 본인 과제인지 확인
      if (assignment.user_id !== auth.userId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '본인의 과제만 수정할 수 있습니다' } },
          { status: 403 }
        );
      }

      // 이미 리뷰된 과제는 수정 불가
      if (assignment.status === 'reviewed') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: '리뷰된 과제는 수정할 수 없습니다' } },
          { status: 400 }
        );
      }

      // FormData 파싱
      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '파일이 필요합니다' } },
          { status: 400 }
        );
      }

      // 파일 크기 확인
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, error: { code: 'FILE_TOO_LARGE', message: '파일 크기는 10MB를 초과할 수 없습니다' } },
          { status: 400 }
        );
      }

      // 파일 타입 확인
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_FILE_TYPE', message: '허용되지 않는 파일 형식입니다' } },
          { status: 400 }
        );
      }

      // 기존 파일 개수 확인 (최대 5개)
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

      // 고유 파일 경로 생성
      const timestamp = Date.now();
      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${auth.userId}/${assignmentId}/${timestamp}_${sanitizedFileName}`;

      // Supabase Storage에 업로드
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

      // DB에 파일 정보 저장
      const { data: fileRecord, error: dbError } = await supabase
        .from('assignment_files')
        .insert({
          assignment_id: assignmentId,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (dbError) {
        // 업로드된 파일 롤백
        await supabase.storage.from('assignment-files').remove([storagePath]);

        console.error('[File DB Error]', dbError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '파일 정보 저장 실패' } },
          { status: 500 }
        );
      }

      // 공개 URL 생성
      const { data: urlData } = supabase.storage
        .from('assignment-files')
        .getPublicUrl(storagePath);

      return NextResponse.json(
        {
          success: true,
          data: {
            file: {
              ...fileRecord,
              url: urlData.publicUrl,
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

      // 파일 정보 조회
      const { data: fileRecord, error: fileError } = await supabase
        .from('assignment_files')
        .select(`
          id,
          storage_path,
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

      // 과제 정보 추출
      const assignment = fileRecord.assignments as unknown as { user_id: string; status: string };

      // 본인 과제인지 확인
      if (assignment.user_id !== auth.userId) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '본인의 파일만 삭제할 수 있습니다' } },
          { status: 403 }
        );
      }

      // 이미 리뷰된 과제의 파일은 삭제 불가
      if (assignment.status === 'reviewed') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: '리뷰된 과제의 파일은 삭제할 수 없습니다' } },
          { status: 400 }
        );
      }

      // Storage에서 파일 삭제
      const { error: storageError } = await supabase.storage
        .from('assignment-files')
        .remove([fileRecord.storage_path]);

      if (storageError) {
        console.error('[File Storage Delete Error]', storageError);
        // Storage 삭제 실패해도 DB는 삭제 진행
      }

      // DB에서 파일 레코드 삭제
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
