// src/app/api/lms/lessons/[lessonId]/route.ts
// 개별 레슨 PATCH/DELETE (관리자 전용)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// PATCH /api/lms/lessons/[lessonId] - 레슨 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const { lessonId } = await params;
      const body = await request.json();
      const { title, description, videoUrl, videoDuration, videoThumbnail, videoVisible, sortOrder } = body;

      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (videoUrl !== undefined) updateData.video_url = videoUrl;
      if (videoDuration !== undefined) updateData.video_duration = videoDuration;
      if (videoThumbnail !== undefined) updateData.video_thumbnail = videoThumbnail;
      if (videoVisible !== undefined) updateData.video_visible = videoVisible;
      if (sortOrder !== undefined) updateData.sort_order = sortOrder;

      const { data: lesson, error } = await supabase
        .from('week_lessons')
        .update(updateData)
        .eq('id', lessonId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        console.error('[Lesson PATCH Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '레슨 수정 실패' } },
          { status: 500 }
        );
      }

      if (!lesson) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '레슨을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { lesson },
      });
    } catch (error) {
      console.error('[Lesson PATCH Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/lessons/[lessonId] - 레슨 소프트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ lessonId: string }> }
) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const { lessonId } = await params;

      const { error } = await supabase
        .from('week_lessons')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', lessonId)
        .is('deleted_at', null);

      if (error) {
        console.error('[Lesson DELETE Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '레슨 삭제 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      console.error('[Lesson DELETE Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
