// src/app/api/lms/feedback-processor/route.ts
// 프로덕션 피드백 처리 API - 제출 즉시 처리 + 대기열 자동 관리
// 크론 의존 제거, 실시간 처리 아키텍처

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60; // Vercel Pro: 최대 60초

// ============================================================
// 설정
// ============================================================
const MAX_CONCURRENT_JOBS = 10; // 동시 처리 최대 작업 수
const EDGE_FUNCTION_URL = process.env.SUPABASE_EDGE_FUNCTION_URL || '';
const CRON_SECRET = process.env.CRON_SECRET_FEEDBACK || '';
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || CRON_SECRET;

// 재시도 설정 (Exponential Backoff)
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000; // 1초

// ============================================================
// 타입 정의
// ============================================================
interface ProcessResult {
  jobId: string;
  success: boolean;
  feedbackId?: string;
  error?: string;
  elapsedMs?: number;
}

interface JobRecord {
  id: string;
  assignment_id: string;
  attempts: number;
  priority: number;
  metadata: Record<string, unknown>;
}

// ============================================================
// POST /api/lms/feedback-processor
// 피드백 처리 시작 (과제 제출 후 즉시 호출)
// ============================================================
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // 인증 검증 (내부 API 호출만 허용)
  const authHeader = request.headers.get('x-internal-secret');
  const isInternalCall = authHeader === INTERNAL_API_SECRET;

  // 개발 환경에서는 인증 우회 가능
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && !isInternalCall) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { jobId, assignmentId, isPremium = false } = body;

    if (!jobId && !assignmentId) {
      return NextResponse.json(
        { success: false, error: 'jobId 또는 assignmentId가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // ============================================================
    // 1. 동시 처리 제한 확인
    // ============================================================
    const { count: processingCount } = await supabase
      .from('feedback_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    const currentProcessing = processingCount || 0;

    if (currentProcessing >= MAX_CONCURRENT_JOBS) {
      // 대기열에 추가하고 순서 대기
      console.log(`[Processor] Queue full (${currentProcessing}/${MAX_CONCURRENT_JOBS}), job will be processed soon`);

      return NextResponse.json({
        success: true,
        data: {
          status: 'queued',
          queuePosition: currentProcessing - MAX_CONCURRENT_JOBS + 1,
          message: '처리 대기열에 추가되었습니다. 곧 처리됩니다.',
          estimatedWait: `약 ${Math.ceil((currentProcessing - MAX_CONCURRENT_JOBS + 1) * 30)}초`,
        },
      });
    }

    // ============================================================
    // 2. Job 선택 및 상태 변경 (원자적 처리)
    // ============================================================
    let targetJobId = jobId;

    if (!targetJobId && assignmentId) {
      // assignmentId로 pending job 찾기
      const { data: pendingJob } = await supabase
        .from('feedback_jobs')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!pendingJob) {
        return NextResponse.json(
          { success: false, error: '처리할 작업이 없습니다' },
          { status: 404 }
        );
      }

      targetJobId = pendingJob.id;
    }

    // Job 상태를 processing으로 변경 (원자적)
    const { data: job, error: pickError } = await supabase
      .from('feedback_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: supabase.rpc ? undefined : 1, // RPC 없으면 직접 증가
      })
      .eq('id', targetJobId)
      .eq('status', 'pending') // 낙관적 락
      .select()
      .single();

    if (pickError || !job) {
      // 이미 다른 워커가 처리 중
      console.log(`[Processor] Job ${targetJobId} already picked by another worker`);
      return NextResponse.json({
        success: true,
        data: {
          status: 'already_processing',
          message: '이미 처리 중입니다',
        },
      });
    }

    // attempts 증가 (별도 쿼리)
    await supabase
      .from('feedback_jobs')
      .update({ attempts: (job.attempts || 0) + 1 })
      .eq('id', targetJobId);

    // ============================================================
    // 3. Edge Function 호출 (AI 피드백 생성)
    // ============================================================
    const result = await callEdgeFunctionWithRetry(
      targetJobId,
      isPremium,
      job.attempts || 0
    );

    // ============================================================
    // 4. 결과에 따른 상태 업데이트
    // ============================================================
    if (result.success) {
      // 성공: 상태는 Edge Function에서 이미 completed로 변경됨
      console.log(`[Processor] Job ${targetJobId} completed successfully`);
    } else {
      // 실패: 재시도 가능 여부 확인
      const currentAttempts = (job.attempts || 0) + 1;

      if (currentAttempts >= MAX_RETRIES) {
        // 최대 재시도 초과: failed 상태로 변경
        await supabase
          .from('feedback_jobs')
          .update({
            status: 'failed',
            error_message: result.error || 'Max retries exceeded',
            completed_at: new Date().toISOString(),
          })
          .eq('id', targetJobId);

        console.error(`[Processor] Job ${targetJobId} failed after ${currentAttempts} attempts`);
      } else {
        // 재시도 가능: pending으로 되돌리고 지연 후 재처리
        await supabase
          .from('feedback_jobs')
          .update({
            status: 'pending',
            started_at: null,
            error_message: result.error,
            metadata: {
              ...((job.metadata as Record<string, unknown>) || {}),
              lastError: result.error,
              lastAttemptAt: new Date().toISOString(),
            },
          })
          .eq('id', targetJobId);

        // 지연 후 재처리 트리거 (Exponential Backoff)
        const delay = BASE_DELAY_MS * Math.pow(2, currentAttempts - 1);
        setTimeout(() => {
          triggerNextJob(supabase);
        }, delay);

        console.log(`[Processor] Job ${targetJobId} will retry in ${delay}ms (attempt ${currentAttempts}/${MAX_RETRIES})`);
      }
    }

    // ============================================================
    // 5. 대기 중인 다음 작업 처리 트리거
    // ============================================================
    // 비동기로 다음 작업 처리 시작 (fire-and-forget)
    triggerNextJob(supabase);

    const elapsedMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      data: {
        jobId: targetJobId,
        status: result.success ? 'completed' : 'retrying',
        feedbackId: result.feedbackId,
        elapsedMs,
        ...(result.error && { error: result.error }),
      },
    });
  } catch (error) {
    console.error('[Processor] Unexpected error:', error);
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

// ============================================================
// Edge Function 호출 (재시도 로직 포함)
// ============================================================
async function callEdgeFunctionWithRetry(
  jobId: string,
  isPremium: boolean,
  currentAttempts: number
): Promise<ProcessResult> {
  const edgeUrl = `${EDGE_FUNCTION_URL}/generate-feedback`;
  const startTime = Date.now();

  try {
    const response = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET,
      },
      body: JSON.stringify({
        jobId,
        isPremium,
        cronSecret: CRON_SECRET,
      }),
      signal: AbortSignal.timeout(55000), // 55초 타임아웃 (Vercel 60초 제한 고려)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge Function error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    return {
      jobId,
      success: true,
      feedbackId: result.data?.feedbackId,
      elapsedMs: Date.now() - startTime,
    };
  } catch (error) {
    console.error(`[Processor] Edge Function call failed for job ${jobId}:`, error);

    return {
      jobId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      elapsedMs: Date.now() - startTime,
    };
  }
}

