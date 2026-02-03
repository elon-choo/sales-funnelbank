// src/app/api/lms/settings/route.ts
// LMS AI 피드백 설정 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/settings - AI 피드백 설정 조회
export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const { data: settings, error } = await supabase
        .from('system_settings')
        .select('*')
        .in('key', [
          'ai_default_model',
          'ai_premium_model',
          'ai_monthly_budget',
          'ai_feedback_prompt_template',
          'ai_scoring_criteria',
          'ai_tone',
          'ai_language',
          'ai_max_tokens',
          'ai_temperature',
          'premium_user_ids',
        ]);

      if (error) {
        console.error('[Settings GET Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '설정 조회 실패' } },
          { status: 500 }
        );
      }

      // 기본값과 병합
      const defaultSettings = {
        ai_default_model: 'claude-sonnet-4-20250514',
        ai_premium_model: 'claude-opus-4-5-20251101',
        ai_monthly_budget: 800,
        ai_feedback_prompt_template: getDefaultPromptTemplate(),
        ai_scoring_criteria: getDefaultScoringCriteria(),
        ai_tone: 'professional',
        ai_language: 'ko',
        ai_max_tokens: 4000,
        ai_temperature: 0.7,
        premium_user_ids: [] as string[],
      };

      const mergedSettings: Record<string, unknown> = { ...defaultSettings };
      settings?.forEach((s) => {
        try {
          mergedSettings[s.key] = JSON.parse(s.value);
        } catch {
          mergedSettings[s.key] = s.value;
        }
      });

      return NextResponse.json({
        success: true,
        data: { settings: mergedSettings },
      });
    } catch (error) {
      console.error('[Settings GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/settings - AI 피드백 설정 업데이트
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { settings } = body;

      if (!settings || typeof settings !== 'object') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '설정 객체가 필요합니다' } },
          { status: 400 }
        );
      }

      // 허용된 설정 키
      const allowedKeys = [
        'ai_default_model',
        'ai_premium_model',
        'ai_monthly_budget',
        'ai_feedback_prompt_template',
        'ai_scoring_criteria',
        'ai_tone',
        'ai_language',
        'ai_max_tokens',
        'ai_temperature',
        'premium_user_ids',
      ];

      const updates = Object.entries(settings)
        .filter(([key]) => allowedKeys.includes(key))
        .map(([key, value]) => ({
          key,
          value: typeof value === 'string' ? value : JSON.stringify(value),
          updated_by: auth.userId,
          updated_at: new Date().toISOString(),
        }));

      if (updates.length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '유효한 설정이 없습니다' } },
          { status: 400 }
        );
      }

      // Upsert 설정
      const { error } = await supabase
        .from('system_settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) {
        console.error('[Settings PATCH Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '설정 저장 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { updated: updates.length },
      });
    } catch (error) {
      console.error('[Settings PATCH Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// 기본 피드백 프롬프트 템플릿
function getDefaultPromptTemplate(): string {
  return `당신은 세일즈 퍼널 마스터클래스의 AI 피드백 전문가입니다.

수강생이 제출한 과제를 다음 기준으로 분석하고 피드백을 제공해주세요:

## 평가 영역
1. **전략적 사고** - 목표 설정과 접근 방식의 적절성
2. **고객 이해** - 타겟 고객에 대한 이해도
3. **세일즈 퍼널 구조** - 퍼널 단계별 설계의 완성도
4. **카피라이팅** - 메시지의 명확성과 설득력
5. **실행 가능성** - 현실적인 실행 계획

## 피드백 형식
- 각 영역별 점수 (1-10점)
- 강점 2-3가지
- 개선점 2-3가지
- 구체적인 개선 방안
- 종합 피드백 (200자 내외)

수강생에게 격려와 동기부여가 되는 톤으로 작성해주세요.`;
}

// 기본 평가 기준
function getDefaultScoringCriteria(): Record<string, { name: string; weight: number; description: string }> {
  return {
    strategic_thinking: {
      name: '전략적 사고',
      weight: 25,
      description: '목표 설정과 접근 방식의 적절성',
    },
    customer_understanding: {
      name: '고객 이해',
      weight: 20,
      description: '타겟 고객에 대한 이해도',
    },
    funnel_structure: {
      name: '퍼널 구조',
      weight: 25,
      description: '퍼널 단계별 설계의 완성도',
    },
    copywriting: {
      name: '카피라이팅',
      weight: 15,
      description: '메시지의 명확성과 설득력',
    },
    execution_plan: {
      name: '실행 가능성',
      weight: 15,
      description: '현실적인 실행 계획',
    },
  };
}
