// src/app/api/cron/process-feedback/route.ts
// Vercel Cron 핸들러: Fallback + Cleanup 전용
// 5분마다 실행 - 주 처리는 /api/lms/feedback-processor에서 즉시 수행
// 이 Cron은 다음 역할만 담당:
// 1. 좀비 작업 복구 (10분 이상 processing 상태)
// 2. 누락된 pending 작업 처리 (edge case 대응)
// 3. 실패한 작업 재시도 트리거
// 4. 고아 과제 복구 (submitted인데 feedback_job이 없는 과제 자동 감지)

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { timingSafeCompare } from '@/lib/security/crypto';

// Vercel Cron config (vercel.json에도 설정 필요)
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_CONCURRENT_JOBS = 10;

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
  // Vercel Cron은 CRON_SECRET 환경변수로 Authorization: Bearer <secret> 헤더를 보냄
  const authHeader = request.headers.get('authorization');
  const cronSecret = request.headers.get('x-cron-secret');
  // CRON_SECRET (Vercel 표준) 또는 CRON_SECRET_FEEDBACK (레거시) 둘 다 지원
  const cronSecret_env = (process.env.CRON_SECRET || process.env.CRON_SECRET_FEEDBACK || '').trim();
  const isValidCron = (cronSecret_env && cronSecret ? timingSafeCompare(cronSecret, cronSecret_env) : false) ||
                      (cronSecret_env && authHeader ? timingSafeCompare(authHeader, `Bearer ${cronSecret_env}`) : false);

  if (!isValidCron) {
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
    // 1a. 좀비 작업 복구 (10분 이상 processing 상태)
    // Opus 피드백 생성 평균 7~8분, 10분 넘으면 terminated 확정
    // ============================================================
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: zombieJobs } = await supabase
      .from('feedback_jobs')
      .select('id, attempts')
      .eq('status', 'processing')
      .lt('started_at', tenMinutesAgo);

    if (zombieJobs && zombieJobs.length > 0) {
      for (const zombie of zombieJobs) {
        if ((zombie.attempts || 0) >= 3) {
          await supabase
            .from('feedback_jobs')
            .update({
              status: 'failed',
              error_message: 'Zombie job: processing timeout (10min), max retries exceeded',
              completed_at: new Date().toISOString(),
            })
            .eq('id', zombie.id);
        } else {
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
    // 1b. terminated/overloaded 실패 작업 자동 리셋 (재시도 3회 미만)
    // after()가 terminated 되면 자가 치유 체인도 죽으므로 Cron이 커버
    // ============================================================
    const { data: retriableJobs } = await supabase
      .from('feedback_jobs')
      .select('id, attempts, error_message')
      .eq('status', 'failed')
      .lt('attempts', 3)
      .gt('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString());

    if (retriableJobs && retriableJobs.length > 0) {
      const autoRetriable = retriableJobs.filter(j => {
        const err = j.error_message || '';
        return err.includes('terminated') || err.includes('Overloaded') || err.includes('timeout')
          || err.includes('corrupted') || err.includes('Stale');
      });
      for (const job of autoRetriable) {
        await supabase
          .from('feedback_jobs')
          .update({
            status: 'pending',
            started_at: null,
            completed_at: null,
            error_message: `Auto-retry from: ${(job.error_message || '').substring(0, 50)}`,
          })
          .eq('id', job.id);
        stats.recovered++;
      }
      if (autoRetriable.length > 0) {
        console.log(`[Cron Fallback] Auto-retried ${autoRetriable.length} terminated/overloaded jobs`);
      }
    }

    // ============================================================
    // 1c. 고아 과제 복구: submitted 상태인데 active feedback_job이 없고
    //     피드백도 없는 과제 → 자동으로 feedback_job 생성
    //     (과제 제출 시 job INSERT 실패한 edge case 대응)
    // ============================================================
    const { data: orphanedAssignments } = await supabase
      .rpc('find_orphaned_submitted_assignments');

    // RPC가 없으면 직접 쿼리 (fallback)
    let orphaned = orphanedAssignments;
    if (!orphaned) {
      // submitted 과제 중 active job도 없고 피드백도 없는 것
      const { data: submittedAssignments } = await supabase
        .from('assignments')
        .select('id')
        .eq('status', 'submitted')
        .is('deleted_at', null);

      if (submittedAssignments && submittedAssignments.length > 0) {
        const orphanList: { id: string }[] = [];
        for (const a of submittedAssignments) {
          // active job 존재 확인
          const { data: activeJob } = await supabase
            .from('feedback_jobs')
            .select('id')
            .eq('assignment_id', a.id)
            .in('status', ['pending', 'processing'])
            .limit(1);

          if (activeJob && activeJob.length > 0) continue;

          // 피드백 존재 확인
          const { data: existingFeedback } = await supabase
            .from('feedbacks')
            .select('id')
            .eq('assignment_id', a.id)
            .limit(1);

          if (existingFeedback && existingFeedback.length > 0) {
            // 피드백은 있는데 과제 상태가 submitted → feedback_ready로 수정
            await supabase
              .from('assignments')
              .update({ status: 'feedback_ready' })
              .eq('id', a.id);
            continue;
          }

          orphanList.push(a);
        }
        orphaned = orphanList;
      }
    }

    if (orphaned && orphaned.length > 0) {
      let orphanCreated = 0;
      for (const a of orphaned) {
        // 기존 failed/cancelled job 삭제 (unique constraint 해결)
        await supabase
          .from('feedback_jobs')
          .delete()
          .eq('assignment_id', a.id)
          .in('status', ['failed', 'cancelled']);

        // 새 job 생성
        const { error: insertError } = await supabase
          .from('feedback_jobs')
          .insert({
            assignment_id: a.id,
            status: 'pending',
            worker_type: 'edge',
            priority: 5,
            metadata: { source: 'cron-orphan-recovery', recoveredAt: new Date().toISOString() },
          });

        if (!insertError) {
          orphanCreated++;
        }
      }
      if (orphanCreated > 0) {
        stats.recovered += orphanCreated;
        console.log(`[Cron Fallback] Created ${orphanCreated} jobs for orphaned submitted assignments`);
      }
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
                'x-internal-secret': process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET_FEEDBACK || '',
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
