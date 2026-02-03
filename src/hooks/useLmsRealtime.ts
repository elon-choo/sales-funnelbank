// src/hooks/useLmsRealtime.ts
// Supabase Realtime 훅 - 피드백 & 작업 상태 실시간 업데이트
'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

type FeedbackJob = {
  id: string;
  assignment_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result: Record<string, unknown> | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

type Feedback = {
  id: string;
  assignment_id: string;
  score: number | null;
  content: string | null;
  model_used: string | null;
  created_at: string;
};

interface UseLmsRealtimeOptions {
  userId?: string;
  onJobUpdate?: (job: FeedbackJob, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onFeedbackCreate?: (feedback: Feedback) => void;
  enabled?: boolean;
}

export function useLmsRealtime({
  userId,
  onJobUpdate,
  onFeedbackCreate,
  enabled = true,
}: UseLmsRealtimeOptions) {
  const supabase = useMemo(() => createClient(), []);

  const setupRealtimeSubscription = useCallback(() => {
    if (!enabled) return null;

    const channels: RealtimeChannel[] = [];

    // 피드백 작업 상태 구독
    if (onJobUpdate) {
      const jobChannel = supabase
        .channel('feedback_jobs_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'feedback_jobs',
            ...(userId && { filter: `user_id=eq.${userId}` }),
          },
          (payload: RealtimePostgresChangesPayload<FeedbackJob>) => {
            const job = payload.new as FeedbackJob;
            const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
            onJobUpdate(job, eventType);
          }
        )
        .subscribe();

      channels.push(jobChannel);
    }

    // 피드백 생성 구독
    if (onFeedbackCreate) {
      const feedbackChannel = supabase
        .channel('feedbacks_changes')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'feedbacks',
          },
          (payload: RealtimePostgresChangesPayload<Feedback>) => {
            const feedback = payload.new as Feedback;
            onFeedbackCreate(feedback);
          }
        )
        .subscribe();

      channels.push(feedbackChannel);
    }

    return channels;
  }, [supabase, userId, onJobUpdate, onFeedbackCreate, enabled]);

  useEffect(() => {
    const channels = setupRealtimeSubscription();

    return () => {
      if (channels) {
        channels.forEach((channel) => {
          supabase.removeChannel(channel);
        });
      }
    };
  }, [setupRealtimeSubscription, supabase]);
}

// 관리자용 실시간 훅 - 모든 작업 상태 모니터링
interface UseLmsAdminRealtimeOptions {
  onJobUpdate?: (job: FeedbackJob, eventType: 'INSERT' | 'UPDATE' | 'DELETE') => void;
  onFeedbackCreate?: (feedback: Feedback) => void;
  onStatsUpdate?: () => void;
  enabled?: boolean;
}

export function useLmsAdminRealtime({
  onJobUpdate,
  onFeedbackCreate,
  onStatsUpdate,
  enabled = true,
}: UseLmsAdminRealtimeOptions) {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!enabled) return;

    const channels: RealtimeChannel[] = [];

    // 모든 피드백 작업 상태 구독 (관리자)
    if (onJobUpdate) {
      const jobChannel = supabase
        .channel('admin_feedback_jobs')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'feedback_jobs',
          },
          (payload: RealtimePostgresChangesPayload<FeedbackJob>) => {
            const job = payload.new as FeedbackJob;
            const eventType = payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE';
            onJobUpdate(job, eventType);
            if (onStatsUpdate) onStatsUpdate();
          }
        )
        .subscribe();

      channels.push(jobChannel);
    }

    // 모든 피드백 생성 구독 (관리자)
    if (onFeedbackCreate) {
      const feedbackChannel = supabase
        .channel('admin_feedbacks')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'feedbacks',
          },
          (payload: RealtimePostgresChangesPayload<Feedback>) => {
            const feedback = payload.new as Feedback;
            onFeedbackCreate(feedback);
            if (onStatsUpdate) onStatsUpdate();
          }
        )
        .subscribe();

      channels.push(feedbackChannel);
    }

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, onJobUpdate, onFeedbackCreate, onStatsUpdate, enabled]);
}

// 피드백 진행 상태 구독 훅 (특정 과제)
interface UseAssignmentFeedbackOptions {
  assignmentId: string;
  onStatusChange?: (status: 'pending' | 'processing' | 'completed' | 'failed') => void;
  onFeedbackReady?: (feedback: Feedback) => void;
  enabled?: boolean;
}

export function useAssignmentFeedback({
  assignmentId,
  onStatusChange,
  onFeedbackReady,
  enabled = true,
}: UseAssignmentFeedbackOptions) {
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    if (!enabled || !assignmentId) return;

    const channels: RealtimeChannel[] = [];

    // 특정 과제의 작업 상태 구독
    if (onStatusChange) {
      const jobChannel = supabase
        .channel(`assignment_job_${assignmentId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'feedback_jobs',
            filter: `assignment_id=eq.${assignmentId}`,
          },
          (payload: RealtimePostgresChangesPayload<FeedbackJob>) => {
            const job = payload.new as FeedbackJob;
            onStatusChange(job.status);
          }
        )
        .subscribe();

      channels.push(jobChannel);
    }

    // 특정 과제의 피드백 생성 구독
    if (onFeedbackReady) {
      const feedbackChannel = supabase
        .channel(`assignment_feedback_${assignmentId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'feedbacks',
            filter: `assignment_id=eq.${assignmentId}`,
          },
          (payload: RealtimePostgresChangesPayload<Feedback>) => {
            const feedback = payload.new as Feedback;
            onFeedbackReady(feedback);
          }
        )
        .subscribe();

      channels.push(feedbackChannel);
    }

    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
    };
  }, [supabase, assignmentId, onStatusChange, onFeedbackReady, enabled]);
}
