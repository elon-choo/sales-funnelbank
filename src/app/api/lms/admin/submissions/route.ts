// src/app/api/lms/admin/submissions/route.ts
// 관리자: 수강생별 제출 횟수 제한 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// PATCH /api/lms/admin/submissions - 제출 횟수 제한 수정 (전체 또는 주차별)
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { enrollmentId, userId, courseId, maxSubmissionsPerWeek, weekId, weekLimit } = body;

      // Determine target enrollment
      let targetId = enrollmentId;
      if (!targetId && userId && courseId) {
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .single();
        targetId = enrollment?.id;
      }

      if (!targetId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'enrollmentId 또는 userId+courseId가 필요합니다' } },
          { status: 400 }
        );
      }

      // Case 1: Per-week override (weekId + weekLimit)
      if (weekId && weekLimit !== undefined) {
        const limit = parseInt(String(weekLimit));
        if (isNaN(limit) || limit < 0 || limit > 999) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: '제출 횟수는 0~999 사이의 숫자여야 합니다 (0 = 기본값 사용)' } },
            { status: 400 }
          );
        }

        // Get current overrides
        const { data: current } = await supabase
          .from('course_enrollments')
          .select('week_submission_overrides')
          .eq('id', targetId)
          .single();

        const overrides = (current?.week_submission_overrides as Record<string, number>) || {};

        if (limit === 0) {
          // Remove override (use default)
          delete overrides[weekId];
        } else {
          overrides[weekId] = limit;
        }

        const { data, error } = await supabase
          .from('course_enrollments')
          .update({ week_submission_overrides: overrides })
          .eq('id', targetId)
          .select('id, user_id, course_id, max_submissions_per_week, week_submission_overrides, profiles(email, full_name)')
          .single();

        if (error) {
          console.error('[Submissions PATCH Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '업데이트 실패' } },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data });
      }

      // Case 2: Global max_submissions_per_week (backward compatible)
      if (maxSubmissionsPerWeek !== undefined) {
        const globalLimit = parseInt(String(maxSubmissionsPerWeek));
        if (isNaN(globalLimit) || globalLimit < 1 || globalLimit > 999) {
          return NextResponse.json(
            { success: false, error: { code: 'VALIDATION_ERROR', message: '제출 횟수는 1~999 사이의 숫자여야 합니다' } },
            { status: 400 }
          );
        }

        const { data, error } = await supabase
          .from('course_enrollments')
          .update({ max_submissions_per_week: globalLimit })
          .eq('id', targetId)
          .select('id, user_id, course_id, max_submissions_per_week, week_submission_overrides, profiles(email, full_name)')
          .single();

        if (error) {
          console.error('[Submissions PATCH Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '업데이트 실패' } },
            { status: 500 }
          );
        }

        return NextResponse.json({ success: true, data });
      }

      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'maxSubmissionsPerWeek 또는 weekId+weekLimit가 필요합니다' } },
        { status: 400 }
      );
    } catch (error) {
      console.error('[Submissions PATCH Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
