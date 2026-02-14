// src/app/api/lms/dashboard/route.ts
// LMS 대시보드 통계 API (학생: 본인 진도, 관리자: 전체 통계)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';
import {
  withCache,
  createCacheKey,
  CACHE_PROFILES
} from '@/lib/cache/api-cache';

// GET /api/lms/dashboard - 대시보드 데이터 조회
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const skipCache = searchParams.get('refresh') === 'true';

    try {
      // 관리자: 전체 통계
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        const cacheKey = createCacheKey('admin:dashboard', { courseId });

        if (skipCache) {
          const data = await fetchAdminDashboard(supabase, courseId);
          return createCachedResponse(data, false);
        }

        const { data, cached } = await withCache(
          cacheKey,
          () => fetchAdminDashboard(supabase, courseId),
          { ttl: 1000 * 30, type: 'global' }  // 30초 캐시
        );

        return createCachedResponse(data, cached);
      }

      // 학생: 본인 진도 및 통계 (사용자별 캐시)
      const cacheKey = createCacheKey(`user:${auth.userId}:dashboard`, { courseId });

      if (skipCache) {
        const data = await fetchStudentDashboard(supabase, auth.userId, courseId);
        return createCachedResponse(data, false);
      }

      const { data, cached } = await withCache(
        cacheKey,
        () => fetchStudentDashboard(supabase, auth.userId, courseId),
        { ttl: 1000 * 60 * 2, type: 'user' }  // 2분 캐시
      );

      return createCachedResponse(data, cached);
    } catch (error) {
      console.error('[Dashboard GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// 캐시된 응답 생성
function createCachedResponse(data: Record<string, unknown>, cached: boolean) {
  const headers = new Headers(CACHE_PROFILES.dashboard);
  headers.set('X-Cache', cached ? 'HIT' : 'MISS');

  return NextResponse.json(
    { success: true, data },
    { headers }
  );
}

// 관리자 대시보드 데이터 조회
async function fetchAdminDashboard(supabase: ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never, courseId: string | null): Promise<Record<string, unknown>> {
  // 기수 통계
  let courseQuery = supabase
    .from('courses')
    .select('id, title, status, total_weeks')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (courseId) {
    courseQuery = courseQuery.eq('id', courseId);
  }

  const { data: courses } = await courseQuery;

  // 전체 수강생 수
  const { count: totalEnrollments } = await supabase
    .from('course_enrollments')
    .select('id', { count: 'exact' })
    .eq('status', 'active')
    .is('deleted_at', null);

  // 전체 과제 통계
  let assignmentQuery = supabase
    .from('assignments')
    .select('id, status, course_id')
    .is('deleted_at', null);

  if (courseId) {
    assignmentQuery = assignmentQuery.eq('course_id', courseId);
  }

  const { data: assignments } = await assignmentQuery;

  const assignmentStats = {
    total: assignments?.length || 0,
    draft: assignments?.filter((a) => a.status === 'draft').length || 0,
    submitted: assignments?.filter((a) => a.status === 'submitted').length || 0,
    reviewed: assignments?.filter((a) => a.status === 'feedback_ready').length || 0,
  };

  // 피드백 작업 통계 (최근 24시간)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: recentJobs } = await supabase
    .from('feedback_jobs')
    .select('id, status, created_at')
    .gte('created_at', yesterday);

  const jobStats = {
    pending: recentJobs?.filter((j) => j.status === 'pending').length || 0,
    processing: recentJobs?.filter((j) => j.status === 'processing').length || 0,
    completed: recentJobs?.filter((j) => j.status === 'completed').length || 0,
    failed: recentJobs?.filter((j) => j.status === 'failed').length || 0,
    total24h: recentJobs?.length || 0,
  };

  // 최근 피드백 비용 (최근 7일)
  const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: recentFeedbacks } = await supabase
    .from('feedbacks')
    .select('cost_usd, ai_model, created_at')
    .gte('created_at', lastWeek)
    .is('deleted_at', null);

  const costStats = {
    totalCostUsd: recentFeedbacks?.reduce((sum, f) => sum + (f.cost_usd || 0), 0) || 0,
    feedbackCount: recentFeedbacks?.length || 0,
    byModel: {} as Record<string, { count: number; cost: number }>,
  };

  recentFeedbacks?.forEach((f) => {
    const model = f.ai_model || 'unknown';
    if (!costStats.byModel[model]) {
      costStats.byModel[model] = { count: 0, cost: 0 };
    }
    costStats.byModel[model].count++;
    costStats.byModel[model].cost += f.cost_usd || 0;
  });

  return {
    type: 'admin',
    courses,
    totalEnrollments: totalEnrollments || 0,
    assignmentStats,
    jobStats,
    costStats,
    generatedAt: new Date().toISOString(),
  };
}

// 학생 대시보드 데이터 조회
async function fetchStudentDashboard(supabase: ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never, userId: string, courseId: string | null): Promise<Record<string, unknown>> {
  // 내 수강 목록
  let enrollmentQuery = supabase
    .from('course_enrollments')
    .select(`
      id,
      course_id,
      status,
      enrolled_at,
      courses (
        id,
        title,
        status,
        total_weeks
      )
    `)
    .eq('user_id', userId)  // CTO-001 방안B: API 레벨 권한 검증
    .eq('status', 'active')
    .is('deleted_at', null);

  if (courseId) {
    enrollmentQuery = enrollmentQuery.eq('course_id', courseId);
  }

  const { data: enrollments } = await enrollmentQuery;

  // 내 과제 현황
  let assignmentQuery = supabase
    .from('assignments')
    .select(`
      id,
      course_id,
      week_id,
      status,
      version,
      submitted_at,
      course_weeks (
        id,
        week_number,
        title,
        deadline
      )
    `)
    .eq('user_id', userId)  // CTO-001 방안B
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (courseId) {
    assignmentQuery = assignmentQuery.eq('course_id', courseId);
  }

  const { data: assignments } = await assignmentQuery;

  const assignmentStats = {
    total: assignments?.length || 0,
    draft: assignments?.filter((a) => a.status === 'draft').length || 0,
    submitted: assignments?.filter((a) => a.status === 'submitted').length || 0,
    reviewed: assignments?.filter((a) => a.status === 'feedback_ready').length || 0,
  };

  // 진행 중인 피드백 작업
  const { data: pendingJobs } = await supabase
    .from('feedback_jobs')
    .select(`
      id,
      status,
      created_at,
      assignments!inner (
        id,
        user_id,
        week_id,
        course_weeks (week_number, title)
      )
    `)
    .eq('assignments.user_id', userId)  // CTO-001 방안B
    .in('status', ['pending', 'processing']);

  // 최근 피드백
  const { data: recentFeedbacks } = await supabase
    .from('feedbacks')
    .select(`
      id,
      scores,
      created_at,
      assignments!inner (
        id,
        user_id,
        week_id,
        course_weeks (week_number, title)
      )
    `)
    .eq('assignments.user_id', userId)  // CTO-001 방안B
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(5);

  // 평균 점수 계산 (scores는 JSON: {total: number})
  const allScores = recentFeedbacks
    ?.map((f) => (f.scores as Record<string, number> | null)?.total)
    .filter((s): s is number => s != null) || [];
  const averageScore = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10
    : null;

  return {
    type: 'student',
    enrollments,
    assignmentStats,
    pendingJobs: pendingJobs || [],
    recentFeedbacks: recentFeedbacks || [],
    averageScore,
    generatedAt: new Date().toISOString(),
  };
}
