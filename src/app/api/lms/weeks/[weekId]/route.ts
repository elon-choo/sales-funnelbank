// src/app/api/lms/weeks/[weekId]/route.ts
// 개별 주차 조회/수정/삭제 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

interface RouteParams {
  params: Promise<{ weekId: string }>;
}

// GET /api/lms/weeks/[weekId] - 주차 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { weekId } = await params;

  return withLmsAuth(request, async (auth, supabase) => {
    try {
      // 주차 정보 조회
      const { data: week, error } = await supabase
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
          updated_at,
          courses (id, title, status)
        `)
        .eq('id', weekId)
        .is('deleted_at', null)
        .single();

      if (error || !week) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '주차를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 관리자가 아닌 경우 등록 확인
      if (auth.lmsRole !== 'admin' && auth.tier !== 'ENTERPRISE') {
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('course_id', week.course_id)
          .eq('user_id', auth.userId)  // CTO-001 방안B
          .eq('status', 'active')
          .is('deleted_at', null)
          .single();

        if (!enrollment) {
          return NextResponse.json(
            { success: false, error: { code: 'NOT_ENROLLED', message: '해당 기수에 등록되어 있지 않습니다' } },
            { status: 403 }
          );
        }

        // 비활성 또는 미공개 주차 접근 불가
        if (!week.is_active || new Date(week.unlock_date) > new Date()) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: '아직 공개되지 않은 주차입니다' } },
            { status: 403 }
          );
        }
      }

      // 과제 설정 정보 조회
      const { data: assignmentConfig } = await supabase
        .from('week_assignment_configs')
        .select('*')
        .eq('week_id', weekId)
        .is('deleted_at', null)
        .single();

      // 관리자: 해당 주차의 과제 통계
      let stats = null;
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        const { data: assignmentStats } = await supabase
          .from('assignments')
          .select('id, status')
          .eq('week_id', weekId)
          .is('deleted_at', null);

        if (assignmentStats) {
          stats = {
            total: assignmentStats.length,
            draft: assignmentStats.filter((a) => a.status === 'draft').length,
            submitted: assignmentStats.filter((a) => a.status === 'submitted').length,
            reviewed: assignmentStats.filter((a) => a.status === 'reviewed').length,
          };
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          week,
          assignmentConfig,
          stats,
        },
      });
    } catch (error) {
      console.error('[Week GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/weeks/[weekId] - 주차 수정 (관리자 전용)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { weekId } = await params;

  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const {
        title,
        description,
        isActive,
        unlockDate,
        deadline,
        assignmentType,
        maxScore,
      } = body;

      // 주차 존재 확인
      const { data: existing, error: findError } = await supabase
        .from('course_weeks')
        .select('id, course_id, week_number')
        .eq('id', weekId)
        .is('deleted_at', null)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '주차를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 업데이트할 필드 구성
      const updates: Record<string, unknown> = {};
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (isActive !== undefined) updates.is_active = isActive;
      if (unlockDate !== undefined) updates.unlock_date = unlockDate;
      if (deadline !== undefined) updates.deadline = deadline;
      if (assignmentType !== undefined) updates.assignment_type = assignmentType;
      if (maxScore !== undefined) updates.max_score = maxScore;

      if (Object.keys(updates).length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '수정할 내용이 없습니다' } },
          { status: 400 }
        );
      }

      const { data: week, error } = await supabase
        .from('course_weeks')
        .update(updates)
        .eq('id', weekId)
        .select()
        .single();

      if (error) {
        console.error('[Week Update Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '주차 수정 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { week },
      });
    } catch (error) {
      console.error('[Week Update Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/weeks/[weekId] - 주차 삭제 (관리자 전용, 소프트 삭제)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { weekId } = await params;

  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      // 주차 존재 확인
      const { data: existing, error: findError } = await supabase
        .from('course_weeks')
        .select('id, course_id, week_number, title')
        .eq('id', weekId)
        .is('deleted_at', null)
        .single();

      if (findError || !existing) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '주차를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 제출된 과제가 있는지 확인
      const { data: assignments, error: assignmentError } = await supabase
        .from('assignments')
        .select('id')
        .eq('week_id', weekId)
        .is('deleted_at', null)
        .limit(1);

      if (!assignmentError && assignments && assignments.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'HAS_ASSIGNMENTS',
              message: '제출된 과제가 있는 주차는 삭제할 수 없습니다',
              data: { assignmentCount: assignments.length },
            },
          },
          { status: 409 }
        );
      }

      // 소프트 삭제
      const { error } = await supabase
        .from('course_weeks')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', weekId);

      if (error) {
        console.error('[Week Delete Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '주차 삭제 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          deleted: true,
          week: { id: existing.id, weekNumber: existing.week_number, title: existing.title },
        },
      });
    } catch (error) {
      console.error('[Week Delete Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
