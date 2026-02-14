// src/app/(lms)/lms-admin/costs/page.tsx
// AI 비용 모니터링 페이지
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface CostData {
  totalCost: number;
  totalFeedbacks: number;
  totalTokensIn: number;
  totalTokensOut: number;
  avgCostPerFeedback: number;
  dailyCosts: Array<{ date: string; cost: number; count: number }>;
  byModel: Record<string, { count: number; cost: number; tokensIn: number; tokensOut: number }>;
  byWeek: Array<{ weekNumber: number; title: string; count: number; cost: number }>;
}

export default function CostsPage() {
  const { accessToken } = useAuthStore();
  const [data, setData] = useState<CostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | 'all'>('30d');

  const fetchCosts = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lms/admin/costs?period=${period}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const result = await res.json();
        if (result.success) setData(result.data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [accessToken, period]);

  useEffect(() => { fetchCosts(); }, [fetchCosts]);

  const formatUsd = (n: number) => '$' + n.toFixed(2);
  const formatTokens = (n: number) => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(0) + 'K' : String(n);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI 비용 모니터링</h1>
          <p className="text-slate-400 mt-1">피드백 생성 비용을 추적합니다</p>
        </div>
        <div className="flex gap-2">
          {(['7d', '30d', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm ${period === p ? 'bg-amber-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
            >
              {p === '7d' ? '7일' : p === '30d' ? '30일' : '전체'}
            </button>
          ))}
        </div>
      </div>

      {data && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <span className="text-xs text-slate-500 uppercase">총 비용</span>
              <p className="text-2xl font-bold text-amber-400 mt-1">{formatUsd(data.totalCost)}</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <span className="text-xs text-slate-500 uppercase">피드백 수</span>
              <p className="text-2xl font-bold text-white mt-1">{data.totalFeedbacks}개</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <span className="text-xs text-slate-500 uppercase">평균 비용</span>
              <p className="text-2xl font-bold text-white mt-1">{formatUsd(data.avgCostPerFeedback)}/건</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <span className="text-xs text-slate-500 uppercase">총 토큰</span>
              <p className="text-2xl font-bold text-white mt-1">{formatTokens(data.totalTokensIn + data.totalTokensOut)}</p>
              <p className="text-xs text-slate-500 mt-1">IN {formatTokens(data.totalTokensIn)} / OUT {formatTokens(data.totalTokensOut)}</p>
            </div>
          </div>

          {/* Daily Cost Chart */}
          {data.dailyCosts.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-white font-medium mb-3">일별 비용</h3>
              <div className="flex items-end gap-1 h-32">
                {data.dailyCosts.map((day, i) => {
                  const maxCost = Math.max(...data.dailyCosts.map(d => d.cost), 0.01);
                  const height = Math.max(4, (day.cost / maxCost) * 100);
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-slate-500">{formatUsd(day.cost)}</span>
                      <div
                        className="w-full bg-amber-500/60 rounded-t"
                        style={{ height: `${height}%` }}
                        title={`${day.date}: ${formatUsd(day.cost)} (${day.count}건)`}
                      />
                      <span className="text-[9px] text-slate-600 truncate w-full text-center">
                        {day.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* By Model */}
          {Object.keys(data.byModel).length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-white font-medium mb-3">모델별 비용</h3>
              <div className="space-y-2">
                {Object.entries(data.byModel).map(([model, stats]) => (
                  <div key={model} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div>
                      <p className="text-sm text-white font-mono">{model || 'unknown'}</p>
                      <p className="text-xs text-slate-500">{stats.count}건 · IN {formatTokens(stats.tokensIn)} · OUT {formatTokens(stats.tokensOut)}</p>
                    </div>
                    <span className="text-amber-400 font-bold">{formatUsd(stats.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* By Week */}
          {data.byWeek.length > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
              <h3 className="text-white font-medium mb-3">주차별 비용</h3>
              <div className="space-y-2">
                {data.byWeek.map(w => (
                  <div key={w.weekNumber} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                    <div>
                      <p className="text-sm text-white">W{w.weekNumber} {w.title}</p>
                      <p className="text-xs text-slate-500">{w.count}건</p>
                    </div>
                    <span className="text-amber-400 font-bold">{formatUsd(w.cost)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
