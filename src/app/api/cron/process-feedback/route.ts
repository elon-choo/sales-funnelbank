// src/app/api/cron/process-feedback/route.ts
// Vercel Cron 핸들러: 피드백 생성 작업 처리
// 1분마다 실행되어 pending 작업을 pick하고 Edge Function에 위임
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Vercel Cron config (vercel.json에도 설정 필요)
export const runtime = 'nodejs';
export const maxDuration = 60; // 최대 60초 (Vercel Cron 제한)

const CONCURRENT_LIMIT = 5; // 동시 처리 작업 수
const EDGE_FUNCTION_URL = process.env.SUPABASE_EDGE_FUNCTION_URL || '';
const CRON_SECRET = process.env.CRON_SECRET_FEEDBACK || '';

// 프리미엄 사용자 여부 확인 (시스템 설정 또는 프로필 티어 기반)
async function checkPremiumStatus(
  supabase: ReturnType<typeof createAdminClient>,
  assignmentId: string
): Promise<boolean> {
  try {
    // 1. assignment에서 user_id 조회
    const { data: assignment } = await supabase
      .from('assignments')
      .select('user_id')
      .eq('id', assignmentId)
      .single();

    if (!assignment?.user_id) return false;

    // 2. 시스템 설정에서 프리미엄 사용자 목록 확인
    const { data: premiumSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'premium_user_ids')
      .single();

    if (premiumSetting?.value) {
      const premiumUserIds = Array.isArray(premiumSetting.value)
        ? premiumSetting.value
        : [];
      if (premiumUserIds.includes(assignment.user_id)) {
        return true;
      }
    }

    // 3. 프로필 티어 확인 (ENTERPRISE 또는 PREMIUM)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', assignment.user_id)
      .single();

    // role이 'premium' 또는 'enterprise'면 프리미엄 처리
    if (profile?.role && ['premium', 'enterprise'].includes(profile.role.toLowerCase())) {
      return true;
    }

    return false;
  } catch (error) {
    console.warn('[Cron] Failed to check premium status:', error);
    return false;
  }
}

// GET /api/cron/process-feedback
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Cron 인증 확인 (Vercel Cron에서 호출 시)
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');

  // 개발 환경 또는 Cron 시크릿 일치 확인
  const isDev = process.env.NODE_ENV === 'development';
  const isValidCron = cronSecret === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;

  if (!isDev && !isValidCron) {
    console.warn('[Cron Auth] Invalid cron secret');
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = createAdminClient();

    // 1. 좀비 작업 복구 (5분 이상 processing 상태)
    const { data: recoveredCount } = await supabase.rpc('recover_zombie_jobs');
    if (recoveredCount && recoveredCount > 0) {
      console.log(`[Cron] Recovered ${recoveredCount} zombie jobs`);
    }

    // 2. pending 작업 pick (FOR UPDATE SKIP LOCKED)
    const { data: jobs, error: pickError } = await supabase.rpc('pick_next_feedback_jobs', {
      p_limit: CONCURRENT_LIMIT,
    });

    if (pickError) {
      console.error('[Cron] Failed to pick jobs:', pickError);
      return NextResponse.json(
        { success: false, error: 'Failed to pick jobs', details: pickError.message },
        { status: 500 }
      );
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          message: 'No pending jobs',
          picked: 0,
          elapsedMs: Date.now() - startTime,
        },
      });
    }

    console.log(`[Cron] Picked ${jobs.length} jobs:`, jobs.map((j: { job_id: string }) => j.job_id));

    // 3. Edge Function에 작업 위임 (병렬 처리)
    const results = await Promise.allSettled(
      jobs.map(async (job: { job_id: string; job_assignment_id: string; job_attempts: number }) => {
        const edgeUrl = `${EDGE_FUNCTION_URL}/generate-feedback`;

        try {
          // 프리미엄 사용자 여부 확인
          const isPremium = await checkPremiumStatus(supabase, job.job_assignment_id);

          const response = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cron-secret': CRON_SECRET,
            },
            body: JSON.stringify({
              jobId: job.job_id,
              isPremium,
              cronSecret: CRON_SECRET,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Edge Function error: ${response.status} ${errorText}`);
          }

          const result = await response.json();
          return { jobId: job.job_id, success: true, result };
        } catch (error) {
          console.error(`[Cron] Edge Function call failed for job ${job.job_id}:`, error);

          // 실패 시 작업 상태를 pending으로 되돌리거나 failed로 변경
          if (job.job_attempts >= 3) {
            await supabase
              .from('feedback_jobs')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unknown error',
                completed_at: new Date().toISOString(),
              })
              .eq('id', job.job_id);
          } else {
            await supabase
              .from('feedback_jobs')
              .update({
                status: 'pending',
                started_at: null,
                error_message: error instanceof Error ? error.message : 'Unknown error',
              })
              .eq('id', job.job_id);
          }

          return { jobId: job.job_id, success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
      })
    );

    // 4. 결과 집계
    const successful = results.filter(
      (r): r is PromiseFulfilledResult<{ jobId: string; success: boolean; result: unknown }> =>
        r.status === 'fulfilled' && r.value.success
    );
    const failed = results.filter(
      (r): r is PromiseFulfilledResult<{ jobId: string; success: boolean; error: string }> =>
        r.status === 'fulfilled' && !r.value.success
    );

    const elapsedMs = Date.now() - startTime;

    console.log(`[Cron] Completed: ${successful.length} success, ${failed.length} failed, ${elapsedMs}ms`);

    return NextResponse.json({
      success: true,
      data: {
        picked: jobs.length,
        successful: successful.length,
        failed: failed.length,
        recovered: recoveredCount || 0,
        elapsedMs,
        results: results.map((r) => (r.status === 'fulfilled' ? r.value : { error: 'rejected' })),
      },
    });
  } catch (error) {
    console.error('[Cron] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// POST도 동일하게 처리 (유연성)
export { GET as POST };
