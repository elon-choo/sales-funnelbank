// src/app/api/lms/feedbacks/route.ts
// 피드백 조회 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/feedbacks - 피드백 목록 조회
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    const courseId = searchParams.get('courseId');
    const weekId = searchParams.get('weekId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
      // 관리자: 전체 피드백 조회 가능
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        let query = supabase
          .from('feedbacks')
          .select(`
            id,
            assignment_id,
            version,
            ai_model,
            raw_feedback,
            parsed_feedback,
            score,
            processing_time_ms,
            token_usage,
            cost_usd,
            created_at,
            assignments (
              id,
              user_id,
              course_id,
              week_id,
              version,
              status,
              profiles (id, email, full_name),
              courses (id, title),
              course_weeks (id, week_number, title)
            )
          `, { count: 'exact' })
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (assignmentId) query = query.eq('assignment_id', assignmentId);
        if (courseId) query = query.eq('assignments.course_id', courseId);
        if (weekId) query = query.eq('assignments.week_id', weekId);

        const { data: feedbacks, error, count } = await query;

        if (error) {
          console.error('[Feedbacks GET Admin Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '피드백 목록 조회 실패' } },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: { feedbacks, total: count, limit, offset },
        });
      }

      // 학생: 본인 과제의 피드백만 조회 (CTO-001 방안B)
      let query = supabase
        .from('feedbacks')
        .select(`
          id,
          assignment_id,
          version,
          ai_model,
          raw_feedback,
          parsed_feedback,
          score,
          created_at,
          assignments!inner (
            id,
            user_id,
            course_id,
            week_id,
            version,
            status,
            courses (id, title),
            course_weeks (id, week_number, title)
          )
        `, { count: 'exact' })
        .eq('assignments.user_id', auth.userId)  // 핵심: API 레벨 user_id 필터 (JOIN)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (assignmentId) query = query.eq('assignment_id', assignmentId);
      if (courseId) query = query.eq('assignments.course_id', courseId);
      if (weekId) query = query.eq('assignments.week_id', weekId);

      const { data: feedbacks, error, count } = await query;

      if (error) {
        console.error('[Feedbacks GET Student Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '피드백 목록 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { feedbacks, total: count, limit, offset },
      });
    } catch (error) {
      console.error('[Feedbacks GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/feedbacks - 수동 피드백 재생성 (관리자 전용)
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { assignmentId, isPremium = false } = body;

      if (!assignmentId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'assignmentId는 필수입니다' } },
          { status: 400 }
        );
      }

      // 과제 존재 확인
      const { data: assignment, error: assignmentError } = await supabase
        .from('assignments')
        .select('id, user_id, course_id, week_id, status, content')
        .eq('id', assignmentId)
        .is('deleted_at', null)
        .single();

      if (assignmentError || !assignment) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '과제를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 과제 상태 확인 (draft는 피드백 불가)
      if (assignment.status === 'draft') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: '초안 상태의 과제는 피드백을 생성할 수 없습니다' } },
          { status: 400 }
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
          {
            success: false,
            error: {
              code: 'JOB_IN_PROGRESS',
              message: '이미 진행 중인 피드백 작업이 있습니다',
              data: { jobId: existingJob.id, status: existingJob.status },
            },
          },
          { status: 409 }
        );
      }

      // 피드백 작업 큐에 추가
      const { data: job, error: jobError } = await supabase
        .from('feedback_jobs')
        .insert({
          assignment_id: assignmentId,
          status: 'pending',
          worker_type: 'edge',
          priority: isPremium ? 10 : 5,  // 프리미엄은 높은 우선순위
          metadata: {
            requestedBy: auth.userId,
            requestedAt: new Date().toISOString(),
            isPremium,
            isManualRetry: true,
          },
        })
        .select()
        .single();

      if (jobError) {
        console.error('[Feedback Job Create Error]', jobError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '피드백 작업 생성 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            job,
            message: '피드백 작업이 큐에 추가되었습니다',
            estimatedWait: isPremium ? '1-2분' : '3-5분',
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Feedback Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
