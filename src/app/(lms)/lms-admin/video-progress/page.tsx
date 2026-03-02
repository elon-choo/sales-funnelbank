// src/app/(lms)/lms-admin/video-progress/page.tsx
// 관리자 VOD 시청 현황 페이지
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface ProgressRecord {
  id: string;
  userId: string;
  studentName: string;
  email: string;
  weekId: string;
  weekNumber: number;
  weekTitle: string;
  watchPercentage: number;
  watchedSeconds: number;
  totalSeconds: number;
  isCompleted: boolean;
  completedAt: string | null;
  lastActivity: string | null;
}

interface WeekInfo {
  id: string;
  week_number: number;
  title: string;
}

interface Summary {
  totalStudents: number;
  completedCount: number;
  avgPercentage: number;
  notStartedCount: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Course {
  id: string;
  title: string;
  status: string;
}

export default function VideoProgressPage() {
  const { accessToken } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('last_activity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  // 기수 목록 조회
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/lms/dashboard', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then(r => r.json())
      .then(result => {
        if (result.success && result.data?.courses) {
          setCourses(result.data.courses);
          if (result.data.courses.length > 0 && !selectedCourse) {
            setSelectedCourse(result.data.courses[0].id);
          }
        }
      })
      .catch(() => {});
  }, [accessToken]);

  const fetchData = useCallback(async () => {
    if (!accessToken || !selectedCourse) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        courseId: selectedCourse,
        page: page.toString(),
        sortBy,
        sortOrder,
      });
      if (selectedWeek) params.append('weekId', selectedWeek);
      if (search) params.append('search', search);

      const response = await fetch(`/api/lms/admin/video-progress?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (result.success) {
        setRecords(result.data.records);
        setSummary(result.data.summary);
        setPagination(result.data.pagination);
        if (result.data.weeks) setWeeks(result.data.weeks);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedCourse, selectedWeek, search, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 검색 디바운스
  const [searchInput, setSearchInput] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder(o => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const exportCSV = () => {
    if (!records.length) return;
    const header = '학생명,이메일,주차,시청률(%),시청시간(초),완료여부,최종활동';
    const rows = records.map(r =>
      `"${r.studentName}","${r.email}",${r.weekNumber}주차,${r.watchPercentage},${r.watchedSeconds},${r.isCompleted ? 'Y' : 'N'},"${r.lastActivity || ''}"`
    );
    const csv = '\uFEFF' + [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-progress-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const SortIcon = ({ col }: { col: string }) => {
    if (sortBy !== col) return <span className="text-slate-600 ml-1">&#8693;</span>;
    return <span className="text-amber-400 ml-1">{sortOrder === 'asc' ? '&#9650;' : '&#9660;'}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">VOD 시청 현황</h1>
          <p className="text-slate-400">수강생의 영상 시청 진도를 확인합니다</p>
        </div>
        <button
          onClick={exportCSV}
          disabled={!records.length}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          CSV 내보내기
        </button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl p-5 border border-amber-500/30 bg-amber-500/10">
            <p className="text-slate-400 text-sm mb-1">시청 수강생</p>
            <p className="text-3xl font-bold text-white">{summary.totalStudents - summary.notStartedCount}</p>
            <p className="text-sm text-slate-500">전체 {summary.totalStudents}명</p>
          </div>
          <div className="rounded-xl p-5 border border-blue-500/30 bg-blue-500/10">
            <p className="text-slate-400 text-sm mb-1">평균 시청률</p>
            <p className="text-3xl font-bold text-white">{summary.avgPercentage}%</p>
            <p className="text-sm text-slate-500">전체 영상 기준</p>
          </div>
          <div className="rounded-xl p-5 border border-green-500/30 bg-green-500/10">
            <p className="text-slate-400 text-sm mb-1">완료</p>
            <p className="text-3xl font-bold text-white">{summary.completedCount}</p>
            <p className="text-sm text-slate-500">90% 이상 시청</p>
          </div>
          <div className="rounded-xl p-5 border border-red-500/30 bg-red-500/10">
            <p className="text-slate-400 text-sm mb-1">미시청</p>
            <p className="text-3xl font-bold text-white">{summary.notStartedCount}</p>
            <p className="text-sm text-slate-500">아직 시작 안 함</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={selectedCourse}
          onChange={e => { setSelectedCourse(e.target.value); setSelectedWeek(''); setPage(1); }}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select
          value={selectedWeek}
          onChange={e => { setSelectedWeek(e.target.value); setPage(1); }}
          className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="">전체 주차</option>
          {weeks.map(w => (
            <option key={w.id} value={w.id}>{w.week_number}주차 - {w.title}</option>
          ))}
        </select>
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="이름 또는 이메일 검색..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
          </div>
        ) : records.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p>시청 데이터가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th
                    className="text-left text-slate-400 font-medium py-3 px-4 cursor-pointer hover:text-white select-none"
                    onClick={() => handleSort('student')}
                  >
                    학생명 <SortIcon col="student" />
                  </th>
                  <th className="text-left text-slate-400 font-medium py-3 px-4">이메일</th>
                  <th
                    className="text-center text-slate-400 font-medium py-3 px-4 cursor-pointer hover:text-white select-none"
                    onClick={() => handleSort('week')}
                  >
                    주차 <SortIcon col="week" />
                  </th>
                  <th
                    className="text-center text-slate-400 font-medium py-3 px-4 cursor-pointer hover:text-white select-none"
                    onClick={() => handleSort('watch_percentage')}
                  >
                    시청률 <SortIcon col="watch_percentage" />
                  </th>
                  <th className="text-center text-slate-400 font-medium py-3 px-4">시청시간</th>
                  <th className="text-center text-slate-400 font-medium py-3 px-4">완료</th>
                  <th
                    className="text-right text-slate-400 font-medium py-3 px-4 cursor-pointer hover:text-white select-none"
                    onClick={() => handleSort('last_activity')}
                  >
                    최종활동 <SortIcon col="last_activity" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="border-b border-slate-700/50 hover:bg-slate-800/80 transition-colors">
                    <td className="py-3 px-4 text-white font-medium">{r.studentName}</td>
                    <td className="py-3 px-4 text-slate-400">{r.email}</td>
                    <td className="py-3 px-4 text-center text-white">{r.weekNumber}주차</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              r.watchPercentage >= 90
                                ? 'bg-green-500'
                                : r.watchPercentage >= 50
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                            }`}
                            style={{ width: `${Math.min(r.watchPercentage, 100)}%` }}
                          />
                        </div>
                        <span className="text-white text-xs w-10 text-right">{r.watchPercentage}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center text-slate-300">
                      {formatDuration(r.watchedSeconds)} / {formatDuration(r.totalSeconds)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {r.isCompleted ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-600/20 text-green-400">
                          완료
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-600/30 text-slate-400">
                          진행중
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-400 text-xs">{formatDate(r.lastActivity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
            <p className="text-sm text-slate-400">
              총 {pagination.total}건 중 {(pagination.page - 1) * pagination.limit + 1}-
              {Math.min(pagination.page * pagination.limit, pagination.total)}건
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded text-sm transition-colors"
              >
                이전
              </button>
              <span className="text-sm text-slate-400">
                {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-white rounded text-sm transition-colors"
              >
                다음
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
