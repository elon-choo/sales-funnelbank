// src/app/api/lms/video-progress/course/route.ts
// 코스 전체 시청 현황 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    try {
      let query = supabase.from('video_progress').select('week_id, watch_percentage, is_completed, last_position, total_seconds').eq('user_id', auth.userId);
      if (courseId) query = query.eq('course_id', courseId);

      const { data } = await query;
      const progressMap: Record<string, { percentage: number; completed: boolean; position: number; duration: number }> = {};
      for (const p of data || []) {
        progressMap[p.week_id] = {
          percentage: p.watch_percentage || 0,
          completed: p.is_completed || false,
          position: p.last_position || 0,
          duration: p.total_seconds || 0,
        };
      }

      const total = Object.keys(progressMap).length;
      const completed = Object.values(progressMap).filter(p => p.completed).length;
      const avgPercentage = total > 0 ? Math.round(Object.values(progressMap).reduce((s, p) => s + p.percentage, 0) / total) : 0;

      return NextResponse.json({
        success: true,
        data: { progressMap, stats: { total, completed, avgPercentage } },
      });
    } catch (error) {
      console.error('[VideoProgress Course GET]', error);
      return NextResponse.json({ success: false, error: { message: '조회 실패' } }, { status: 500 });
    }
  });
}
