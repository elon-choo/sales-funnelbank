// src/app/(lms)/lms/admin/page.tsx
// LMS 관리자 대시보드 - 학생/과제/피드백 통합 관리
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface Stats {
  totalStudents: number;
  totalAssignments: number;
  submittedAssignments: number;
  totalFeedbacks: number;
  avgScore: number | null;
  totalTokens: number;
  pendingJobs: number;
  processingJobs: number;
  failedJobs: number;
}

interface WeekStat {
  weekId: string;
  weekNumber: number;
  title: string;
  isActive: boolean;
  deadline: string | null;
  totalSubmissions: number;
  feedbackCount: number;
  avgScore: number | null;
}

interface Student {
  id: string;
  user_id: string;
  status: string;
  enrolled_at: string;
  profiles: { id: string; email: string; full_name: string };
}

interface Assignment {
  id: string;
  user_id: string;
  week_id: string;
  version: number;
  status: string;
  submitted_at: string | null;
  created_at: string;
  profiles: { id: string; email: string; full_name: string };
  course_weeks: { id: string; week_number: number; title: string };
}

interface Feedback {
  id: string;
  assignment_id: string;
  user_id: string;
  scores: { total: number } | null;
  status: string;
  tokens_input: number;
  tokens_output: number;
  generation_time_ms: number;
  created_at: string;
  assignments: {
    id: string;
    user_id: string;
    profiles: { id: string; email: string; full_name: string };
    course_weeks: { id: string; week_number: number; title: string };
  };
}

interface FeedbackJob {
  id: string;
  assignment_id: string;
  status: string;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  assignments: {
    id: string;
    profiles: { id: string; email: string; full_name: string };
    course_weeks: { id: string; week_number: number; title: string };
  };
}

interface Course {
  id: string;
  title: string;
  status: string;
}

type Tab = 'overview' | 'students' | 'assignments' | 'feedbacks' | 'jobs';

