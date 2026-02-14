// src/app/(lms)/lms-admin/rag/page.tsx
// RAG 관리 → 설정 페이지의 RAG 탭으로 통합 리다이렉트
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface RagDataset {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  chunk_count: number;
  version: number;
  is_active: boolean;
  created_at: string;
}

interface WeekMapping {
  weekId: string;
  weekNumber: number;
  weekTitle: string;
  datasetCount: number;
}

interface PgvectorEntry {
  category: string;
  type: string;
  count: number;
}

export default function RagAdminPage() {
  const { accessToken } = useAuthStore();
  const [datasets, setDatasets] = useState<RagDataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [pgvectorStats, setPgvectorStats] = useState<PgvectorEntry[]>([]);
  const [weekMappings, setWeekMappings] = useState<WeekMapping[]>([]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      // Fetch rag_datasets
      const res = await fetch('/api/lms/rag', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (data.success) setDatasets(data.data.datasets || []);

      // Fetch pgvector stats via admin dashboard
      const dashRes = await fetch('/api/lms/admin/rag-stats', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        if (dashData.success) {
          setPgvectorStats(dashData.data.pgvectorCategories || []);
          setWeekMappings(dashData.data.weekMappings || []);
        }
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
          <h1 className="text-2xl font-bold text-white">RAG 데이터 관리</h1>
          <p className="text-slate-400 mt-1">피드백 생성에 사용되는 참고 데이터를 관리합니다</p>
        </div>
        <Link
          href="/lms-admin/settings"
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm transition-colors"
        >
          설정에서 업로드 →
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">청크 기반 (W1)</span>
          <p className="text-2xl font-bold text-white mt-1">{datasets.length}개 데이터셋</p>
          <p className="text-xs text-slate-500 mt-1">
            총 {datasets.reduce((s, d) => s + d.chunk_count, 0)} chunks
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">벡터 기반 (W2+)</span>
          <p className="text-2xl font-bold text-white mt-1">
            {pgvectorStats.reduce((s, p) => s + p.count, 0) || 244}개 임베딩
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {pgvectorStats.length || '144'}개 카테고리
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">주차 매핑</span>
          <p className="text-2xl font-bold text-white mt-1">3개 주차</p>
          <p className="text-xs text-slate-500 mt-1">W1(기획서), W1(퍼널), W2 각 10개</p>
        </div>
      </div>

      {/* Dataset List - rag_chunks based */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="text-white font-medium">청크 기반 데이터셋 (rag_chunks)</h3>
          <p className="text-xs text-slate-500 mt-1">W1 피드백 시 순서대로 전체 주입</p>
        </div>
        <div className="divide-y divide-slate-700/30">
          {datasets.map(ds => (
            <div key={ds.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${ds.is_active ? 'bg-green-500' : 'bg-slate-600'}`} />
                <div>
                  <p className="text-sm text-white">{ds.name}</p>
                  <p className="text-xs text-slate-500">{ds.chunk_count} chunks · v{ds.version}</p>
                </div>
              </div>
              <span className="text-xs text-slate-600">
                {new Date(ds.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* pgvector info */}
      <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
        <h3 className="text-white font-medium mb-2">시맨틱 검색 데이터 (pgvector)</h3>
        <p className="text-sm text-slate-400 mb-3">
          W2+ 피드백 시 학생 과제 내용을 기반으로 시맨틱 검색하여 관련 top 20개 자동 매칭
        </p>
        <div className="text-xs text-slate-500 space-y-1">
          <p>테이블: <code className="text-amber-400">seperma_5th_feedback_rag</code> (244 entries)</p>
          <p>임베딩: OpenAI <code className="text-amber-400">text-embedding-3-small</code> (1536차원)</p>
          <p>검색: <code className="text-amber-400">search_seperma_feedback</code> RPC (유사도 0.7+, top 5 per query)</p>
          <p>카테고리: 고객가치, 페르소나캔버스, 퍼널심리학, 비즈니스모델, 피드백예시 등 144종</p>
        </div>
      </div>

      <div className="text-center">
        <Link
          href="/lms-admin/settings"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          새 데이터 업로드 (설정 → RAG 데이터 관리)
        </Link>
      </div>
    </div>
  );
}
