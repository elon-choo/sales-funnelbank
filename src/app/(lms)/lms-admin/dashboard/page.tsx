// src/app/(lms)/lms-admin/dashboard/page.tsx
// 세퍼마 LMS 관리자 대시보드 (API 연동)
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface AdminDashboardData {
  type: 'admin';
  courses: Array<{
    id: string;
    title: string;
    status: string;
    total_weeks: number;
  }>;
  totalEnrollments: number;
  assignmentStats: {
    total: number;
    draft: number;
    submitted: number;
    reviewed: number;
  };
  jobStats: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    total24h: number;
  };
  costStats: {
    totalCostUsd: number;
    feedbackCount: number;
    byModel: Record<string, { count: number; cost: number }>;
  };
  generatedAt: string;
}

const MONTHLY_BUDGET = 800; // $800/month
const DAILY_BUDGET = 40;    // ~$40/day

export default function LmsAdminDashboardPage() {
  const { accessToken } = useAuthStore();
  const [dashboardData, setDashboardData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');

  useEffect(() => {
    const fetchDashboard = async () => {
      if (!accessToken) return;

      try {
        const params = new URLSearchParams();
        if (selectedCourse !== 'all') {
          params.append('courseId', selectedCourse);
        }

        const response = await fetch(`/api/lms/dashboard?${params.toString()}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('대시보드 데이터를 불러오는데 실패했습니다');
        }

        const result = await response.json();
        if (result.success && result.data.type === 'admin') {
          setDashboardData(result.data);
        } else {
          throw new Error(result.error?.message || '관리자 권한이 필요합니다');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [accessToken, selectedCourse]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
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

  const weeklyBudgetUsage = dashboardData?.costStats?.totalCostUsd
    ? (dashboardData.costStats.totalCostUsd / (DAILY_BUDGET * 7)) * 100
    : 0;
  const avgCostPerFeedback = dashboardData?.costStats?.feedbackCount
    ? dashboardData.costStats.totalCostUsd / dashboardData.costStats.feedbackCount
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">대시보드</h1>
          <p className="text-slate-400">LMS 전체 현황을 확인하세요</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedCourse}
            onChange={(e) => setSelectedCourse(e.target.value)}
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">전체 기수</option>
            {dashboardData?.courses?.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="활성 수강생"
          value={dashboardData?.totalEnrollments?.toString() || '0'}
          change={`${dashboardData?.courses?.length || 0}개 기수`}
          changeType="neutral"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          }
        />
        <StatCard
          title="제출된 과제"
          value={dashboardData?.assignmentStats?.submitted?.toString() || '0'}
          change={`총 ${dashboardData?.assignmentStats?.total || 0}개`}
          changeType="neutral"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
        />
        <StatCard
          title="대기 중 피드백"
          value={(dashboardData?.jobStats?.pending || 0 + (dashboardData?.jobStats?.processing || 0)).toString()}
          change={`${dashboardData?.jobStats?.failed || 0}개 실패`}
          changeType={dashboardData?.jobStats?.failed ? 'negative' : 'positive'}
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          title="주간 AI 비용"
          value={`$${dashboardData?.costStats?.totalCostUsd?.toFixed(2) || '0.00'}`}
          change={`${weeklyBudgetUsage.toFixed(0)}% 사용`}
          changeType={weeklyBudgetUsage > 80 ? 'negative' : weeklyBudgetUsage > 50 ? 'neutral' : 'positive'}
          subtitle="주간 예산의"
          icon={
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assignment Status */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">과제 현황</h2>
          <div className="space-y-4">
            {[
              { label: '초안', value: dashboardData?.assignmentStats?.draft || 0, color: 'bg-slate-500' },
              { label: '제출됨', value: dashboardData?.assignmentStats?.submitted || 0, color: 'bg-blue-500' },
              { label: '피드백 완료', value: dashboardData?.assignmentStats?.reviewed || 0, color: 'bg-green-500' },
            ].map((item) => {
              const total = dashboardData?.assignmentStats?.total || 1;
              const percentage = (item.value / total) * 100;
              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">{item.label}</span>
                    <span className="text-white">{item.value}개 ({percentage.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Job Queue Status */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">피드백 작업 현황</h2>
            <span className="text-sm text-slate-400">최근 24시간</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <JobStatusCard status="pending" count={dashboardData?.jobStats?.pending || 0} label="대기 중" />
            <JobStatusCard status="processing" count={dashboardData?.jobStats?.processing || 0} label="처리 중" />
            <JobStatusCard status="completed" count={dashboardData?.jobStats?.completed || 0} label="완료" />
            <JobStatusCard status="failed" count={dashboardData?.jobStats?.failed || 0} label="실패" />
          </div>
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-400">24시간 처리량</span>
              <span className="text-white">{dashboardData?.jobStats?.total24h || 0}개</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions & Cost Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h2 className="text-lg font-semibold text-white mb-4">빠른 작업</h2>
          <div className="grid grid-cols-2 gap-4">
            <Link
              href="/lms-admin/courses"
              className="p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-8 h-8 text-amber-400 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p className="font-medium text-white">기수 관리</p>
              <p className="text-sm text-slate-400">{dashboardData?.courses?.length || 0}개 기수</p>
            </Link>
            <Link
              href="/lms-admin/enrollments"
              className="p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-8 h-8 text-blue-400 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="font-medium text-white">수강생 관리</p>
              <p className="text-sm text-slate-400">{dashboardData?.totalEnrollments || 0}명</p>
            </Link>
            <Link
              href="/lms-admin/assignments"
              className="p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-8 h-8 text-green-400 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-medium text-white">과제 관리</p>
              <p className="text-sm text-slate-400">{dashboardData?.assignmentStats?.total || 0}개</p>
            </Link>
            <Link
              href="/lms-admin/jobs"
              className="p-4 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors group"
            >
              <svg className="w-8 h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <p className="font-medium text-white">작업 모니터</p>
              <p className="text-sm text-slate-400">{dashboardData?.jobStats?.pending || 0}개 대기</p>
            </Link>
          </div>
        </div>

        {/* AI Cost Summary */}
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">AI 비용 현황</h2>
            <span className={`px-2 py-1 text-xs font-medium rounded ${
              weeklyBudgetUsage > 80 ? 'bg-red-600/20 text-red-400' :
              weeklyBudgetUsage > 50 ? 'bg-yellow-600/20 text-yellow-400' :
              'bg-green-600/20 text-green-400'
            }`}>
              {weeklyBudgetUsage > 80 ? '주의' : weeklyBudgetUsage > 50 ? '보통' : '정상'}
            </span>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-900/50 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-400">주간 (최근 7일)</span>
                <span className="text-white font-medium">
                  ${dashboardData?.costStats?.totalCostUsd?.toFixed(2) || '0.00'} / ${DAILY_BUDGET * 7}
                </span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    weeklyBudgetUsage > 80 ? 'bg-red-500' :
                    weeklyBudgetUsage > 50 ? 'bg-yellow-500' :
                    'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(weeklyBudgetUsage, 100)}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="text-center p-3 bg-slate-900/30 rounded-lg">
                <p className="text-2xl font-bold text-white">{dashboardData?.costStats?.feedbackCount || 0}</p>
                <p className="text-xs text-slate-400">생성된 피드백</p>
              </div>
              <div className="text-center p-3 bg-slate-900/30 rounded-lg">
                <p className="text-2xl font-bold text-white">${avgCostPerFeedback.toFixed(2)}</p>
                <p className="text-xs text-slate-400">피드백당 비용</p>
              </div>
            </div>
            {/* Model breakdown */}
            {dashboardData?.costStats?.byModel && Object.keys(dashboardData.costStats.byModel).length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-sm text-slate-400 mb-2">모델별 사용량</p>
                <div className="space-y-2">
                  {Object.entries(dashboardData.costStats.byModel).map(([model, data]) => (
                    <div key={model} className="flex items-center justify-between text-sm">
                      <span className="text-slate-300">{model}</span>
                      <span className="text-white">{data.count}개 · ${data.cost.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper Components
function StatCard({
  title,
  value,
  change,
  changeType,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  subtitle?: string;
  icon: React.ReactNode;
}) {
  const changeColors = {
    positive: 'text-green-400',
    negative: 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <span className="text-slate-400 text-sm">{title}</span>
        <div className="text-amber-400">{icon}</div>
      </div>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className={`text-sm ${changeColors[changeType]}`}>
        {change} {subtitle || ''}
      </p>
    </div>
  );
}

function JobStatusCard({
  status,
  count,
  label,
}: {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  count: number;
  label: string;
}) {
  const statusStyles = {
    pending: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
    processing: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-600/20 text-green-400 border-green-500/30',
    failed: 'bg-red-600/20 text-red-400 border-red-500/30',
  };

  return (
    <div className={`p-4 rounded-xl border ${statusStyles[status]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  );
}
