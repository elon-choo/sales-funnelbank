// src/app/api/lms/lessons/route.ts
// 레슨(주차별 영상) CRUD API - GET: 목록, POST: 생성
// 핵심: courseId + weekNumber로 "진짜 주차" 단위 매핑 (course_weeks.id가 아님)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/lessons?courseId=xxx&weekNumber=1
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      const courseId = request.nextUrl.searchParams.get('courseId');
      const weekNumber = request.nextUrl.searchParams.get('weekNumber');

      if (!courseId || !weekNumber) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'courseId, weekNumber가 필요합니다' } },
          { status: 400 }
        );
      }

      let query = supabase
        .from('week_lessons')
        .select('*')
        .eq('course_id', courseId)
        .eq('week_number', parseInt(weekNumber))
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      // 학생은 공개 레슨만 조회
      if (auth.lmsRole !== 'admin') {
        query = query.eq('video_visible', true);
      }

      const { data: lessons, error } = await query;

      if (error) {
        console.error('[Lessons GET Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '레슨 목록 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { lessons: lessons || [] },
      });
    } catch (error) {
      console.error('[Lessons GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/lessons - 레슨 생성 (관리자 전용)
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { courseId, weekNumber, title, description, videoUrl, videoDuration, videoThumbnail, videoVisible } = body;

      if (!courseId || !weekNumber || !title) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'courseId, weekNumber, title은 필수입니다' } },
          { status: 400 }
        );
      }

      // 현재 최대 sort_order 가져오기
      const { data: maxSort } = await supabase
        .from('week_lessons')
        .select('sort_order')
        .eq('course_id', courseId)
        .eq('week_number', weekNumber)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxSort?.sort_order ?? -1) + 1;

      const { data: lesson, error } = await supabase
        .from('week_lessons')
        .insert({
          course_id: courseId,
          week_number: weekNumber,
          title,
          description: description || null,
          video_url: videoUrl || null,
          video_duration: videoDuration || null,
          video_thumbnail: videoThumbnail || null,
          video_visible: videoVisible !== undefined ? videoVisible : true,
          sort_order: nextOrder,
        })
        .select()
        .single();

      if (error) {
        console.error('[Lesson Create Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '레슨 생성 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: true, data: { lesson } },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Lesson Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
