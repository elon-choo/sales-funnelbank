// src/app/api/lms/feedbacks/[feedbackId]/route.ts
// 개별 피드백 상세 조회 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

interface RouteParams {
  params: Promise<{ feedbackId: string }>;
}

// GET /api/lms/feedbacks/[feedbackId]
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { feedbackId } = await params;

  return withLmsAuth(request, async (auth, supabase) => {
    try {
      const { data: feedback, error } = await supabase
        .from('feedbacks')
        .select(`
          id,
          assignment_id,
          user_id,
          course_id,
          week_id,
          content,
          summary,
          scores,
          version,
          assignment_version,
          status,
          tokens_input,
          tokens_output,
          generation_time_ms,
          created_at,
          updated_at,
          assignments (
            id,
            user_id,
            course_id,
            week_id,
            content,
            version,
            status,
            submitted_at,
            courses (id, title),
            course_weeks (id, week_number, title, assignment_type)
          )
        `)
        .eq('id', feedbackId)
        .single();

      if (error || !feedback) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '피드백을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 권한 확인
      const isAdmin = auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE';

      if (!isAdmin) {
        if (feedback.user_id !== auth.userId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' } },
            { status: 403 }
          );
        }

        // 학생에게는 비용 정보 숨김
        return NextResponse.json({
          success: true,
          data: {
            feedback: {
              ...feedback,
              tokens_input: undefined,
              tokens_output: undefined,
              generation_time_ms: undefined,
            },
          },
        });
      }

      // 관리자: 학생 프로필 정보 포함
      const { data: studentProfile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('id', feedback.user_id)
        .single();

      return NextResponse.json({
        success: true,
        data: {
          feedback,
          studentProfile: studentProfile || null,
          isAdminView: true,
        },
      });
    } catch (error) {
      console.error('[Feedback GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
