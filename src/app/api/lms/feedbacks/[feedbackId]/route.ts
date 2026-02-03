// src/app/api/lms/feedbacks/[feedbackId]/route.ts
// 개별 피드백 상세 조회 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

interface RouteParams {
  params: Promise<{ feedbackId: string }>;
}

// GET /api/lms/feedbacks/[feedbackId] - 피드백 상세 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { feedbackId } = await params;

  return withLmsAuth(request, async (auth, supabase) => {
    try {
      // 피드백 정보 조회 (과제 정보 포함)
      const { data: feedback, error } = await supabase
        .from('feedbacks')
        .select(`
          id,
          assignment_id,
          version,
          ai_model,
          raw_feedback,
          parsed_feedback,
          score,
          processing_time_ms,
          token_usage,
          cost_usd,
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
            profiles (id, email, full_name),
            courses (id, title),
            course_weeks (id, week_number, title, assignment_type)
          )
        `)
        .eq('id', feedbackId)
        .is('deleted_at', null)
        .single();

      if (error || !feedback) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '피드백을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 관리자가 아닌 경우 본인 과제인지 확인 (CTO-001 방안B)
      if (auth.lmsRole !== 'admin' && auth.tier !== 'ENTERPRISE') {
        // Supabase returns single relation as object, but TS infers as array
        const assignment = feedback.assignments as unknown as { user_id: string } | null;
        if (!assignment || assignment.user_id !== auth.userId) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: '접근 권한이 없습니다' } },
            { status: 403 }
          );
        }

        // 학생에게는 비용 정보 숨김
        const sanitizedFeedback = {
          ...feedback,
          token_usage: undefined,
          cost_usd: undefined,
          processing_time_ms: undefined,
        };

        return NextResponse.json({
          success: true,
          data: { feedback: sanitizedFeedback },
        });
      }

      // 관리자: 전체 정보 반환
      return NextResponse.json({
        success: true,
        data: { feedback },
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