export default function LmsAdminPage() {
  const { accessToken, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [weekStats, setWeekStats] = useState<WeekStat[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [jobs, setJobs] = useState<FeedbackJob[]>([]);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const fetchDashboard = async (courseId?: string) => {
    if (!accessToken) return;

    try {
      const params = courseId ? `?courseId=${courseId}` : '';
      const response = await fetch(`/api/lms/admin/dashboard${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('관리자 권한이 필요합니다');
          setLoading(false);
          return;
        }
        throw new Error('데이터를 불러오는데 실패했습니다');
      }

      const result = await response.json();
      if (result.success) {
        const d = result.data;
        setCourses(d.courses || []);
        setSelectedCourseId(d.selectedCourseId || '');
        setStats(d.stats);
        setWeekStats(d.weekStats || []);
        setStudents(d.students || []);
        setAssignments(d.assignments || []);
        setFeedbacks(d.feedbacks || []);
        setJobs(d.jobs || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [accessToken]);

  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    setLoading(true);
    fetchDashboard(courseId);
  };

  const handleRegenerate = async (assignmentId: string) => {
    if (!accessToken) return;
    setRegenerating(assignmentId);

    try {
      const response = await fetch('/api/lms/admin/regenerate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ assignmentId }),
      });

      const result = await response.json();
      if (result.success) {
        // Refresh dashboard
        fetchDashboard(selectedCourseId);
      } else {
        alert(result.error?.message || '재생성 실패');
      }
    } catch {
      alert('재생성 요청 중 오류가 발생했습니다');
    } finally {
      setRegenerating(null);
    }
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
        <Link
          href="/lms/dashboard"
          className="mt-4 inline-block px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          대시보드로 돌아가기
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview', label: '개요' },
    { id: 'students', label: '수강생', count: stats?.totalStudents },
    { id: 'assignments', label: '과제', count: stats?.totalAssignments },
    { id: 'feedbacks', label: '피드백', count: stats?.totalFeedbacks },
    { id: 'jobs', label: '작업 큐', count: (stats?.pendingJobs || 0) + (stats?.processingJobs || 0) },
  ];

  const statusColors: Record<string, string> = {
    draft: 'bg-slate-600/20 text-slate-400',
    submitted: 'bg-blue-600/20 text-blue-400',
    feedback_ready: 'bg-green-600/20 text-green-400',
    reviewed: 'bg-green-600/20 text-green-400',
    generated: 'bg-green-600/20 text-green-400',
    pending: 'bg-yellow-600/20 text-yellow-400',
    processing: 'bg-blue-600/20 text-blue-400',
    completed: 'bg-green-600/20 text-green-400',
    failed: 'bg-red-600/20 text-red-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">LMS 관리자</h1>
          <p className="text-slate-400 mt-1">학생, 과제, 피드백을 관리합니다</p>
        </div>
        {courses.length > 1 && (
          <select
            value={selectedCourseId}
            onChange={e => handleCourseChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white text-sm"
          >
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <StatCard label="수강생" value={stats.totalStudents} suffix="명" />
          <StatCard label="과제 제출" value={stats.submittedAssignments} suffix={`/ ${stats.totalAssignments}`} />
          <StatCard label="피드백 생성" value={stats.totalFeedbacks} suffix="건" />
          <StatCard label="평균 점수" value={stats.avgScore ?? '-'} suffix={stats.avgScore ? '점' : ''} />
          <StatCard
            label="대기 작업"
            value={stats.pendingJobs + stats.processingJobs}
            suffix="건"
            alert={stats.failedJobs > 0 ? `실패 ${stats.failedJobs}건` : undefined}
          />
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
            {tab.count != null && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-slate-800">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Weekly Stats */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">주차별 현황</h3>
            <div className="space-y-3">
              {weekStats.map(w => (
                <div key={w.weekId} className="flex items-center justify-between p-3 bg-slate-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                      w.isActive ? 'bg-purple-600/30 text-purple-400' : 'bg-slate-700 text-slate-400'
                    }`}>
                      {w.weekNumber}
                    </span>
                    <div>
                      <p className="text-white text-sm font-medium">{w.title}</p>
                      {w.deadline && (
                        <p className="text-xs text-slate-500">마감: {new Date(w.deadline).toLocaleDateString('ko-KR')}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-white font-medium">{w.totalSubmissions}</p>
                      <p className="text-xs text-slate-500">제출</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-medium">{w.feedbackCount}</p>
                      <p className="text-xs text-slate-500">피드백</p>
                    </div>
                    <div className="text-center">
                      <p className={`font-medium ${
                        w.avgScore != null
                          ? w.avgScore >= 80 ? 'text-green-400' : w.avgScore >= 60 ? 'text-yellow-400' : 'text-red-400'
                          : 'text-slate-500'
                      }`}>
                        {w.avgScore != null ? w.avgScore : '-'}
                      </p>
                      <p className="text-xs text-slate-500">평균</p>
                    </div>
                  </div>
                </div>
              ))}
              {weekStats.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-4">주차 데이터가 없습니다</p>
              )}
            </div>
          </div>

          {/* Token Usage */}
          {stats && stats.totalTokens > 0 && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-2">AI 사용량</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">총 토큰 사용</p>
                  <p className="text-xl font-bold text-white">{(stats.totalTokens / 1000).toFixed(1)}K</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">예상 비용 (Claude Opus)</p>
                  <p className="text-xl font-bold text-white">
                    ${((stats.totalTokens / 1000000) * 15).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'students' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">이름</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">이메일</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-white">{s.profiles?.full_name || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">{s.profiles?.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded ${statusColors[s.status] || 'bg-slate-600/20 text-slate-400'}`}>
                      {s.status === 'active' ? '활성' : s.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(s.enrolled_at).toLocaleDateString('ko-KR')}
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">수강생이 없습니다</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">학생</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">주차</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">버전</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">제출일</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {assignments.map(a => (
                <tr key={a.id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-white">{a.profiles?.full_name || a.profiles?.email || '-'}</td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {a.course_weeks?.week_number}주차
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">v{a.version}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded ${statusColors[a.status] || 'bg-slate-600/20 text-slate-400'}`}>
                      {a.status === 'draft' ? '초안' :
                       a.status === 'submitted' ? '제출됨' :
                       a.status === 'feedback_ready' ? '피드백 완료' : a.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {a.submitted_at ? new Date(a.submitted_at).toLocaleDateString('ko-KR') : '-'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {(a.status === 'submitted' || a.status === 'feedback_ready') && (
                        <button
                          onClick={() => handleRegenerate(a.id)}
                          disabled={regenerating === a.id}
                          className="px-3 py-1 text-xs bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {regenerating === a.id ? '처리중...' : '피드백 재생성'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">과제가 없습니다</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'feedbacks' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">학생</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">주차</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">점수</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">토큰</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">생성 시간</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">일시</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">보기</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {feedbacks.map(f => {
                const score = f.scores?.total;
                const totalTokens = (f.tokens_input || 0) + (f.tokens_output || 0);
                return (
                  <tr key={f.id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 text-sm text-white">
                      {f.assignments?.profiles?.full_name || f.assignments?.profiles?.email || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {f.assignments?.course_weeks?.week_number}주차
                    </td>
                    <td className="px-6 py-4">
                      {score != null ? (
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          score >= 80 ? 'bg-green-600/20 text-green-400' :
                          score >= 60 ? 'bg-yellow-600/20 text-yellow-400' :
                          'bg-red-600/20 text-red-400'
                        }`}>
                          {score}점
                        </span>
                      ) : (
                        <span className="text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {totalTokens > 0 ? `${(totalTokens / 1000).toFixed(1)}K` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {f.generation_time_ms ? `${(f.generation_time_ms / 1000).toFixed(1)}s` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-400">
                      {new Date(f.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/lms/feedbacks/${f.id}`}
                        className="text-xs text-purple-400 hover:text-purple-300"
                      >
                        보기
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {feedbacks.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-slate-500">피드백이 없습니다</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'jobs' && (
        <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">학생</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">주차</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">상태</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">에러</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase">생성일</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {jobs.map(j => (
                <tr key={j.id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 text-sm text-white">
                    {j.assignments?.profiles?.full_name || j.assignments?.profiles?.email || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {j.assignments?.course_weeks?.week_number}주차
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs rounded ${statusColors[j.status] || 'bg-slate-600/20 text-slate-400'}`}>
                      {j.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-red-400 max-w-[200px] truncate">
                    {j.error_message || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(j.created_at).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {j.status === 'failed' && (
                      <button
                        onClick={() => handleRegenerate(j.assignment_id)}
                        disabled={regenerating === j.assignment_id}
                        className="px-3 py-1 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {regenerating === j.assignment_id ? '처리중...' : '재시도'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-slate-500">작업 기록이 없습니다</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  suffix,
  alert,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  alert?: string;
}) {
  return (
    <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
      <span className="text-xs text-slate-500 uppercase tracking-wide">{label}</span>
      <p className="text-2xl font-bold text-white mt-1">
        {value}
        {suffix && <span className="text-sm font-normal text-slate-400 ml-1">{suffix}</span>}
      </p>
      {alert && (
        <span className="text-xs text-red-400 mt-1">{alert}</span>
      )}
    </div>
  );
}
