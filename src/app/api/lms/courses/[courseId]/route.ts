// src/app/api/lms/courses/[courseId]/route.ts
// 기수 상세 조회, 수정, 삭제 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

interface RouteParams {
  params: Promise<{ courseId: string }>;
}

// GET /api/lms/courses/[courseId] - 기수 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { courseId } = await params;

  return withLmsAuth(request, async (auth, supabase) => {
    try {
      // 관리자: 모든 기수 접근 가능
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        const { data: course, error } = await supabase
          .from('courses')
          .select(`
            *,
            course_weeks (
              id,
              week_number,
              title,
              assignment_type,
              deadline,
              is_active
            )
          `)
          .eq('id', courseId)
          .is('deleted_at', null)
          .single();

        if (error || !course) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_FOUND', message: '기수를 찾을 수 없습니다' } },
            { status: 404 }
          );
        }

        return NextResponse.json({ success: true, data: { course } });
      }

      // 학생: 등록된 기수만 조회 (API 레벨 권한 검증 - CTO-001 방안B)
      const { data: enrollment, error: enrollError } = await supabase
        .from('course_enrollments')
        .select('id, status')
        .eq('user_id', auth.userId)  // 핵심: API 레벨 user_id 필터
        .eq('course_id', courseId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .single();

      if (enrollError || !enrollment) {
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: '해당 기수에 등록되어 있지 않습니다' } },
          { status: 403 }
        );
      }

      const { data: course, error } = await supabase
        .from('courses')
        .select(`
          id,
          title,
          description,
          status,
          total_weeks,
          start_date,
          end_date,
          course_weeks (
            id,
            week_number,
            title,
            assignment_type,
            deadline,
            is_active
          )
        `)
        .eq('id', courseId)
        .is('deleted_at', null)
        .single();

      if (error || !course) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '기수를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          course,
          enrollment: {
            id: enrollment.id,
            status: enrollment.status,
          },
        },
      });
    } catch (error) {
      console.error('[Course Detail Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/courses/[courseId] - 기수 수정 (관리자 전용)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { courseId } = await params;

  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { title, description, status, totalWeeks, startDate, endDate } = body;

      // 업데이트할 필드만 추출
      const updates: Record<string, unknown> = {};

      if (title !== undefined) {
        if (typeof title !== 'string' || title.trim().length === 0) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: '기수 제목은 비어있을 수 없습니다' } },
            { status: 400 }
          );
        }
        updates.title = title.trim();
      }

      if (description !== undefined) {
        updates.description = description?.trim() || null;
      }

      if (status !== undefined) {
        if (!['draft', 'active', 'completed'].includes(status)) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 상태값입니다' } },
            { status: 400 }
          );
        }
        updates.status = status;
      }

      if (totalWeeks !== undefined) {
        if (typeof totalWeeks !== 'number' || totalWeeks < 1 || totalWeeks > 52) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: '총 주차는 1~52 사이여야 합니다' } },
            { status: 400 }
          );
        }
        updates.total_weeks = totalWeeks;
      }

      if (startDate !== undefined) {
        updates.start_date = startDate || null;
      }

      if (endDate !== undefined) {
        updates.end_date = endDate || null;
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '수정할 내용이 없습니다' } },
          { status: 400 }
        );
      }

      const { data: course, error } = await supabase
        .from('courses')
        .update(updates)
        .eq('id', courseId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        console.error('[Course Update Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '기수 수정 실패' } },
          { status: 500 }
        );
      }

      if (!course) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '기수를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: { course } });
    } catch (error) {
      console.error('[Course Update Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/courses/[courseId] - 기수 삭제 (관리자 전용, 소프트 삭제)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { courseId } = await params;

  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      // 활성 수강생이 있는지 확인
      const { count: activeEnrollments } = await supabase
        .from('course_enrollments')
        .select('id', { count: 'exact', head: true })
        .eq('course_id', courseId)
        .eq('status', 'active')
        .is('deleted_at', null);

      if (activeEnrollments && activeEnrollments > 0) {
        return NextResponse.json(
          { success: false, error: { code: 'CONSTRAINT_ERROR', message: `활성 수강생(${activeEnrollments}명)이 있어 삭제할 수 없습니다` } },
          { status: 400 }
        );
      }

      // 소프트 삭제
      const { data: course, error } = await supabase
        .from('courses')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', courseId)
        .is('deleted_at', null)
        .select()
        .single();

      if (error) {
        console.error('[Course Delete Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '기수 삭제 실패' } },
          { status: 500 }
        );
      }

      if (!course) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '기수를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      return NextResponse.json({ success: true, data: { deleted: true, courseId } });
    } catch (error) {
      console.error('[Course Delete Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
