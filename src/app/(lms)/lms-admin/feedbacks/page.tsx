// src/app/(lms)/lms-admin/feedbacks/page.tsx
// 관리자 피드백 관리 페이지 - 전체 피드백 조회/관리/재생성/이메일 재발송
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface FeedbackItem {
  id: string;
  assignment_id: string;
  version: number;
  content: string;
  summary: string;
  scores: { total: number; [key: string]: number } | null;
  tokens_input: number | null;
  tokens_output: number | null;
  generation_time_ms: number | null;
  status: string;
  created_at: string;
  assignments: {
    id: string;
    user_id: string;
    course_id: string;
    week_id: string;
    version: number;
    status: string;
    profiles: { id: string; email: string; full_name: string };
    courses: { id: string; title: string };
    course_weeks: { id: string; week_number: number; title: string };
  };
}

type SortField = 'created_at' | 'score' | 'student' | 'week' | 'tokens' | 'time';
type SortDir = 'asc' | 'desc';

export default function AdminFeedbacksPage() {
  const { accessToken } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [weekFilter, setWeekFilter] = useState<string>('all');
  const [studentFilter, setStudentFilter] = useState<string>('');
  const [scoreMin, setScoreMin] = useState<string>('');
  const [scoreMax, setScoreMax] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Actions state
  const [regenerating, setRegenerating] = useState<Set<string>>(new Set());
  const [resending, setResending] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchFeedbacks = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/lms/feedbacks?limit=200', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await res.json();
      if (result.success) {
        setFeedbacks(result.data.feedbacks || []);
        setTotal(result.data.total || 0);
      } else {
        setError(result.error?.message || '피드백 조회 실패');
      }
    } catch {
      setError('피드백 데이터를 불러오는 데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Unique weeks and students for filters
  const weekOptions = useMemo(() => {
    const map = new Map<number, string>();
    feedbacks.forEach(f => {
      const wn = f.assignments?.course_weeks?.week_number;
      const title = f.assignments?.course_weeks?.title;
      if (wn != null) map.set(wn, title || `${wn}주차`);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [feedbacks]);

  const studentOptions = useMemo(() => {
    const map = new Map<string, { name: string; email: string }>();
    feedbacks.forEach(f => {
      const p = f.assignments?.profiles;
      if (p) map.set(p.id, { name: p.full_name, email: p.email });
    });
    return Array.from(map.entries()).sort(([, a], [, b]) => a.name.localeCompare(b.name));
  }, [feedbacks]);

  // Filtered & sorted feedbacks
  const filteredFeedbacks = useMemo(() => {
    let list = [...feedbacks];

    // Week filter
    if (weekFilter !== 'all') {
      const wn = parseInt(weekFilter);
      list = list.filter(f => f.assignments?.course_weeks?.week_number === wn);
    }

    // Student filter
    if (studentFilter) {
      list = list.filter(f => f.assignments?.profiles?.id === studentFilter);
    }

    // Score range
    if (scoreMin) {
      const min = parseInt(scoreMin);
      list = list.filter(f => (f.scores?.total ?? 0) >= min);
    }
    if (scoreMax) {
      const max = parseInt(scoreMax);
      list = list.filter(f => (f.scores?.total ?? 100) <= max);
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'created_at':
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'score':
          cmp = (a.scores?.total ?? -1) - (b.scores?.total ?? -1);
          break;
        case 'student':
          cmp = (a.assignments?.profiles?.full_name || '').localeCompare(b.assignments?.profiles?.full_name || '');
          break;
        case 'week':
          cmp = (a.assignments?.course_weeks?.week_number ?? 0) - (b.assignments?.course_weeks?.week_number ?? 0);
          break;
        case 'tokens':
          cmp = ((a.tokens_input || 0) + (a.tokens_output || 0)) - ((b.tokens_input || 0) + (b.tokens_output || 0));
          break;
        case 'time':
          cmp = (a.generation_time_ms || 0) - (b.generation_time_ms || 0);
          break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });

    return list;
  }, [feedbacks, weekFilter, studentFilter, scoreMin, scoreMax, sortField, sortDir]);

  // Stats
  const stats = useMemo(() => {
    const scores = filteredFeedbacks.map(f => f.scores?.total).filter((s): s is number => s != null);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
      : null;
    const totalTokens = filteredFeedbacks.reduce((sum, f) => sum + (f.tokens_input || 0) + (f.tokens_output || 0), 0);
    const totalTimeMs = filteredFeedbacks.reduce((sum, f) => sum + (f.generation_time_ms || 0), 0);
    const avgTime = filteredFeedbacks.length > 0
      ? Math.round(totalTimeMs / filteredFeedbacks.length / 1000)
      : 0;

    // Score distribution
    const dist = { high: 0, mid: 0, low: 0 };
    scores.forEach(s => {
      if (s >= 70) dist.high++;
      else if (s >= 40) dist.mid++;
      else dist.low++;
    });

    // Unique students
    const uniqueStudents = new Set(filteredFeedbacks.map(f => f.assignments?.profiles?.id)).size;

    return { avgScore, totalTokens, avgTime, dist, uniqueStudents, totalScored: scores.length };
  }, [filteredFeedbacks]);

  // Actions
  const handleRegenerate = async (assignmentId: string) => {
    if (!accessToken) return;
    setRegenerating(prev => new Set(prev).add(assignmentId));
    setActionMessage(null);
    try {
      const res = await fetch('/api/lms/feedbacks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ assignmentId }),
      });
      const result = await res.json();
      if (result.success) {
        setActionMessage({ type: 'success', text: '피드백 재생성 작업이 큐에 추가되었습니다.' });
      } else {
        setActionMessage({ type: 'error', text: result.error?.message || '재생성 실패' });
      }
    } catch {
      setActionMessage({ type: 'error', text: '재생성 요청 중 오류 발생' });
    } finally {
      setRegenerating(prev => {
        const next = new Set(prev);
        next.delete(assignmentId);
        return next;
      });
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleDownloadPdf = async (feedbackId: string) => {
    if (!accessToken) return;
    setDownloading(prev => new Set(prev).add(feedbackId));
    try {
      const res = await fetch(`/api/lms/feedbacks/${feedbackId}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('PDF 생성 실패');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback_${feedbackId.substring(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setActionMessage({ type: 'success', text: 'PDF 다운로드 완료' });
    } catch {
      setActionMessage({ type: 'error', text: 'PDF 다운로드 실패' });
    } finally {
      setDownloading(prev => {
        const next = new Set(prev);
        next.delete(feedbackId);
        return next;
      });
      setTimeout(() => setActionMessage(null), 3000);
    }
  };

  const handleResendEmail = async (feedbackId: string) => {
    if (!accessToken) return;
    setResending(prev => new Set(prev).add(feedbackId));
    setActionMessage(null);
    try {
      const res = await fetch('/api/lms/admin/resend-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ feedbackId }),
      });
      const result = await res.json();
      if (result.success) {
        setActionMessage({ type: 'success', text: '이메일이 재발송되었습니다.' });
      } else {
        setActionMessage({ type: 'error', text: result.error?.message || '이메일 발송 실패' });
      }
    } catch {
      setActionMessage({ type: 'error', text: '이메일 발송 요청 중 오류 발생' });
    } finally {
      setResending(prev => {
        const next = new Set(prev);
        next.delete(feedbackId);
        return next;
      });
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-600 ml-1">&#8693;</span>;
    return <span className="text-purple-400 ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const formatTokens = (n: number) => {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  const formatTime = (ms: number) => {
    if (ms >= 60000) return `${(ms / 60000).toFixed(1)}분`;
    return `${(ms / 1000).toFixed(0)}초`;
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-600/20 text-green-400';
    if (score >= 40) return 'bg-yellow-600/20 text-yellow-400';
    return 'bg-red-600/20 text-red-400';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchFeedbacks} className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg">
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
          <h1 className="text-2xl font-bold text-white">피드백 관리</h1>
          <p className="text-slate-400 mt-1">전체 {total}개 피드백 | 표시: {filteredFeedbacks.length}개</p>
        </div>
        <button
          onClick={fetchFeedbacks}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          새로고침
        </button>
      </div>

      {/* Action Message Toast */}
      {actionMessage && (
        <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl border shadow-lg text-sm ${
          actionMessage.type === 'success'
            ? 'bg-green-900/90 border-green-500/50 text-green-300'
            : 'bg-red-900/90 border-red-500/50 text-red-300'
        }`}>
          {actionMessage.text}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">평균 점수</span>
          <p className="text-2xl font-bold text-white mt-1">
            {stats.avgScore != null ? `${stats.avgScore}` : '-'}
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">수강생 수</span>
          <p className="text-2xl font-bold text-white mt-1">{stats.uniqueStudents}명</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">총 토큰</span>
          <p className="text-2xl font-bold text-white mt-1">{formatTokens(stats.totalTokens)}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">평균 생성시간</span>
          <p className="text-2xl font-bold text-white mt-1">{stats.avgTime > 0 ? `${stats.avgTime}초` : '-'}</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase">점수 분포</span>
          <div className="flex items-center gap-1 mt-2">
            <div className="flex-1 h-3 bg-green-600/40 rounded-l" style={{ flex: stats.dist.high || 0.1 }} title={`70+ : ${stats.dist.high}`} />
            <div className="flex-1 h-3 bg-yellow-600/40" style={{ flex: stats.dist.mid || 0.1 }} title={`40-69: ${stats.dist.mid}`} />
            <div className="flex-1 h-3 bg-red-600/40 rounded-r" style={{ flex: stats.dist.low || 0.1 }} title={`0-39: ${stats.dist.low}`} />
          </div>
          <div className="flex justify-between text-[10px] text-slate-500 mt-1">
            <span>{stats.dist.high}</span>
            <span>{stats.dist.mid}</span>
            <span>{stats.dist.low}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <div className="flex flex-wrap items-center gap-3">
          {/* Week filter */}
          <select
            value={weekFilter}
            onChange={e => setWeekFilter(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="all">전체 주차</option>
            {weekOptions.map(([num, title]) => (
              <option key={num} value={num}>{num}주차: {title}</option>
            ))}
          </select>

          {/* Student filter */}
          <select
            value={studentFilter}
            onChange={e => setStudentFilter(e.target.value)}
            className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            <option value="">전체 수강생</option>
            {studentOptions.map(([id, info]) => (
              <option key={id} value={id}>{info.name} ({info.email})</option>
            ))}
          </select>

          {/* Score range */}
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="최소"
              value={scoreMin}
              onChange={e => setScoreMin(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white w-16 focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-slate-500 text-sm">~</span>
            <input
              type="number"
              placeholder="최대"
              value={scoreMax}
              onChange={e => setScoreMax(e.target.value)}
              className="bg-slate-900 border border-slate-600 rounded-lg px-2 py-2 text-sm text-white w-16 focus:ring-2 focus:ring-purple-500"
            />
            <span className="text-slate-500 text-xs">점</span>
          </div>

          {/* Reset */}
          {(weekFilter !== 'all' || studentFilter || scoreMin || scoreMax) && (
            <button
              onClick={() => { setWeekFilter('all'); setStudentFilter(''); setScoreMin(''); setScoreMax(''); }}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700 hover:bg-slate-600"
            >
              필터 초기화
            </button>
          )}
        </div>
      </div>

      {/* Feedback Table */}
      {filteredFeedbacks.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
          <p className="text-slate-400">조건에 맞는 피드백이 없습니다.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[1fr_1fr_80px_100px_80px_140px] gap-2 px-4 py-3 bg-slate-900/50 border-b border-slate-700 text-xs text-slate-400 uppercase tracking-wide">
            <button onClick={() => handleSort('student')} className="text-left flex items-center hover:text-white">
              수강생 <SortIcon field="student" />
            </button>
            <button onClick={() => handleSort('week')} className="text-left flex items-center hover:text-white">
              주차 / 과제 <SortIcon field="week" />
            </button>
            <button onClick={() => handleSort('score')} className="text-left flex items-center hover:text-white">
              점수 <SortIcon field="score" />
            </button>
            <button onClick={() => handleSort('tokens')} className="text-left flex items-center hover:text-white">
              토큰 <SortIcon field="tokens" />
            </button>
            <button onClick={() => handleSort('time')} className="text-left flex items-center hover:text-white">
              시간 <SortIcon field="time" />
            </button>
            <button onClick={() => handleSort('created_at')} className="text-left flex items-center hover:text-white">
              생성일 <SortIcon field="created_at" />
            </button>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-700/30">
            {filteredFeedbacks.map(fb => {
              const profile = fb.assignments?.profiles;
              const week = fb.assignments?.course_weeks;
              const isExpanded = expandedId === fb.id;
              const totalTokens = (fb.tokens_input || 0) + (fb.tokens_output || 0);

              return (
                <div key={fb.id}>
                  {/* Row */}
                  <div
                    className="grid grid-cols-[1fr_1fr_80px_100px_80px_140px] gap-2 px-4 py-3 hover:bg-slate-700/20 cursor-pointer transition-colors items-center"
                    onClick={() => setExpandedId(isExpanded ? null : fb.id)}
                  >
                    {/* Student */}
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{profile?.full_name || '-'}</p>
                      <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                    </div>

                    {/* Week / Title */}
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">
                        <span className="text-purple-400 font-medium">W{week?.week_number}</span>{' '}
                        {week?.title}
                      </p>
                      <p className="text-xs text-slate-500">v{fb.version} / 과제 v{fb.assignments?.version}</p>
                    </div>

                    {/* Score */}
                    <div>
                      {fb.scores?.total != null ? (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${scoreColor(fb.scores.total)}`}>
                          {fb.scores.total}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-600">-</span>
                      )}
                    </div>

                    {/* Tokens */}
                    <div className="text-xs text-slate-400">
                      {totalTokens > 0 ? (
                        <span title={`IN: ${fb.tokens_input} / OUT: ${fb.tokens_output}`}>
                          {formatTokens(totalTokens)}
                        </span>
                      ) : '-'}
                    </div>

                    {/* Time */}
                    <div className="text-xs text-slate-400">
                      {fb.generation_time_ms ? formatTime(fb.generation_time_ms) : '-'}
                    </div>

                    {/* Date */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">
                        {new Date(fb.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <svg className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="px-4 pb-4 bg-slate-900/30">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Summary */}
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                          <h4 className="text-xs text-slate-500 uppercase mb-2">피드백 요약</h4>
                          <p className="text-sm text-slate-300 line-clamp-4">
                            {fb.summary || fb.content?.substring(0, 300) || '요약 없음'}
                          </p>
                        </div>

                        {/* Score Breakdown */}
                        {fb.scores && Object.keys(fb.scores).length > 1 && (
                          <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                            <h4 className="text-xs text-slate-500 uppercase mb-2">점수 상세</h4>
                            <div className="space-y-1">
                              {Object.entries(fb.scores)
                                .filter(([k]) => k !== 'total')
                                .map(([key, val]) => (
                                  <div key={key} className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400">{key}</span>
                                    <span className="text-white font-medium">{typeof val === 'number' ? val : '-'}</span>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {/* Generation Info */}
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                          <h4 className="text-xs text-slate-500 uppercase mb-2">생성 정보</h4>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-500">입력 토큰</span>
                              <p className="text-white">{fb.tokens_input?.toLocaleString() || '-'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">출력 토큰</span>
                              <p className="text-white">{fb.tokens_output?.toLocaleString() || '-'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">생성 시간</span>
                              <p className="text-white">{fb.generation_time_ms ? formatTime(fb.generation_time_ms) : '-'}</p>
                            </div>
                            <div>
                              <span className="text-slate-500">콘텐츠 길이</span>
                              <p className="text-white">{fb.content ? `${(fb.content.length / 1000).toFixed(1)}K자` : '-'}</p>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                          <h4 className="text-xs text-slate-500 uppercase mb-3">관리 액션</h4>
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/lms/feedbacks/${fb.id}`}
                              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-xs font-medium transition-colors"
                            >
                              상세 보기
                            </Link>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadPdf(fb.id); }}
                              disabled={downloading.has(fb.id)}
                              className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {downloading.has(fb.id) ? 'PDF 생성 중...' : 'PDF 다운로드'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleRegenerate(fb.assignment_id); }}
                              disabled={regenerating.has(fb.assignment_id)}
                              className="px-3 py-1.5 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {regenerating.has(fb.assignment_id) ? '재생성 중...' : '피드백 재생성'}
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleResendEmail(fb.id); }}
                              disabled={resending.has(fb.id)}
                              className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                            >
                              {resending.has(fb.id) ? '발송 중...' : '이메일 재발송'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
