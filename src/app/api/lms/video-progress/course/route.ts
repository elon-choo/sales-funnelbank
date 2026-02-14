// src/app/api/lms/video-progress/course/route.ts
// 코스 전체 영상 시청 현황 API (대시보드/주차 목록용)
// 레슨 기반 진도 집계 지원
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

// GET /api/lms/video-progress/course?courseId=xxx
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      const courseId = request.nextUrl.searchParams.get('courseId');
      const userId = request.nextUrl.searchParams.get('userId');

      if (!courseId) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'courseId가 필요합니다' } },
          { status: 400 }
        );
      }

      // admin은 다른 유저 조회 가능
      const targetUserId = (auth.lmsRole === 'admin' && userId) ? userId : auth.userId;

      const { data: progressList, error } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', targetUserId)
        .eq('course_id', courseId);

      if (error) {
        console.error('[Video Progress Course Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '조회 실패' } },
          { status: 500 }
        );
      }

      // 레슨 데이터 가져오기 (코스의 모든 주차의 레슨)
      const { data: courseWeeks } = await supabase
        .from('course_weeks')
        .select('id')
        .eq('course_id', courseId)
        .is('deleted_at', null);

      const weekIds = (courseWeeks || []).map((w: { id: string }) => w.id);

      let lessonsMap: Record<string, Array<{ id: string; week_id: string }>> = {};

      if (weekIds.length > 0) {
        const { data: lessons } = await supabase
          .from('week_lessons')
          .select('id, week_id')
          .in('week_id', weekIds)
          .eq('video_visible', true)
          .is('deleted_at', null);

        (lessons || []).forEach((l: { id: string; week_id: string }) => {
          if (!lessonsMap[l.week_id]) lessonsMap[l.week_id] = [];
          lessonsMap[l.week_id].push(l);
        });
      }

      // 기존 주차별 매핑 (lesson_id=null인 레코드)
      const progressByWeek: Record<string, {
        weekId: string;
        watchPercentage: number;
        isCompleted: boolean;
        lastPosition: number;
        totalSeconds: number;
        watchedSeconds: number;
        lessonCount: number;
        lessonCompleted: number;
      }> = {};

      // 레슨별 진도 매핑 (lesson_id != null)
      const lessonProgressMap: Record<string, {
        watchPercentage: number;
        isCompleted: boolean;
      }> = {};

      (progressList || []).forEach((p: Record<string, unknown>) => {
        if (p.lesson_id) {
          // 레슨별 진도
          lessonProgressMap[p.lesson_id as string] = {
            watchPercentage: (p.watch_percentage as number) || 0,
            isCompleted: (p.is_completed as boolean) || false,
          };
        } else {
          // 기존 주차별 진도 (레슨 0개인 주차용)
          progressByWeek[p.week_id as string] = {
            weekId: p.week_id as string,
            watchPercentage: (p.watch_percentage as number) || 0,
            isCompleted: (p.is_completed as boolean) || false,
            lastPosition: (p.last_position as number) || 0,
            totalSeconds: (p.total_seconds as number) || 0,
            watchedSeconds: (p.watched_seconds as number) || 0,
            lessonCount: 0,
            lessonCompleted: 0,
          };
        }
      });

      // 레슨이 있는 주차: 레슨별 진도를 집계하여 주차 진도 계산
      for (const [weekId, lessons] of Object.entries(lessonsMap)) {
        if (lessons.length === 0) continue;

        const completedLessons = lessons.filter(l => lessonProgressMap[l.id]?.isCompleted).length;
        const totalPercentage = lessons.reduce((sum, l) => sum + (lessonProgressMap[l.id]?.watchPercentage || 0), 0);
        const avgPercentage = Math.round(totalPercentage / lessons.length);
        const allCompleted = completedLessons === lessons.length;

        progressByWeek[weekId] = {
          weekId,
          watchPercentage: avgPercentage,
          isCompleted: allCompleted,
          lastPosition: 0,
          totalSeconds: 0,
          watchedSeconds: 0,
          lessonCount: lessons.length,
          lessonCompleted: completedLessons,
        };
      }

      // 통계
      const allWeekEntries = Object.values(progressByWeek);
      const totalWeeksWithVideo = allWeekEntries.length;
      const completedCount = allWeekEntries.filter(p => p.isCompleted).length;
      const totalWatchedSeconds = (progressList || []).reduce(
        (sum: number, p: Record<string, unknown>) => sum + ((p.watched_seconds as number) || 0), 0
      );

      return NextResponse.json({
        success: true,
        data: {
          progressByWeek,
          stats: {
            totalWeeksWithVideo,
            completedCount,
            totalWatchedSeconds,
            completionRate: totalWeeksWithVideo > 0 ? Math.round((completedCount / totalWeeksWithVideo) * 100) : 0,
          },
        },
      });
    } catch (error) {
      console.error('[Video Progress Course Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
