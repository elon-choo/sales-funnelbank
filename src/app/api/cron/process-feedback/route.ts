// src/app/api/cron/process-feedback/route.ts
// Vercel Cron 핸들러: Fallback + Cleanup 전용
// 5분마다 실행 - 주 처리는 /api/lms/feedback-processor에서 즉시 수행
// 이 Cron은 다음 역할만 담당:
// 1. 좀비 작업 복구 (5분 이상 processing 상태)
// 2. 누락된 pending 작업 처리 (edge case 대응)
// 3. 실패한 작업 재시도 트리거

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Vercel Cron config (vercel.json에도 설정 필요)
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CONCURRENT_JOBS = 10;
const CRON_SECRET = process.env.CRON_SECRET_FEEDBACK || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || CRON_SECRET;

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
// Fallback + Cleanup 전용 (5분마다 실행)
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // Cron 인증 확인
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  const isDev = process.env.NODE_ENV === 'development';
  const isValidCron = cronSecret === CRON_SECRET || authHeader === `Bearer ${CRON_SECRET}`;

  if (!isDev && !isValidCron) {
    console.warn('[Cron Auth] Invalid cron secret');
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const stats = {
      recovered: 0,
      triggered: 0,
      alreadyProcessing: 0,
    };

    // ============================================================
    // 1. 좀비 작업 복구 (15분 이상 processing 상태)
    // Opus 4.6 + 30K tokens는 7~12분 소요 → 15분 이상이면 진짜 좀비
    // ============================================================
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { data: zombieJobs } = await supabase
      .from('feedback_jobs')
      .select('id, attempts')
      .eq('status', 'processing')
      .lt('started_at', fifteenMinutesAgo);

    if (zombieJobs && zombieJobs.length > 0) {
      for (const zombie of zombieJobs) {
        if ((zombie.attempts || 0) >= 3) {
          // 최대 재시도 초과: failed로 변경
          await supabase
            .from('feedback_jobs')
            .update({
              status: 'failed',
              error_message: 'Zombie job: processing timeout (15min)',
              completed_at: new Date().toISOString(),
            })
            .eq('id', zombie.id);
        } else {
          // 재시도 가능: pending으로 복구
          await supabase
            .from('feedback_jobs')
            .update({
              status: 'pending',
              started_at: null,
              error_message: 'Recovered from zombie state',
            })
            .eq('id', zombie.id);
        }
        stats.recovered++;
      }
      console.log(`[Cron Fallback] Recovered ${stats.recovered} zombie jobs`);
    }

    // ============================================================
    // 2. 현재 처리 중인 작업 수 확인
    // ============================================================
    const { count: processingCount } = await supabase
      .from('feedback_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const currentProcessing = processingCount || 0;
    const availableSlots = MAX_CONCURRENT_JOBS - currentProcessing;

    if (availableSlots <= 0) {
      stats.alreadyProcessing = currentProcessing;
      console.log(`[Cron Fallback] All slots occupied (${currentProcessing}/${MAX_CONCURRENT_JOBS})`);
    }

    // ============================================================
    // 3. 누락된 pending 작업 처리 트리거 (Fallback)
    // ============================================================
    if (availableSlots > 0) {
      const { data: pendingJobs } = await supabase
        .from('feedback_jobs')
        .select('id, assignment_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(availableSlots);

      if (pendingJobs && pendingJobs.length > 0) {
        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // 병렬로 processor 트리거
        await Promise.allSettled(
          pendingJobs.map(async (job) => {
            const isPremium = await checkPremiumStatus(supabase, job.assignment_id);

            return fetch(`${baseUrl}/api/lms/feedback-processor`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-internal-secret': INTERNAL_API_SECRET,
              },
              body: JSON.stringify({
                jobId: job.id,
                isPremium,
              }),
            });
          })
        );

        stats.triggered = pendingJobs.length;
        console.log(`[Cron Fallback] Triggered ${stats.triggered} pending jobs`);
      }
    }

    const elapsedMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        mode: 'fallback',
        recovered: stats.recovered,
        triggered: stats.triggered,
        processing: currentProcessing,
        maxConcurrent: MAX_CONCURRENT_JOBS,
        elapsedMs,
      },
    });
  } catch (error) {
    console.error('[Cron Fallback] Unexpected error:', error);
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
