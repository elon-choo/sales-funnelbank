// src/app/api/lms/admin/submissions/route.ts
// 관리자: 수강생별 제출 횟수 제한 관리 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// PATCH /api/lms/admin/submissions - 제출 횟수 제한 수정
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { enrollmentId, userId, courseId, maxSubmissionsPerWeek } = body;

      if (!maxSubmissionsPerWeek || typeof maxSubmissionsPerWeek !== 'number' || maxSubmissionsPerWeek < 1 || maxSubmissionsPerWeek > 999) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '제출 횟수는 1~999 사이의 숫자여야 합니다' } },
          { status: 400 }
        );
      }

      // enrollmentId로 직접 업데이트하거나 userId + courseId 조합으로 업데이트
      if (enrollmentId) {
        const { data, error } = await supabase
          .from('course_enrollments')
          .update({ max_submissions_per_week: maxSubmissionsPerWeek })
          .eq('id', enrollmentId)
          .select('id, user_id, course_id, max_submissions_per_week, profiles(email, full_name)')
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

      if (userId && courseId) {
        const { data, error } = await supabase
          .from('course_enrollments')
          .update({ max_submissions_per_week: maxSubmissionsPerWeek })
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .select('id, user_id, course_id, max_submissions_per_week, profiles(email, full_name)')
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
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'enrollmentId 또는 userId+courseId가 필요합니다' } },
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
