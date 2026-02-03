// src/app/(lms)/lms-admin/analytics/page.tsx
// 수강생 분석 대시보드 페이지
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface AnalyticsData {
  dateRange: { from: string; to: string };
  enrollmentStats: {
    total: number;
    active: number;
    completed: number;
    paused: number;
    dropped: number;
  };
  submissionStats: {
    total: number;
    submitted: number;
    draft: number;
  };
  dailySubmissions: Record<string, number>;
  scoreDistribution: {
    excellent: number;
    good: number;
    average: number;
    belowAverage: number;
    poor: number;
  };
  averageScore: number | null;
  weeklyStats: Array<{
    weekId: string;
    submissions: number;
    avgScore: number | null;
    completionRate: number;
  }>;
  activityStats: {
    activeUsers: number;
    inactiveUsers: number;
    activityRate: number;
  };
  costStats: {
    totalCost: number;
    totalTokens: number;
    avgGenerationTime: number;
    modelUsage: Record<string, { count: number; cost: number }>;
    feedbackCount: number;
    avgCostPerFeedback: number;
  };
  topPerformers: Array<{
    userId: string;
    avgScore: number;
    feedbackCount: number;
  }>;
}

export default function AnalyticsDashboardPage() {
  const { accessToken } = useAuthStore();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchAnalytics();
  }, [accessToken, dateRange]);

  const fetchAnalytics = async () => {
    if (!accessToken) return;

    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
      });

      const response = await fetch(`/api/lms/analytics?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('분석 데이터를 불러오는데 실패했습니다');

      const result = await response.json();
      if (result.success) {
        setData(result.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">수강생 분석</h1>
          <p className="text-slate-400">학습 현황과 성과를 분석합니다</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <span className="text-slate-500">~</span>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <SummaryCard
              title="활성 수강생"
              value={data.enrollmentStats.active.toString()}
              subtitle={`전체 ${data.enrollmentStats.total}명`}
              color="amber"
            />
            <SummaryCard
              title="제출된 과제"
              value={data.submissionStats.submitted.toString()}
              subtitle={`${Math.round((data.submissionStats.submitted / Math.max(data.submissionStats.total, 1)) * 100)}% 제출률`}
              color="blue"
            />
            <SummaryCard
              title="평균 점수"
              value={data.averageScore?.toFixed(1) || '-'}
              subtitle="100점 만점"
              color="green"
            />
            <SummaryCard
              title="활동률"
              value={`${data.activityStats.activityRate}%`}
              subtitle={`${data.activityStats.activeUsers}명 활동`}
              color="purple"
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Score Distribution */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">점수 분포</h2>
              <div className="space-y-3">
                {[
                  { label: '90점 이상 (우수)', value: data.scoreDistribution.excellent, color: 'bg-green-500' },
                  { label: '80-89점 (양호)', value: data.scoreDistribution.good, color: 'bg-blue-500' },
                  { label: '70-79점 (보통)', value: data.scoreDistribution.average, color: 'bg-yellow-500' },
                  { label: '60-69점 (미흡)', value: data.scoreDistribution.belowAverage, color: 'bg-orange-500' },
                  { label: '60점 미만 (노력)', value: data.scoreDistribution.poor, color: 'bg-red-500' },
                ].map((item) => {
                  const total = Object.values(data.scoreDistribution).reduce((a, b) => a + b, 0) || 1;
                  const percentage = (item.value / total) * 100;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-400">{item.label}</span>
                        <span className="text-white">{item.value}명 ({percentage.toFixed(0)}%)</span>
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

            {/* Enrollment Status */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">수강 상태</h2>
              <div className="grid grid-cols-2 gap-4">
                <StatusCard status="active" count={data.enrollmentStats.active} label="수강 중" />
                <StatusCard status="completed" count={data.enrollmentStats.completed} label="수료" />
                <StatusCard status="paused" count={data.enrollmentStats.paused} label="휴강" />
                <StatusCard status="dropped" count={data.enrollmentStats.dropped} label="중도 포기" />
              </div>
            </div>
          </div>

          {/* Weekly Stats */}
          <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
            <h2 className="text-lg font-semibold text-white mb-4">주차별 현황</h2>
            {data.weeklyStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-medium py-3 px-4">주차</th>
                      <th className="text-right text-slate-400 font-medium py-3 px-4">제출 수</th>
                      <th className="text-right text-slate-400 font-medium py-3 px-4">평균 점수</th>
                      <th className="text-right text-slate-400 font-medium py-3 px-4">완료율</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weeklyStats.map((week, index) => (
                      <tr key={week.weekId} className="border-b border-slate-700/50">
                        <td className="py-3 px-4 text-white">{index + 1}주차</td>
                        <td className="py-3 px-4 text-right text-white">{week.submissions}개</td>
                        <td className="py-3 px-4 text-right">
                          <span className={week.avgScore && week.avgScore >= 80 ? 'text-green-400' : week.avgScore && week.avgScore >= 70 ? 'text-yellow-400' : 'text-slate-400'}>
                            {week.avgScore?.toFixed(1) || '-'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full"
                                style={{ width: `${week.completionRate}%` }}
                              />
                            </div>
                            <span className="text-slate-400 w-12">{week.completionRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">주차 데이터가 없습니다</p>
            )}
          </div>

          {/* Bottom Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">우수 수강생 Top 10</h2>
              {data.topPerformers.length > 0 ? (
                <div className="space-y-3">
                  {data.topPerformers.map((performer, index) => (
                    <div key={performer.userId} className="flex items-center gap-4 p-3 bg-slate-900/50 rounded-xl">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                        index === 1 ? 'bg-slate-400/20 text-slate-300' :
                        index === 2 ? 'bg-orange-500/20 text-orange-400' :
                        'bg-slate-700 text-slate-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{performer.userId.slice(0, 8)}...</p>
                        <p className="text-slate-500 text-xs">{performer.feedbackCount}개 피드백</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-400">{performer.avgScore}</p>
                        <p className="text-xs text-slate-500">평균 점수</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center py-8">데이터가 없습니다</p>
              )}
            </div>

            {/* AI Cost Analysis */}
            <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
              <h2 className="text-lg font-semibold text-white mb-4">AI 비용 분석</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-slate-900/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-white">${data.costStats.totalCost.toFixed(2)}</p>
                  <p className="text-sm text-slate-400">총 비용</p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-white">{data.costStats.feedbackCount}</p>
                  <p className="text-sm text-slate-400">피드백 수</p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-white">${data.costStats.avgCostPerFeedback.toFixed(2)}</p>
                  <p className="text-sm text-slate-400">피드백당 비용</p>
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl text-center">
                  <p className="text-2xl font-bold text-white">{(data.costStats.avgGenerationTime / 1000).toFixed(1)}s</p>
                  <p className="text-sm text-slate-400">평균 생성 시간</p>
                </div>
              </div>

              {Object.keys(data.costStats.modelUsage).length > 0 && (
                <div className="border-t border-slate-700 pt-4">
                  <p className="text-sm text-slate-400 mb-3">모델별 사용량</p>
                  <div className="space-y-2">
                    {Object.entries(data.costStats.modelUsage).map(([model, usage]) => (
                      <div key={model} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{model}</span>
                        <span className="text-white">{usage.count}회 · ${usage.cost.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper Components
function SummaryCard({
  title,
  value,
  subtitle,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  color: 'amber' | 'blue' | 'green' | 'purple';
}) {
  const colorStyles = {
    amber: 'border-amber-500/30 bg-amber-500/10',
    blue: 'border-blue-500/30 bg-blue-500/10',
    green: 'border-green-500/30 bg-green-500/10',
    purple: 'border-purple-500/30 bg-purple-500/10',
  };

  return (
    <div className={`rounded-2xl p-6 border ${colorStyles[color]}`}>
      <p className="text-slate-400 text-sm mb-2">{title}</p>
      <p className="text-3xl font-bold text-white mb-1">{value}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function StatusCard({
  status,
  count,
  label,
}: {
  status: 'active' | 'completed' | 'paused' | 'dropped';
  count: number;
  label: string;
}) {
  const statusStyles = {
    active: 'bg-green-600/20 text-green-400 border-green-500/30',
    completed: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
    paused: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
    dropped: 'bg-red-600/20 text-red-400 border-red-500/30',
  };

  return (
    <div className={`p-4 rounded-xl border ${statusStyles[status]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm opacity-80">{label}</p>
    </div>
  );
}
