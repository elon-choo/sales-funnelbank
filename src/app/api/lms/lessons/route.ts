// src/app/api/lms/lessons/route.ts
// 레슨(주차별 영상) CRUD API - GET: 목록, POST: 생성
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/lessons?weekId=xxx
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      const weekId = request.nextUrl.searchParams.get('weekId');

      if (!weekId) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'weekId가 필요합니다' } },
          { status: 400 }
        );
      }

      let query = supabase
        .from('week_lessons')
        .select('*')
        .eq('week_id', weekId)
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
      const { weekId, title, description, videoUrl, videoDuration, videoThumbnail, videoVisible } = body;

      if (!weekId || !title) {
        return NextResponse.json(
          { success: false, error: { code: 'BAD_REQUEST', message: 'weekId, title은 필수입니다' } },
          { status: 400 }
        );
      }

      // 주차 존재 확인
      const { data: week } = await supabase
        .from('course_weeks')
        .select('id')
        .eq('id', weekId)
        .is('deleted_at', null)
        .single();

      if (!week) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '주차를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 현재 최대 sort_order 가져오기
      const { data: maxSort } = await supabase
        .from('week_lessons')
        .select('sort_order')
        .eq('week_id', weekId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      const nextOrder = (maxSort?.sort_order ?? -1) + 1;

      const { data: lesson, error } = await supabase
        .from('week_lessons')
        .insert({
          week_id: weekId,
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