// ============================================================
// 다음 대기 작업 처리 트리거
// ============================================================
async function triggerNextJob(supabase: ReturnType<typeof createAdminClient>) {
  try {
    // 현재 처리 중인 작업 수 확인
    const { count: processingCount } = await supabase
      .from('feedback_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    if ((processingCount || 0) >= MAX_CONCURRENT_JOBS) {
      return; // 동시 처리 한도 도달
    }

    // 다음 pending 작업 확인
    const { data: nextJob } = await supabase
      .from('feedback_jobs')
      .select('id, assignment_id')
      .eq('status', 'pending')
      .order('priority', { ascending: false }) // 높은 우선순위 먼저
      .order('created_at', { ascending: true }) // FIFO
      .limit(1)
      .single();

    if (!nextJob) {
      return; // 대기 작업 없음
    }

    // 프리미엄 여부 확인
    const isPremium = await checkPremiumStatus(supabase, nextJob.assignment_id);

    // 자체 API 호출로 다음 작업 처리 (fire-and-forget)
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    fetch(`${baseUrl}/api/lms/feedback-processor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': INTERNAL_API_SECRET,
      },
      body: JSON.stringify({
        jobId: nextJob.id,
        isPremium,
      }),
    }).catch((err) => {
      console.error('[Processor] Failed to trigger next job:', err);
    });
  } catch (error) {
    console.error('[Processor] Error in triggerNextJob:', error);
  }
}

// ============================================================
// 프리미엄 사용자 확인
// ============================================================
async function checkPremiumStatus(
  supabase: ReturnType<typeof createAdminClient>,
  assignmentId: string
): Promise<boolean> {
  try {
    const { data: assignment } = await supabase
      .from('assignments')
      .select('user_id')
      .eq('id', assignmentId)
      .single();

    if (!assignment?.user_id) return false;

    // 시스템 설정에서 프리미엄 사용자 확인
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

    // 프로필 role 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', assignment.user_id)
      .single();

    if (profile?.role && ['premium', 'enterprise'].includes(profile.role.toLowerCase())) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// ============================================================
// GET: 대기열 상태 조회 (디버깅/모니터링용)
// ============================================================
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-internal-secret');
  const isInternalCall = authHeader === INTERNAL_API_SECRET;
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && !isInternalCall) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    // 상태별 작업 수 조회
    const [pending, processing, completed, failed] = await Promise.all([
      supabase.from('feedback_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('feedback_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase
        .from('feedback_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from('feedback_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed')
        .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        queue: {
          pending: pending.count || 0,
          processing: processing.count || 0,
          maxConcurrent: MAX_CONCURRENT_JOBS,
          available: MAX_CONCURRENT_JOBS - (processing.count || 0),
        },
        last24h: {
          completed: completed.count || 0,
          failed: failed.count || 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
