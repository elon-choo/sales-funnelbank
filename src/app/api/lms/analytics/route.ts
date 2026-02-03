// src/app/api/lms/analytics/route.ts
// 수강생 분석 대시보드 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/analytics - 수강생 분석 데이터 조회
export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const dateFrom = searchParams.get('from');
    const dateTo = searchParams.get('to');

    try {
      // 기본 날짜 범위: 최근 30일
      const from = dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const to = dateTo || new Date().toISOString();

      // 1. 수강생 현황
      let enrollmentQuery = supabase
        .from('course_enrollments')
        .select(`
          id,
          status,
          enrolled_at,
          user_id,
          course_id
        `)
        .is('deleted_at', null);

      if (courseId) {
        enrollmentQuery = enrollmentQuery.eq('course_id', courseId);
      }

      const { data: enrollments } = await enrollmentQuery;

      const enrollmentStats = {
        total: enrollments?.length || 0,
        active: enrollments?.filter((e) => e.status === 'active').length || 0,
        completed: enrollments?.filter((e) => e.status === 'completed').length || 0,
        paused: enrollments?.filter((e) => e.status === 'paused').length || 0,
        dropped: enrollments?.filter((e) => e.status === 'dropped').length || 0,
      };

      // 2. 제출률 분석
      let assignmentQuery = supabase
        .from('assignments')
        .select(`
          id,
          user_id,
          course_id,
          week_id,
          status,
          submitted_at,
          created_at
        `)
        .is('deleted_at', null)
        .gte('created_at', from)
        .lte('created_at', to);

      if (courseId) {
        assignmentQuery = assignmentQuery.eq('course_id', courseId);
      }

      const { data: assignments } = await assignmentQuery;

      const submissionStats = {
        total: assignments?.length || 0,
        submitted: assignments?.filter((a) => a.status === 'submitted' || a.status === 'reviewed').length || 0,
        draft: assignments?.filter((a) => a.status === 'draft').length || 0,
      };

      // 일별 제출 추이
      const dailySubmissions = assignments
        ?.filter((a) => a.submitted_at)
        .reduce((acc, a) => {
          const date = a.submitted_at!.split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>) || {};

      // 3. 피드백 분석
      let feedbackQuery = supabase
        .from('feedbacks')
        .select(`
          id,
          user_id,
          course_id,
          week_id,
          score,
          status,
          ai_model,
          cost_usd,
          tokens_input,
          tokens_output,
          generation_time_ms,
          created_at
        `)
        .is('deleted_at', null)
        .gte('created_at', from)
        .lte('created_at', to);

      if (courseId) {
        feedbackQuery = feedbackQuery.eq('course_id', courseId);
      }

      const { data: feedbacks } = await feedbackQuery;

      // 점수 분포
      const scores = feedbacks?.map((f) => f.score).filter((s): s is number => s !== null) || [];
      const scoreDistribution = {
        excellent: scores.filter((s) => s >= 90).length,
        good: scores.filter((s) => s >= 80 && s < 90).length,
        average: scores.filter((s) => s >= 70 && s < 80).length,
        belowAverage: scores.filter((s) => s >= 60 && s < 70).length,
        poor: scores.filter((s) => s < 60).length,
      };

      const averageScore = scores.length > 0
        ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
        : null;

      // 4. 주차별 분석
      const weeklyStats: Record<string, {
        weekId: string;
        submissions: number;
        avgScore: number | null;
        completionRate: number;
      }> = {};

      // 주차 정보 조회
      let weekQuery = supabase
        .from('course_weeks')
        .select('id, week_number, course_id')
        .is('deleted_at', null);

      if (courseId) {
        weekQuery = weekQuery.eq('course_id', courseId);
      }

      const { data: weeks } = await weekQuery;

      weeks?.forEach((week) => {
        const weekAssignments = assignments?.filter((a) => a.week_id === week.id) || [];
        const weekFeedbacks = feedbacks?.filter((f) => f.week_id === week.id) || [];
        const weekScores = weekFeedbacks.map((f) => f.score).filter((s): s is number => s !== null);

        weeklyStats[week.id] = {
          weekId: week.id,
          submissions: weekAssignments.filter((a) => a.status !== 'draft').length,
          avgScore: weekScores.length > 0
            ? Math.round((weekScores.reduce((a, b) => a + b, 0) / weekScores.length) * 10) / 10
            : null,
          completionRate: enrollmentStats.active > 0
            ? Math.round((weekAssignments.filter((a) => a.status !== 'draft').length / enrollmentStats.active) * 100)
            : 0,
        };
      });

      // 5. 활동 분석
      const activeUserIds = new Set(
        assignments?.filter((a) => a.submitted_at).map((a) => a.user_id) || []
      );
      const inactiveCount = enrollmentStats.active - activeUserIds.size;

      // 6. AI 비용 분석
      const totalCost = feedbacks?.reduce((sum, f) => sum + (f.cost_usd || 0), 0) || 0;
      const totalTokens = feedbacks?.reduce((sum, f) => sum + (f.tokens_input || 0) + (f.tokens_output || 0), 0) || 0;
      const avgGenerationTime = feedbacks && feedbacks.length > 0
        ? Math.round(feedbacks.reduce((sum, f) => sum + (f.generation_time_ms || 0), 0) / feedbacks.length)
        : 0;

      const modelUsage = feedbacks?.reduce((acc, f) => {
        const model = f.ai_model || 'unknown';
        if (!acc[model]) {
          acc[model] = { count: 0, cost: 0 };
        }
        acc[model].count++;
        acc[model].cost += f.cost_usd || 0;
        return acc;
      }, {} as Record<string, { count: number; cost: number }>) || {};

      // 7. 수강생별 성과 (Top 10)
      const userPerformance = Object.entries(
        feedbacks?.reduce((acc, f) => {
          if (!acc[f.user_id]) {
            acc[f.user_id] = { scores: [], submissions: 0 };
          }
          if (f.score) acc[f.user_id].scores.push(f.score);
          acc[f.user_id].submissions++;
          return acc;
        }, {} as Record<string, { scores: number[]; submissions: number }>) || {}
      )
        .map(([userId, data]) => ({
          userId,
          avgScore: data.scores.length > 0
            ? Math.round((data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 10) / 10
            : 0,
          feedbackCount: data.submissions,
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 10);

      return NextResponse.json({
        success: true,
        data: {
          dateRange: { from, to },
          enrollmentStats,
          submissionStats,
          dailySubmissions,
          scoreDistribution,
          averageScore,
          weeklyStats: Object.values(weeklyStats),
          activityStats: {
            activeUsers: activeUserIds.size,
            inactiveUsers: inactiveCount,
            activityRate: enrollmentStats.active > 0
              ? Math.round((activeUserIds.size / enrollmentStats.active) * 100)
              : 0,
          },
          costStats: {
            totalCost: Math.round(totalCost * 100) / 100,
            totalTokens,
            avgGenerationTime,
            modelUsage,
            feedbackCount: feedbacks?.length || 0,
            avgCostPerFeedback: feedbacks && feedbacks.length > 0
              ? Math.round((totalCost / feedbacks.length) * 100) / 100
              : 0,
          },
          topPerformers: userPerformance,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('[Analytics GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
