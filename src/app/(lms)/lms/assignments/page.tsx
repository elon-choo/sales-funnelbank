// src/app/(lms)/lms/assignments/page.tsx
// 학생 과제 목록 페이지
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface FeedbackJob {
  id: string;
  assignment_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: string;
}

interface FeedbackInfo {
  id: string;
  assignment_id: string;
  scores: { total: number } | null;
  sent_at: string | null;
  created_at: string;
}

interface Assignment {
  id: string;
  course_id: string;
  week_id: string;
  content: Record<string, unknown>;
  version: number;
  status: 'draft' | 'submitted' | 'processing' | 'feedback_ready';
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  courses: {
    id: string;
    title: string;
  };
  course_weeks: {
    id: string;
    week_number: number;
    title: string;
    deadline: string | null;
    assignment_type: string;
  };
}

const statusLabels: Record<string, { text: string; color: string; icon?: string }> = {
  draft: { text: '초안', color: 'bg-slate-600/20 text-slate-400' },
  submitted: { text: '제출됨 - AI 분석 대기', color: 'bg-blue-600/20 text-blue-400' },
  processing: { text: 'AI 분석 중...', color: 'bg-yellow-600/20 text-yellow-400' },
  feedback_ready: { text: '피드백 완료', color: 'bg-green-600/20 text-green-400' },
};

export default function AssignmentsPage() {
  const { accessToken } = useAuthStore();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [feedbackJobs, setFeedbackJobs] = useState<Map<string, FeedbackJob>>(new Map());
  const [feedbacks, setFeedbacks] = useState<Map<string, FeedbackInfo>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const fetchAssignments = async () => {
    if (!accessToken) return;

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/lms/assignments?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('과제 목록을 불러오는데 실패했습니다');
      }

      const result = await response.json();
      if (result.success) {
        const list = result.data.assignments || [];
        setAssignments(list);

        // 제출된 과제들의 피드백 상태 조회
        const submittedIds = list
          .filter((a: Assignment) => a.status === 'submitted' || a.status === 'processing' || a.status === 'feedback_ready')
          .map((a: Assignment) => a.id);

        if (submittedIds.length > 0) {
          // 피드백 job 상태 조회
          const jobsRes = await fetch(`/api/lms/jobs?assignmentIds=${submittedIds.join(',')}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (jobsRes.ok) {
            const jobsResult = await jobsRes.json();
            if (jobsResult.success && jobsResult.data?.jobs) {
              const jobMap = new Map<string, FeedbackJob>();
              for (const job of jobsResult.data.jobs) {
                jobMap.set(job.assignment_id, job);
              }
              setFeedbackJobs(jobMap);
            }
          }

          // 피드백 조회
          const fbRes = await fetch('/api/lms/feedbacks', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (fbRes.ok) {
            const fbResult = await fbRes.json();
            if (fbResult.success && fbResult.data?.feedbacks) {
              const fbMap = new Map<string, FeedbackInfo>();
              for (const fb of fbResult.data.feedbacks) {
                fbMap.set(fb.assignment_id, fb);
              }
              setFeedbacks(fbMap);
            }
          }
        }
      } else {
        throw new Error(result.error?.message || '알 수 없는 오류');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
  }, [accessToken, statusFilter]);

  // 처리 중인 과제가 있으면 10초마다 폴링
  useEffect(() => {
    const hasProcessing = assignments.some(
      (a) => a.status === 'submitted' || a.status === 'processing'
    );
    if (!hasProcessing) return;

    const interval = setInterval(() => {
      fetchAssignments();
    }, 10000);

    return () => clearInterval(interval);
  }, [assignments, accessToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">내 과제</h1>
          <p className="text-slate-400 mt-1">제출한 과제와 피드백을 확인하세요</p>
        </div>
        <Link
          href="/lms/assignments/new"
          className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-medium rounded-xl transition-opacity flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 과제 제출
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {['all', 'draft', 'submitted', 'feedback_ready'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-purple-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {status === 'all' ? '전체' : statusLabels[status]?.text || status}
          </button>
        ))}
      </div>

      {/* Assignment List */}
      {assignments.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">과제가 없습니다</h3>
          <p className="text-slate-400">
            {statusFilter === 'all'
              ? '아직 제출한 과제가 없습니다. 첫 과제를 작성해보세요!'
              : `${statusLabels[statusFilter]?.text || statusFilter} 상태의 과제가 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const job = feedbackJobs.get(assignment.id);
            const fb = feedbacks.get(assignment.id);
            const isGenerating = job && (job.status === 'pending' || job.status === 'processing');
            const isFailed = job?.status === 'failed';
            const hasFeedback = !!fb;
            const emailSent = !!fb?.sent_at;

            // 실제 표시 상태 결정
            let displayStatus = assignment.status;
            if (isGenerating) displayStatus = 'processing';
            if (hasFeedback) displayStatus = 'feedback_ready';

            return (
              <Link
                key={assignment.id}
                href={hasFeedback ? `/lms/feedbacks/${fb.id}` : `/lms/assignments/${assignment.id}`}
                className="block bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-purple-400">
                        {assignment.course_weeks?.week_number || '?'}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {assignment.course_weeks?.week_number}주차: {assignment.course_weeks?.title || '과제'}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        {assignment.courses?.title}
                      </p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-slate-500">
                          버전 {assignment.version}
                        </span>
                        {assignment.submitted_at && (
                          <span className="text-xs text-slate-500">
                            제출: {new Date(assignment.submitted_at).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                        {assignment.course_weeks?.deadline && (
                          <span className="text-xs text-slate-500">
                            마감: {new Date(assignment.course_weeks.deadline).toLocaleDateString('ko-KR')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">
                      {/* 점수 표시 */}
                      {fb?.scores?.total != null && (
                        <span className={`px-3 py-1 rounded-xl text-sm font-bold ${
                          fb.scores.total >= 80 ? 'bg-green-600/20 text-green-400' :
                          fb.scores.total >= 60 ? 'bg-yellow-600/20 text-yellow-400' :
                          'bg-red-600/20 text-red-400'
                        }`}>
                          {fb.scores.total}점
                        </span>
                      )}
                      {/* 상태 뱃지 */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 ${
                        statusLabels[displayStatus]?.color || 'bg-slate-600/20 text-slate-400'
                      }`}>
                        {isGenerating && (
                          <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                        )}
                        {statusLabels[displayStatus]?.text || displayStatus}
                      </span>
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                    {/* 발송 상태 */}
                    {emailSent && (
                      <span className="text-xs text-emerald-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        이메일 발송됨
                      </span>
                    )}
                    {isFailed && (
                      <span className="text-xs text-red-400 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        피드백 생성 실패
                      </span>
                    )}
                  </div>
                </div>

                {/* 피드백 생성 중 프로그레스 바 */}
                {isGenerating && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm text-yellow-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-yellow-400" />
                      <span>AI가 과제를 분석하고 있습니다...</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-[progress_3s_ease-in-out_infinite]" style={{ width: '60%' }} />
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
