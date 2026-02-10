// src/app/api/lms/assignments/route.ts
// 과제 목록 조회 및 제출 API
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { withLmsAuth, withEnrollmentAuth } from '@/lib/lms/guards';

// GET /api/lms/assignments - 내 과제 목록 조회
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const weekId = searchParams.get('weekId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
      // 관리자: 전체 과제 조회 가능
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        let query = supabase
          .from('assignments')
          .select(`
            id,
            user_id,
            course_id,
            week_id,
            content,
            version,
            status,
            submitted_at,
            created_at,
            updated_at,
            profiles (id, email, full_name),
            courses (id, title),
            course_weeks (id, week_number, title)
          `, { count: 'exact' })
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (courseId) query = query.eq('course_id', courseId);
        if (weekId) query = query.eq('week_id', weekId);
        if (status) query = query.eq('status', status);

        const { data: assignments, error, count } = await query;

        if (error) {
          console.error('[Assignments GET Admin Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '과제 목록 조회 실패' } },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: { assignments, total: count, limit, offset },
        });
      }

      // 학생: 본인 과제만 조회 (API 레벨 권한 검증 - CTO-001 방안B)
      let query = supabase
        .from('assignments')
        .select(`
          id,
          course_id,
          week_id,
          content,
          version,
          status,
          submitted_at,
          created_at,
          updated_at,
          courses (id, title),
          course_weeks (id, week_number, title, assignment_type, deadline)
        `, { count: 'exact' })
        .eq('user_id', auth.userId)  // 핵심: API 레벨 user_id 필터
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (courseId) query = query.eq('course_id', courseId);
      if (weekId) query = query.eq('week_id', weekId);
      if (status) query = query.eq('status', status);

      const { data: assignments, error, count } = await query;

      if (error) {
        console.error('[Assignments GET Student Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '과제 목록 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { assignments, total: count, limit, offset },
      });
    } catch (error) {
      console.error('[Assignments GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/assignments - 과제 제출
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const courseId = searchParams.get('courseId');
  const weekId = searchParams.get('weekId');

  if (!courseId || !weekId) {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'courseId와 weekId는 필수입니다' } },
      { status: 400 }
    );
  }

  // 등록 여부 확인 후 실행 (withEnrollmentAuth)
  return withEnrollmentAuth(request, courseId, async (auth, supabase, enrollment) => {
    try {
      const body = await request.json();
      const { content, isDraft = false } = body;

      // content 유효성 검증 (초안은 빈 내용 허용 - 파일 첨부용 draft)
      if (!content || typeof content !== 'object') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '과제 내용은 필수입니다' } },
          { status: 400 }
        );
      }
      if (!isDraft && Object.keys(content).length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '과제 내용을 입력해주세요' } },
          { status: 400 }
        );
      }

      // content 크기 검증 (100KB 미만)
      const contentSize = new TextEncoder().encode(JSON.stringify(content)).length;
      if (contentSize > 100000) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '과제 내용이 너무 큽니다 (최대 100KB)' } },
          { status: 400 }
        );
      }

      // 주차 유효성 확인
      const { data: week, error: weekError } = await supabase
        .from('course_weeks')
        .select('id, week_number, title, is_active, deadline')
        .eq('id', weekId)
        .eq('course_id', courseId)
        .is('deleted_at', null)
        .single();

      if (weekError || !week) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '해당 주차를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 주차 활성화 여부 확인 (초안은 비활성 주차에도 저장 가능)
      if (!isDraft && !week.is_active) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '아직 열리지 않은 주차입니다' } },
          { status: 403 }
        );
      }

      // 기존 과제 확인 (버전 관리)
      const { data: existingAll } = await supabase
        .from('assignments')
        .select('id, version, status')
        .eq('user_id', auth.userId)
        .eq('week_id', weekId)
        .is('deleted_at', null)
        .order('version', { ascending: false });

      const existing = existingAll?.[0] || null;

      // 주차별 제출 제한 (수강 등록의 max_submissions_per_week 기반)
      if (!isDraft) {
        const maxSubmissions = enrollment.max_submissions_per_week ?? 2;
        const submittedCount = existingAll?.filter(a => a.status === 'submitted' || a.status === 'feedback_ready').length || 0;
        if (submittedCount >= maxSubmissions) {
          return NextResponse.json(
            { success: false, error: { code: 'LIMIT_EXCEEDED', message: `주차별 최대 ${maxSubmissions}회까지만 과제를 제출할 수 있습니다.` } },
            { status: 400 }
          );
        }
      }

      const newVersion = existing ? existing.version + 1 : 1;
      const status = isDraft ? 'draft' : 'submitted';

      // 과제 생성
      const { data: assignment, error } = await supabase
        .from('assignments')
        .insert({
          user_id: auth.userId,
          course_id: courseId,
          week_id: weekId,
          content,
          version: newVersion,
          status,
          submitted_at: isDraft ? null : new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[Assignment Create Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '과제 저장 실패' } },
          { status: 500 }
        );
      }

      // 제출된 과제인 경우 피드백 작업 큐에 추가 + 즉시 처리 트리거
      if (!isDraft) {
        // 1. 피드백 작업 큐에 추가
        const { data: feedbackJob, error: jobError } = await supabase
          .from('feedback_jobs')
          .insert({
            assignment_id: assignment.id,
            status: 'pending',
            worker_type: 'edge',
          })
          .select('id')
          .single();

        if (jobError) {
          console.error('[Feedback Job Create Error]', jobError);
          // 과제는 저장되었으므로 경고만 로깅
        }

        // 2. 즉시 피드백 처리 트리거 (async after + 10초 timeout)
        // after() 콜백이 async여야 Vercel 런타임이 fetch 연결이 성립될 때까지 대기함
        // 프로세서는 요청을 수신하면 별도 서버리스 함수로 독립 실행되므로 client abort 후에도 계속 작동
        if (feedbackJob) {
          after(async () => {
            try {
              const baseUrl = process.env.VERCEL_URL
                ? `https://${process.env.VERCEL_URL}`
                : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

              const internalSecret = (process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET_FEEDBACK || '').trim();

              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);

              const res = await fetch(`${baseUrl}/api/lms/feedback-processor`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'x-internal-secret': internalSecret,
                },
                body: JSON.stringify({
                  jobId: feedbackJob.id,
                  assignmentId: assignment.id,
                }),
                signal: controller.signal,
              });
              clearTimeout(timeoutId);
              console.log('[Feedback Trigger] Status:', res.status);
            } catch (err) {
              // AbortError는 정상 (10초 timeout으로 연결 끊김 - 프로세서는 계속 실행 중)
              if (err instanceof Error && err.name === 'AbortError') {
                console.log('[Feedback Trigger] Request sent, processor running independently');
              } else {
                console.error('[Feedback Processor Trigger Error]', err);
              }
            }
          });
        }
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            assignment,
            week,
            version: newVersion,
            feedbackQueued: !isDraft,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Assignment Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
