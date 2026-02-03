// src/app/(lms)/lms-admin/jobs/page.tsx
// 피드백 작업 모니터링 페이지 (Realtime)
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useLmsAdminRealtime } from '@/hooks/useLmsRealtime';

interface Job {
  id: string;
  assignment_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  worker_type: string;
  priority: number;
  attempts: number;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  created_at: string;
  assignments: {
    id: string;
    user_id: string;
    version: number;
    profiles: {
      email: string;
      full_name: string | null;
    };
    courses: {
      title: string;
    };
    course_weeks: {
      week_number: number;
      title: string;
    };
  };
}

interface JobStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

const statusLabels: Record<string, { text: string; color: string; bgColor: string }> = {
  pending: { text: '대기 중', color: 'text-yellow-400', bgColor: 'bg-yellow-600/20' },
  processing: { text: '처리 중', color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  completed: { text: '완료', color: 'text-green-400', bgColor: 'bg-green-600/20' },
  failed: { text: '실패', color: 'text-red-400', bgColor: 'bg-red-600/20' },
  cancelled: { text: '취소됨', color: 'text-slate-400', bgColor: 'bg-slate-600/20' },
};

export default function JobsAdminPage() {
  const { accessToken } = useAuthStore();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [stats, setStats] = useState<JobStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchJobs = useCallback(async () => {
    if (!accessToken) return;

    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      params.append('limit', '100');

      const response = await fetch(`/api/lms/jobs?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('작업 목록을 불러오는데 실패했습니다');

      const result = await response.json();
      if (result.success) {
        setJobs(result.data.jobs || []);
        setStats(result.data.stats || null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Auto-refresh every 10 seconds (fallback)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchJobs, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchJobs]);

  // Realtime subscription for instant updates
  useLmsAdminRealtime({
    onJobUpdate: () => {
      // Instantly refresh when any job status changes
      fetchJobs();
    },
    enabled: autoRefresh,
  });

  const handleRetry = async (jobId: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`/api/lms/jobs/${jobId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '재시도 실패');
      }

      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  const handleCancel = async (jobId: string) => {
    if (!accessToken) return;
    if (!confirm('이 작업을 취소하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/lms/jobs/${jobId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '취소 실패');
      }

      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  const handleDeleteAllFailed = async () => {
    if (!accessToken) return;
    if (!confirm('모든 실패한 작업을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch('/api/lms/jobs', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deleteAllFailed: true }),
      });

      if (!response.ok) throw new Error('삭제 실패');

      fetchJobs();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">작업 모니터</h1>
          <p className="text-slate-400 mt-1">AI 피드백 생성 작업을 모니터링합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              autoRefresh
                ? 'bg-green-600/20 text-green-400 border border-green-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-green-400 animate-pulse' : 'bg-slate-500'}`} />
            실시간
          </button>
          <button
            onClick={fetchJobs}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            새로고침
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-yellow-600/20 rounded-xl p-4 border border-yellow-500/30">
            <p className="text-3xl font-bold text-yellow-400">{stats.pending}</p>
            <p className="text-sm text-yellow-400/70">대기 중</p>
          </div>
          <div className="bg-blue-600/20 rounded-xl p-4 border border-blue-500/30">
            <p className="text-3xl font-bold text-blue-400">{stats.processing}</p>
            <p className="text-sm text-blue-400/70">처리 중</p>
          </div>
          <div className="bg-green-600/20 rounded-xl p-4 border border-green-500/30">
            <p className="text-3xl font-bold text-green-400">{stats.completed}</p>
            <p className="text-sm text-green-400/70">완료</p>
          </div>
          <div className="bg-red-600/20 rounded-xl p-4 border border-red-500/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold text-red-400">{stats.failed}</p>
                <p className="text-sm text-red-400/70">실패</p>
              </div>
              {stats.failed > 0 && (
                <button
                  onClick={handleDeleteAllFailed}
                  className="px-2 py-1 text-xs bg-red-600/30 hover:bg-red-600/50 text-red-400 rounded transition-colors"
                >
                  모두 삭제
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2">
        {['all', 'pending', 'processing', 'completed', 'failed'].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === status
                ? 'bg-amber-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            {status === 'all' ? '전체' : statusLabels[status]?.text || status}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Job List */}
      {jobs.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">작업이 없습니다</h3>
          <p className="text-slate-400">
            {statusFilter === 'all'
              ? '최근 24시간 내 피드백 작업이 없습니다.'
              : `${statusLabels[statusFilter]?.text} 상태의 작업이 없습니다.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className={`bg-slate-800/50 rounded-xl p-4 border border-slate-700 ${
                job.status === 'processing' ? 'border-blue-500/30' :
                job.status === 'failed' ? 'border-red-500/30' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${statusLabels[job.status]?.bgColor}`}>
                    {job.status === 'processing' ? (
                      <svg className="w-5 h-5 text-blue-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    ) : job.status === 'completed' ? (
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : job.status === 'failed' ? (
                      <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusLabels[job.status]?.bgColor} ${statusLabels[job.status]?.color}`}>
                        {statusLabels[job.status]?.text}
                      </span>
                      <span className="text-slate-500 text-xs">
                        우선순위 {job.priority} · 시도 {job.attempts}회
                      </span>
                    </div>
                    <p className="text-white font-medium mt-1">
                      {job.assignments?.course_weeks?.week_number}주차: {job.assignments?.course_weeks?.title}
                    </p>
                    <p className="text-sm text-slate-400">
                      {job.assignments?.profiles?.full_name || job.assignments?.profiles?.email} · {job.assignments?.courses?.title}
                    </p>
                    {job.error_message && (
                      <p className="text-sm text-red-400 mt-2 bg-red-900/20 rounded px-2 py-1">
                        {job.error_message}
                      </p>
                    )}
                    <p className="text-xs text-slate-500 mt-2">
                      생성: {new Date(job.created_at).toLocaleString('ko-KR')}
                      {job.completed_at && ` · 완료: ${new Date(job.completed_at).toLocaleString('ko-KR')}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {job.status === 'failed' && (
                    <button
                      onClick={() => handleRetry(job.id)}
                      className="px-3 py-1 text-sm bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded transition-colors"
                    >
                      재시도
                    </button>
                  )}
                  {job.status === 'pending' && (
                    <button
                      onClick={() => handleCancel(job.id)}
                      className="px-3 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
                    >
                      취소
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
