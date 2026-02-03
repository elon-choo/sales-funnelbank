// src/app/(lms)/lms/dashboard/page.tsx
// 세퍼마 LMS 학생 대시보드 (API 연동 + Realtime)
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useLmsRealtime } from '@/hooks/useLmsRealtime';
import Link from 'next/link';

interface DashboardData {
  type: 'student';
  enrollments: Array<{
    id: string;
    course_id: string;
    status: string;
    enrolled_at: string;
    courses: {
      id: string;
      title: string;
      status: string;
      total_weeks: number;
    };
  }>;
  assignmentStats: {
    total: number;
    draft: number;
    submitted: number;
    reviewed: number;
  };
  pendingJobs: Array<{
    id: string;
    status: string;
    created_at: string;
  }>;
  recentFeedbacks: Array<{
    id: string;
    score: number | null;
    created_at: string;
    assignments: {
      id: string;
      week_id: string;
      course_weeks: {
        week_number: number;
        title: string;
      };
    };
  }>;
  averageScore: number | null;
  generatedAt: string;
}

export default function LmsDashboardPage() {
  const { user, accessToken } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('/api/lms/dashboard', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('대시보드 데이터를 불러오는데 실패했습니다');
      }

      const result = await response.json();
      if (result.success) {
        setDashboardData(result.data);
      } else {
        throw new Error(result.error?.message || '알 수 없는 오류');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Realtime subscription for job updates
  useLmsRealtime({
    userId: user?.id,
    onJobUpdate: (job, eventType) => {
      if (eventType === 'UPDATE') {
        if (job.status === 'processing') {
          setRealtimeStatus('AI가 피드백을 생성하고 있습니다...');
        } else if (job.status === 'completed') {
          setRealtimeStatus('피드백 생성이 완료되었습니다!');
          // Refresh dashboard data after feedback completion
          fetchDashboard();
          setTimeout(() => setRealtimeStatus(null), 3000);
        } else if (job.status === 'failed') {
          setRealtimeStatus('피드백 생성에 실패했습니다.');
          setTimeout(() => setRealtimeStatus(null), 5000);
        }
      }
    },
    onFeedbackCreate: () => {
      // Refresh dashboard when new feedback is created
      fetchDashboard();
    },
    enabled: !!user?.id,
  });

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

  const enrollment = dashboardData?.enrollments?.[0];
  const course = enrollment?.courses;

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-8 border border-purple-500/20">
        <h1 className="text-2xl font-bold text-white mb-2">
          안녕하세요, <span className="text-purple-400">{user?.fullName || '수강생'}</span>님!
        </h1>
        <p className="text-slate-300">
          {course ? `${course.title}에서 열심히 배우고 계시네요!` : '마그네틱 세일즈 마스터클래스에 오신 것을 환영합니다.'}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard
          title="수강 중인 기수"
          value={dashboardData?.enrollments?.length?.toString() || '0'}
          subtitle={course?.title || '미등록'}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          }
          color="purple"
        />
        <StatCard
          title="제출한 과제"
          value={dashboardData?.assignmentStats?.submitted?.toString() || '0'}
          subtitle={`총 ${course?.total_weeks || 0}주차 중`}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          color="blue"
        />
        <StatCard
          title="받은 피드백"
          value={dashboardData?.assignmentStats?.reviewed?.toString() || '0'}
          subtitle={dashboardData?.pendingJobs?.length ? `${dashboardData.pendingJobs.length}개 처리 중` : '대기 없음'}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          }
          color="green"
        />
        <StatCard
          title="평균 점수"
          value={dashboardData?.averageScore?.toString() || '-'}
          subtitle="100점 만점"
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          }
          color="yellow"
        />
      </div>

      {/* Realtime Status Toast */}
      {realtimeStatus && (
        <div className="fixed top-20 right-6 z-50 animate-slide-in-right">
          <div className="bg-slate-800 border border-purple-500/50 rounded-xl px-4 py-3 shadow-lg flex items-center gap-3">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
            <span className="text-sm text-slate-200">{realtimeStatus}</span>
          </div>
        </div>
      )}

      {/* Pending Jobs Alert */}
      {dashboardData?.pendingJobs && dashboardData.pendingJobs.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-yellow-600/20 rounded-full flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
          <div>
            <p className="text-yellow-400 font-medium">피드백 생성 중</p>
            <p className="text-sm text-yellow-400/70">
              {dashboardData.pendingJobs.length}개의 과제에 대한 AI 피드백이 생성되고 있습니다. 잠시 후 확인해주세요.
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/lms/assignments"
          className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 hover:border-purple-500/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center group-hover:bg-purple-600/30 transition-colors">
              <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-purple-400 transition-colors">과제 목록 보기</h3>
              <p className="text-sm text-slate-400">제출한 과제와 피드백을 확인하세요</p>
            </div>
          </div>
        </Link>

        <Link
          href="/lms/feedbacks"
          className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 hover:border-green-500/50 transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-600/20 rounded-xl flex items-center justify-center group-hover:bg-green-600/30 transition-colors">
              <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-green-400 transition-colors">피드백 모아보기</h3>
              <p className="text-sm text-slate-400">받은 AI 피드백을 한눈에 확인하세요</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Recent Feedbacks */}
      {dashboardData?.recentFeedbacks && dashboardData.recentFeedbacks.length > 0 && (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">최근 피드백</h2>
          <div className="space-y-3">
            {dashboardData.recentFeedbacks.map((feedback) => (
              <Link
                key={feedback.id}
                href={`/lms/feedbacks/${feedback.id}`}
                className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-400">
                      {feedback.assignments?.course_weeks?.week_number || '?'}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-white">
                      {feedback.assignments?.course_weeks?.week_number}주차: {feedback.assignments?.course_weeks?.title || '과제'}
                    </p>
                    <p className="text-sm text-slate-400">
                      {new Date(feedback.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {feedback.score !== null && (
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      feedback.score >= 80 ? 'bg-green-600/20 text-green-400' :
                      feedback.score >= 60 ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-red-600/20 text-red-400'
                    }`}>
                      {feedback.score}점
                    </span>
                  )}
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Helper Components
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'purple' | 'blue' | 'green' | 'yellow';
}) {
  const colors = {
    purple: 'from-purple-600/20 to-purple-900/20 border-purple-500/30 text-purple-400',
    blue: 'from-blue-600/20 to-blue-900/20 border-blue-500/30 text-blue-400',
    green: 'from-green-600/20 to-green-900/20 border-green-500/30 text-green-400',
    yellow: 'from-yellow-600/20 to-yellow-900/20 border-yellow-500/30 text-yellow-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colors[color]} rounded-2xl p-6 border`}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-400 text-sm font-medium">{title}</span>
        <div className={colors[color].split(' ').pop()}>{icon}</div>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}
