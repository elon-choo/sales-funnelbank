// src/app/api/lms/video-progress/route.ts
// 영상 시청 진도 API (GET: 조회, PATCH: 업데이트)
// lesson_id 지원: 레슨 기반 진도 추적 (하위호환: 기존 week_id 기반도 유지)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

// GET /api/lms/video-progress?weekId=xxx[&lessonId=xxx]
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      const weekId = request.nextUrl.searchParams.get('weekId');
      const lessonId = request.nextUrl.searchParams.get('lessonId');

      if (!weekId) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'weekId가 필요합니다' } },
          { status: 400 }
        );
      }

      // lessonId가 있으면 레슨별 진도 조회
      if (lessonId) {
        const { data: progress } = await supabase
          .from('video_progress')
          .select('*')
          .eq('user_id', auth.userId)
          .eq('week_id', weekId)
          .eq('lesson_id', lessonId)
          .single();

        return NextResponse.json({
          success: true,
          data: { progress: progress || null },
        });
      }

      // lessonId 없으면 주차의 모든 진도 조회 (기존 호환 + 레슨별)
      const { data: progressList } = await supabase
        .from('video_progress')
        .select('*')
        .eq('user_id', auth.userId)
        .eq('week_id', weekId);

      // 기존 방식(lesson_id=null)과 레슨별 진도를 분리
      const legacyProgress = (progressList || []).find(p => !p.lesson_id);
      const lessonProgressList = (progressList || []).filter(p => p.lesson_id);

      // 레슨별 매핑
      const lessonProgressMap: Record<string, {
        lessonId: string;
        watchPercentage: number;
        isCompleted: boolean;
        lastPosition: number;
        watchedSeconds: number;
      }> = {};

      lessonProgressList.forEach((p: Record<string, unknown>) => {
        lessonProgressMap[p.lesson_id as string] = {
          lessonId: p.lesson_id as string,
          watchPercentage: (p.watch_percentage as number) || 0,
          isCompleted: (p.is_completed as boolean) || false,
          lastPosition: (p.last_position as number) || 0,
          watchedSeconds: (p.watched_seconds as number) || 0,
        };
      });

      return NextResponse.json({
        success: true,
        data: {
          progress: legacyProgress || null,
          lessonProgress: lessonProgressMap,
        },
      });
    } catch (error) {
      console.error('[Video Progress GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/video-progress - 시청 위치 업데이트 (5초 간격 저장)
export async function PATCH(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { weekId, courseId, currentTime, duration, isCompleted, lessonId } = body;

      if (!weekId || !courseId) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'weekId, courseId가 필요합니다' } },
          { status: 400 }
        );
      }

      const currentTimeInt = Math.floor(currentTime || 0);
      const durationInt = Math.floor(duration || 0);
      const watchPercentage = durationInt > 0 ? Math.min(100, Math.round((currentTimeInt / durationInt) * 100)) : 0;
      const completed = isCompleted || watchPercentage >= 90;

      // 레슨 기반 or 기존 주차 기반 UPSERT
      let existingQuery = supabase
        .from('video_progress')
        .select('id, watched_seconds, is_completed, completed_at')
        .eq('user_id', auth.userId)
        .eq('week_id', weekId);

      if (lessonId) {
        existingQuery = existingQuery.eq('lesson_id', lessonId);
      } else {
        existingQuery = existingQuery.is('lesson_id', null);
      }

      const { data: existing } = await existingQuery.single();

      if (existing) {
        // UPDATE
        const newWatchedSeconds = Math.max(existing.watched_seconds || 0, currentTimeInt);

        const updateData: Record<string, unknown> = {
          last_position: currentTimeInt,
          total_seconds: durationInt,
          watched_seconds: newWatchedSeconds,
          watch_percentage: watchPercentage,
          updated_at: new Date().toISOString(),
        };

        if (completed && !existing.is_completed) {
          updateData.is_completed = true;
          updateData.completed_at = new Date().toISOString();
        }

        const { error } = await supabase
          .from('video_progress')
          .update(updateData)
          .eq('id', existing.id);

        if (error) {
          console.error('[Video Progress Update Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '진도 저장 실패' } },
            { status: 500 }
          );
        }
      } else {
        // INSERT
        const insertData: Record<string, unknown> = {
          user_id: auth.userId,
          week_id: weekId,
          course_id: courseId,
          last_position: currentTimeInt,
          total_seconds: durationInt,
          watched_seconds: currentTimeInt,
          watch_percentage: watchPercentage,
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        };

        if (lessonId) {
          insertData.lesson_id = lessonId;
        }

        const { error } = await supabase
          .from('video_progress')
          .insert(insertData);

        if (error) {
          console.error('[Video Progress Insert Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '진도 저장 실패' } },
            { status: 500 }
          );
        }
      }

      return NextResponse.json({
        success: true,
        data: { saved: true, watchPercentage, isCompleted: completed },
      });
    } catch (error) {
      console.error('[Video Progress PATCH Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
