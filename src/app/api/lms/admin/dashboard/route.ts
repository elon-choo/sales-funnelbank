// src/app/api/lms/admin/dashboard/route.ts
// LMS 관리자 대시보드 API - 학생/과제/피드백 통합 조회
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/admin/dashboard
export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const { searchParams } = new URL(request.url);
      const courseId = searchParams.get('courseId');

      // 1. 기수(코스) 목록
      const { data: courses } = await supabase
        .from('courses')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false });

      const targetCourseId = courseId || courses?.[0]?.id;

      if (!targetCourseId) {
        return NextResponse.json({
          success: true,
          data: { courses: [], stats: null, students: [], assignments: [], feedbacks: [] },
        });
      }

      // 2. 통합 쿼리 (병렬 실행)
      const [
        enrollmentsResult,
        assignmentsResult,
        feedbacksResult,
        jobsResult,
        weeksResult,
      ] = await Promise.all([
        // 수강생 목록
        supabase
          .from('course_enrollments')
          .select(`
            id, user_id, status, enrolled_at,
            profiles (id, email, full_name)
          `)
          .eq('course_id', targetCourseId)
          .order('enrolled_at', { ascending: false }),

        // 과제 목록
        supabase
          .from('assignments')
          .select(`
            id, user_id, course_id, week_id, version, status, submitted_at, created_at,
            profiles (id, email, full_name),
            course_weeks (id, week_number, title)
          `)
          .eq('course_id', targetCourseId)
          .order('created_at', { ascending: false })
          .limit(100),

        // 피드백 목록
        supabase
          .from('feedbacks')
          .select(`
            id, assignment_id, user_id, scores, status, tokens_input, tokens_output, generation_time_ms, created_at,
            assignments (
              id, user_id,
              profiles (id, email, full_name),
              course_weeks (id, week_number, title)
            )
          `)
          .eq('course_id', targetCourseId)
          .order('created_at', { ascending: false })
          .limit(100),

        // 피드백 Job 상태
        supabase
          .from('feedback_jobs')
          .select(`
            id, assignment_id, status, error_message, created_at, started_at, completed_at,
            assignments (
              id,
              profiles (id, email, full_name),
              course_weeks (id, week_number, title)
            )
          `)
          .order('created_at', { ascending: false })
          .limit(50),

        // 주차 목록
        supabase
          .from('course_weeks')
          .select('id, week_number, title, is_active, deadline')
          .eq('course_id', targetCourseId)
          .order('week_number', { ascending: true }),
      ]);

      const enrollments = enrollmentsResult.data || [];
      const assignments = assignmentsResult.data || [];
      const feedbacks = feedbacksResult.data || [];
      const jobs = jobsResult.data || [];
      const weeks = weeksResult.data || [];

      // 3. 통계 계산
      const totalStudents = enrollments.length;
      const totalAssignments = assignments.length;
      const submittedAssignments = assignments.filter(a => a.status === 'submitted' || a.status === 'feedback_ready').length;
      const totalFeedbacks = feedbacks.length;
      const feedbackScores = feedbacks
        .map(f => (f.scores as { total: number } | null)?.total)
        .filter((s): s is number => s != null);
      const avgScore = feedbackScores.length > 0
        ? Math.round(feedbackScores.reduce((a, b) => a + b, 0) / feedbackScores.length * 10) / 10
        : null;
      const totalTokens = feedbacks.reduce(
        (sum, f) => sum + ((f.tokens_input as number) || 0) + ((f.tokens_output as number) || 0),
        0
      );
      const pendingJobs = jobs.filter(j => j.status === 'pending').length;
      const processingJobs = jobs.filter(j => j.status === 'processing').length;
      const failedJobs = jobs.filter(j => j.status === 'failed').length;

      // 4. 주차별 제출 현황
      const weekStats = weeks.map(week => {
        const weekAssignments = assignments.filter(a => a.week_id === week.id);
        const weekFeedbacks = feedbacks.filter(f => {
          const assignment = assignments.find(a => a.id === f.assignment_id);
          return assignment?.week_id === week.id;
        });
        const weekScores = weekFeedbacks
          .map(f => (f.scores as { total: number } | null)?.total)
          .filter((s): s is number => s != null);

        return {
          weekId: week.id,
          weekNumber: week.week_number,
          title: week.title,
          isActive: week.is_active,
          deadline: week.deadline,
          totalSubmissions: weekAssignments.length,
          feedbackCount: weekFeedbacks.length,
          avgScore: weekScores.length > 0
            ? Math.round(weekScores.reduce((a, b) => a + b, 0) / weekScores.length * 10) / 10
            : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          courses,
          selectedCourseId: targetCourseId,
          stats: {
            totalStudents,
            totalAssignments,
            submittedAssignments,
            totalFeedbacks,
            avgScore,
            totalTokens,
            pendingJobs,
            processingJobs,
            failedJobs,
          },
          weekStats,
          students: enrollments,
          assignments,
          feedbacks,
          jobs,
        },
      });
    } catch (error) {
      console.error('[LMS Admin Dashboard Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
