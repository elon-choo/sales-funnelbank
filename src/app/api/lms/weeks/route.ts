// src/app/api/lms/weeks/route.ts
// 주차 관리 API (관리자: CRUD, 학생: 조회)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/weeks - 주차 목록 조회
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    if (!courseId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'courseId는 필수입니다' } },
        { status: 400 }
      );
    }

    try {
      // 관리자: 모든 주차 조회 (비활성 포함 가능)
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        let query = supabase
          .from('course_weeks')
          .select(`
            id,
            course_id,
            week_number,
            title,
            description,
            is_active,
            unlock_date,
            deadline,
            assignment_type,
            max_score,
            created_at,
            updated_at
          `)
          .eq('course_id', courseId)
          .is('deleted_at', null)
          .order('week_number', { ascending: true });

        if (!includeInactive) {
          query = query.eq('is_active', true);
        }

        const { data: weeks, error } = await query;

        if (error) {
          console.error('[Weeks GET Admin Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '주차 목록 조회 실패' } },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          data: { weeks, total: weeks?.length || 0 },
        });
      }

      // 학생: 등록 여부 확인 후 활성 주차만 조회
      const { data: enrollment } = await supabase
        .from('course_enrollments')
        .select('id, status')
        .eq('course_id', courseId)
        .eq('user_id', auth.userId)  // CTO-001 방안B: API 레벨 권한 검증
        .eq('status', 'active')
        .is('deleted_at', null)
        .single();

      if (!enrollment) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_ENROLLED', message: '해당 기수에 등록되어 있지 않습니다' } },
          { status: 403 }
        );
      }

      // 활성 주차만 조회 (unlock_date 이후)
      const { data: weeks, error } = await supabase
        .from('course_weeks')
        .select(`
          id,
          course_id,
          week_number,
          title,
          description,
          is_active,
          unlock_date,
          deadline,
          assignment_type,
          max_score
        `)
        .eq('course_id', courseId)
        .eq('is_active', true)
        .is('deleted_at', null)
        .lte('unlock_date', new Date().toISOString())  // 잠금 해제된 주차만
        .order('week_number', { ascending: true });

      if (error) {
        console.error('[Weeks GET Student Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '주차 목록 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { weeks, total: weeks?.length || 0 },
      });
    } catch (error) {
      console.error('[Weeks GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/weeks - 주차 생성 (관리자 전용)
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const {
        courseId,
        weekNumber,
        title,
        description,
        isActive = false,
        unlockDate,
        deadline,
        assignmentType = 'script',
        maxScore = 100,
      } = body;

      // 유효성 검증
      if (!courseId || !weekNumber || !title) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'courseId, weekNumber, title은 필수입니다' } },
          { status: 400 }
        );
      }

      if (weekNumber < 1 || weekNumber > 52) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '주차 번호는 1-52 사이여야 합니다' } },
          { status: 400 }
        );
      }

      // 기수 존재 확인
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title')
        .eq('id', courseId)
        .is('deleted_at', null)
        .single();

      if (courseError || !course) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '기수를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 중복 주차 번호 확인
      const { data: existing } = await supabase
        .from('course_weeks')
        .select('id')
        .eq('course_id', courseId)
        .eq('week_number', weekNumber)
        .is('deleted_at', null)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE', message: `${weekNumber}주차가 이미 존재합니다` } },
          { status: 409 }
        );
      }

      // 주차 생성
      const { data: week, error } = await supabase
        .from('course_weeks')
        .insert({
          course_id: courseId,
          week_number: weekNumber,
          title,
          description,
          is_active: isActive,
          unlock_date: unlockDate || new Date().toISOString(),
          deadline: deadline || null,
          assignment_type: assignmentType,
          max_score: maxScore,
        })
        .select()
        .single();

      if (error) {
        console.error('[Week Create Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '주차 생성 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: { week, course },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Week Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/weeks - 주차 일괄 활성화/비활성화 (관리자 전용)
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { weekIds, isActive } = body;

      if (!weekIds || !Array.isArray(weekIds) || weekIds.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'weekIds 배열은 필수입니다' } },
          { status: 400 }
        );
      }

      if (typeof isActive !== 'boolean') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'isActive는 boolean이어야 합니다' } },
          { status: 400 }
        );
      }

      const { data: updated, error } = await supabase
        .from('course_weeks')
        .update({ is_active: isActive })
        .in('id', weekIds)
        .is('deleted_at', null)
        .select();

      if (error) {
        console.error('[Week Batch Update Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '주차 상태 변경 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { updated: updated?.length || 0, weeks: updated },
      });
    } catch (error) {
      console.error('[Week Batch Update Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
