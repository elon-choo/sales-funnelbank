// src/app/api/lms/enrollments/route.ts
// 수강생 등록 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/enrollments - 내 수강 목록 (학생) 또는 전체 수강 목록 (관리자)
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
      // 관리자: 특정 기수의 전체 수강생 조회
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        let query = supabase
          .from('course_enrollments')
          .select(`
            id,
            user_id,
            course_id,
            status,
            email_opt_out,
            enrolled_at,
            completed_at,
            profiles (
              id,
              email,
              full_name
            ),
            courses (
              id,
              title,
              status
            )
          `, { count: 'exact' })
          .is('deleted_at', null)
          .order('enrolled_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (courseId) {
          query = query.eq('course_id', courseId);
        }

        if (status) {
          query = query.eq('status', status);
        }

        const { data: enrollments, error, count } = await query;

        if (error) {
          console.error('[Enrollments GET Admin Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '수강 목록 조회 실패' } },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: { enrollments, total: count, limit, offset },
        });
      }

      // 학생: 본인 수강 목록만 (API 레벨 권한 검증 - CTO-001 방안B)
      let query = supabase
        .from('course_enrollments')
        .select(`
          id,
          course_id,
          status,
          enrolled_at,
          completed_at,
          courses (
            id,
            title,
            description,
            status,
            total_weeks
          )
        `, { count: 'exact' })
        .eq('user_id', auth.userId)  // 핵심: API 레벨 user_id 필터
        .is('deleted_at', null)
        .order('enrolled_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: enrollments, error, count } = await query;

      if (error) {
        console.error('[Enrollments GET Student Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '수강 목록 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { enrollments, total: count, limit, offset },
      });
    } catch (error) {
      console.error('[Enrollments GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/enrollments - 수강생 등록 (관리자 전용)
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { userId, courseId, status = 'active' } = body;

      // 유효성 검증
      if (!userId || !courseId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'userId와 courseId는 필수입니다' } },
          { status: 400 }
        );
      }

      // 사용자 존재 확인
      const { data: user, error: userError } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '사용자를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 기수 존재 및 상태 확인
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title, status')
        .eq('id', courseId)
        .is('deleted_at', null)
        .single();

      if (courseError || !course) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '기수를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 중복 등록 확인
      const { data: existing } = await supabase
        .from('course_enrollments')
        .select('id, status')
        .eq('user_id', userId)
        .eq('course_id', courseId)
        .is('deleted_at', null)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE', message: '이미 등록된 수강생입니다', data: { enrollmentId: existing.id, status: existing.status } } },
          { status: 409 }
        );
      }

      // 수강 등록
      const { data: enrollment, error } = await supabase
        .from('course_enrollments')
        .insert({
          user_id: userId,
          course_id: courseId,
          status,
          enrolled_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('[Enrollment Create Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '수강 등록 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            enrollment: {
              ...enrollment,
              user,
              course,
            },
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Enrollment Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/enrollments - 수강 상태 일괄 변경 (관리자 전용)
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { enrollmentIds, status } = body;

      if (!enrollmentIds || !Array.isArray(enrollmentIds) || enrollmentIds.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'enrollmentIds 배열은 필수입니다' } },
          { status: 400 }
        );
      }

      if (!status || !['active', 'paused', 'completed', 'dropped'].includes(status)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 상태값입니다' } },
          { status: 400 }
        );
      }

      const updates: Record<string, unknown> = { status };
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { data: updated, error } = await supabase
        .from('course_enrollments')
        .update(updates)
        .in('id', enrollmentIds)
        .is('deleted_at', null)
        .select();

      if (error) {
        console.error('[Enrollment Batch Update Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '수강 상태 변경 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { updated: updated?.length || 0, enrollments: updated },
      });
    } catch (error) {
      console.error('[Enrollment Batch Update Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
