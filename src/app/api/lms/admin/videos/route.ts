// src/app/api/lms/admin/videos/route.ts
// 관리자 영상 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/admin/videos - 전체 주차 영상 목록
export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const { data: weeks, error } = await supabase
        .from('course_weeks')
        .select(`
          id,
          course_id,
          week_number,
          title,
          video_url,
          video_title,
          video_duration,
          video_thumbnail,
          video_visible,
          is_active,
          courses ( title )
        `)
        .is('deleted_at', null)
        .order('week_number', { ascending: true });

      if (error) {
        console.error('[Admin Videos GET Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '영상 목록 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { weeks: weeks || [] },
      });
    } catch (error) {
      console.error('[Admin Videos GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/admin/videos - 영상 공개/비공개 토글
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { weekId, videoVisible, videoUrl, videoTitle, videoDuration, videoThumbnail } = body;

      if (!weekId) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'weekId가 필요합니다' } },
          { status: 400 }
        );
      }

      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (videoVisible !== undefined) updateData.video_visible = videoVisible;
      if (videoUrl !== undefined) updateData.video_url = videoUrl;
      if (videoTitle !== undefined) updateData.video_title = videoTitle;
      if (videoDuration !== undefined) updateData.video_duration = videoDuration;
      if (videoThumbnail !== undefined) updateData.video_thumbnail = videoThumbnail;

      const { error } = await supabase
        .from('course_weeks')
        .update(updateData)
        .eq('id', weekId);

      if (error) {
        console.error('[Admin Videos PATCH Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '영상 정보 업데이트 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { updated: true },
      });
    } catch (error) {
      console.error('[Admin Videos PATCH Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
