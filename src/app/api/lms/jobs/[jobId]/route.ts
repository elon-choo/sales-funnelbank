// src/app/api/lms/jobs/[jobId]/route.ts
// 개별 작업 상세 조회 및 취소 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

interface RouteParams {
  params: Promise<{ jobId: string }>;
}

// GET /api/lms/jobs/[jobId] - 작업 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  return withLmsAuth(request, async (auth, supabase) => {
    try {
      // 작업 정보 조회
      const { data: job, error } = await supabase
        .from('feedback_jobs')
        .select(`
          id,
          assignment_id,
          status,
          worker_type,
          priority,
          attempts,
          started_at,
          completed_at,
          error_message,
          metadata,
          created_at,
          updated_at,
          assignments (
            id,
            user_id,
            course_id,
            week_id,
            version,
            status,
            content,
            profiles (id, email, full_name),
            courses (id, title),
            course_weeks (id, week_number, title)
          )
        `)
        .eq('id', jobId)
        .single();

      if (error || !job) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 관리자가 아닌 경우 본인 과제인지 확인 (CTO-001 방안B)
      if (auth.lmsRole !== 'admin' && auth.tier !== 'ENTERPRISE') {
        // Supabase returns single relation as object, but TS infers as array
        const assignment = job.assignments as unknown as { user_id: string } | null;
        if (!assignment || assignment.user_id !== auth.userId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' } },
            { status: 403 }
          );
        }

        // 학생에게는 민감 정보 숨김
        const sanitizedJob = {
          id: job.id,
          assignment_id: job.assignment_id,
          status: job.status,
          started_at: job.started_at,
          completed_at: job.completed_at,
          created_at: job.created_at,
          // 예상 대기 시간 계산
          estimatedWait: job.status === 'pending' ? '1-5분' : null,
        };

        return NextResponse.json({
          success: true,
          data: { job: sanitizedJob },
        });
      }

      // 관리자: 전체 정보 반환
      return NextResponse.json({
        success: true,
        data: { job },
      });
    } catch (error) {
      console.error('[Job GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/jobs/[jobId] - 작업 취소 (관리자 전용, pending 상태만)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      // 작업 존재 및 상태 확인
      const { data: existing, error: findError } = await supabase
        .from('feedback_jobs')
        .select('id, status, assignment_id')
        .eq('id', jobId)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // pending 상태만 취소 가능
      if (existing.status !== 'pending') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `${existing.status} 상태의 작업은 취소할 수 없습니다`,
              data: { currentStatus: existing.status },
            },
          },
          { status: 400 }
        );
      }

      // 작업 취소 (cancelled 상태로 변경)
      const { data: job, error } = await supabase
        .from('feedback_jobs')
        .update({
          status: 'cancelled',
          completed_at: new Date().toISOString(),
          metadata: {
            cancelledBy: auth.userId,
            cancelledAt: new Date().toISOString(),
          },
        })
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        console.error('[Job Cancel Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '작업 취소 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          cancelled: true,
          job,
        },
      });
    } catch (error) {
      console.error('[Job Cancel Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/jobs/[jobId] - 작업 재시도 (관리자 전용, failed 상태만)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { jobId } = await params;

  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      // 작업 존재 및 상태 확인
      const { data: existing, error: findError } = await supabase
        .from('feedback_jobs')
        .select('id, status, assignment_id, attempts')
        .eq('id', jobId)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '작업을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // failed 상태만 재시도 가능
      if (existing.status !== 'failed') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'INVALID_STATUS',
              message: `${existing.status} 상태의 작업은 재시도할 수 없습니다`,
              data: { currentStatus: existing.status },
            },
          },
          { status: 400 }
        );
      }

      // 작업 재시도 (pending으로 변경, attempts 리셋)
      const { data: job, error } = await supabase
        .from('feedback_jobs')
        .update({
          status: 'pending',
          attempts: 0,
          started_at: null,
          completed_at: null,
          error_message: null,
          metadata: {
            retriedBy: auth.userId,
            retriedAt: new Date().toISOString(),
            previousAttempts: existing.attempts,
          },
        })
        .eq('id', jobId)
        .select()
        .single();

      if (error) {
        console.error('[Job Retry Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '작업 재시도 설정 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          retried: true,
          job,
          message: '작업이 큐에 다시 추가되었습니다',
        },
      });
    } catch (error) {
      console.error('[Job Retry Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
