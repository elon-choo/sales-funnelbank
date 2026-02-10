// src/app/api/lms/admin/regenerate/route.ts
// 관리자용 피드백 재생성 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// POST /api/lms/admin/regenerate
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { assignmentId } = body;

      if (!assignmentId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'assignmentId는 필수입니다' } },
          { status: 400 }
        );
      }

      // 과제 존재 확인
      const { data: assignment } = await supabase
        .from('assignments')
        .select('id, status')
        .eq('id', assignmentId)
        .single();

      if (!assignment) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 기존 pending/processing 작업 확인
      const { data: existingJob } = await supabase
        .from('feedback_jobs')
        .select('id, status')
        .eq('assignment_id', assignmentId)
        .in('status', ['pending', 'processing'])
        .single();

      if (existingJob) {
        return NextResponse.json(
          { success: false, error: { code: 'JOB_IN_PROGRESS', message: '이미 진행 중인 작업이 있습니다' } },
          { status: 409 }
        );
      }

      // 새 피드백 Job 생성
      const { data: job, error: jobError } = await supabase
        .from('feedback_jobs')
        .insert({
          assignment_id: assignmentId,
          status: 'pending',
          worker_type: 'edge',
          priority: 10,
          metadata: {
            requestedBy: auth.userId,
            requestedAt: new Date().toISOString(),
            isManualRetry: true,
          },
        })
        .select('id')
        .single();

      if (jobError) {
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '작업 생성 실패' } },
          { status: 500 }
        );
      }

      // feedback-processor 호출 (fire-and-forget)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000';

      fetch(`${baseUrl}/api/lms/feedback-processor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.CRON_SECRET_FEEDBACK || process.env.INTERNAL_API_SECRET || '',
        },
        body: JSON.stringify({ jobId: job.id, assignmentId }),
      }).catch(err => console.error('[Regenerate] Processor call failed:', err));

      return NextResponse.json({
        success: true,
        data: { jobId: job.id, message: '피드백 재생성이 시작되었습니다' },
      });
    } catch (error) {
      console.error('[Admin Regenerate Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
