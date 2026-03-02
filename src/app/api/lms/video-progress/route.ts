// src/app/api/lms/video-progress/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    try {
      if (weekId) {
        const { data } = await supabase.from('video_progress').select('*').eq('user_id', auth.userId).eq('week_id', weekId).maybeSingle();
        return NextResponse.json({ success: true, data: { progress: data } });
      }
      const { data } = await supabase.from('video_progress').select('*').eq('user_id', auth.userId).order('updated_at', { ascending: false });
      return NextResponse.json({ success: true, data: { progress: data || [] } });
    } catch (error) {
      console.error('[VideoProgress GET]', error);
      return NextResponse.json({ success: false, error: { message: '조회 실패' } }, { status: 500 });
    }
  });
}

export async function PATCH(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      const { weekId, courseId, currentTime, duration } = await request.json();
      if (!weekId) return NextResponse.json({ success: false, error: { message: 'weekId 필수' } }, { status: 400 });

      const watchedSeconds = Math.floor(currentTime || 0);
      const totalSeconds = Math.floor(duration || 0);
      const percentage = totalSeconds > 0 ? Math.min(100, Math.round((watchedSeconds / totalSeconds) * 100)) : 0;
      const isCompleted = percentage >= 90;

      // Get course_id from week if not provided
      let resolvedCourseId = courseId;
      if (!resolvedCourseId) {
        const { data: weekData } = await supabase.from('course_weeks').select('course_id').eq('id', weekId).single();
        resolvedCourseId = weekData?.course_id || null;
      }

      const { data: existing } = await supabase.from('video_progress').select('id, is_completed').eq('user_id', auth.userId).eq('week_id', weekId).maybeSingle();

      if (existing) {
        const updateData: Record<string, unknown> = {
          watched_seconds: watchedSeconds, total_seconds: totalSeconds,
          last_position: watchedSeconds, watch_percentage: percentage,
          updated_at: new Date().toISOString(),
        };
        if (isCompleted && !existing.is_completed) {
          updateData.is_completed = true;
          updateData.completed_at = new Date().toISOString();
        }
        const { error: updateErr } = await supabase.from('video_progress').update(updateData).eq('id', existing.id);
        if (updateErr) console.error('[VideoProgress] Update error:', updateErr.message);
      } else {
        const { error: insertErr } = await supabase.from('video_progress').insert({
          user_id: auth.userId, week_id: weekId, course_id: resolvedCourseId,
          watched_seconds: watchedSeconds, total_seconds: totalSeconds,
          last_position: watchedSeconds, watch_percentage: percentage,
          is_completed: isCompleted, completed_at: isCompleted ? new Date().toISOString() : null,
        });
        if (insertErr) console.error('[VideoProgress] Insert error:', insertErr.message);
      }

      return NextResponse.json({ success: true, data: { watchedSeconds, totalSeconds, percentage, isCompleted } });
    } catch (error) {
      console.error('[VideoProgress PATCH]', error);
      return NextResponse.json({ success: false, error: { message: '저장 실패' } }, { status: 500 });
    }
  });
}
