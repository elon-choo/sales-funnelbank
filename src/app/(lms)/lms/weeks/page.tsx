'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface WeekProgress {
  id: string;
  week_number: number;
  title: string;
  description: string | null;
  assignment_type: string;
  deadline: string | null;
  is_active: boolean;
  course_id: string;
  video_url?: string | null;
  video_visible?: boolean;
  courses: { id: string; title: string };
  assignment?: {
    id: string;
    status: 'draft' | 'submitted' | 'reviewed' | 'feedback_ready' | 'processing';
    submitted_at: string | null;
  };
  videoProgress?: {
    watchPercentage: number;
    isCompleted: boolean;
  };
}

interface WeekGroup {
  weekNumber: number;
  subWeeks: WeekProgress[];
  hasVideo: boolean;
  overallStatus: string;
}

const statusConfig: Record<string, { text: string; color: string; bgColor: string }> = {
  not_started: { text: '미시작', color: 'text-slate-400', bgColor: 'bg-slate-600/20' },
  draft: { text: '작성 중', color: 'text-yellow-400', bgColor: 'bg-yellow-600/20' },
  submitted: { text: '제출 완료', color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  processing: { text: 'AI 분석 중', color: 'text-purple-400', bgColor: 'bg-purple-600/20' },
  reviewed: { text: '피드백 완료', color: 'text-green-400', bgColor: 'bg-green-600/20' },
  feedback_ready: { text: '피드백 완료', color: 'text-green-400', bgColor: 'bg-green-600/20' },
};

export default function WeeksProgressPage() {
  const { accessToken } = useAuthStore();
  const [weeks, setWeeks] = useState<WeekProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken) { setLoading(false); return; }

      try {
        // Get courseId
        let courseId: string | null = null;
        const dashRes = await fetch('/api/lms/dashboard', { headers: { 'Authorization': `Bearer ${accessToken}` } });
        if (!dashRes.ok) { setLoading(false); setError('인증 정보를 확인할 수 없습니다.'); return; }
        const dashData = await dashRes.json();

        if (dashData.data?.enrollments?.[0]?.course_id) {
          courseId = dashData.data.enrollments[0].course_id;
        } else if (dashData.data?.type === 'admin' || dashData.data?.courses) {
          if (dashData.data?.courses?.[0]?.id) courseId = dashData.data.courses[0].id;
          else {
            const cRes = await fetch('/api/lms/courses', { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (cRes.ok) { const cData = await cRes.json(); courseId = cData.data?.courses?.[0]?.id || null; }
          }
        }
        if (!courseId) { setLoading(false); setError('등록된 기수가 없습니다'); return; }

        // Fetch weeks + assignments
        const [weeksRes, assignRes] = await Promise.all([
          fetch(`/api/lms/weeks?courseId=${courseId}`, { headers: { 'Authorization': `Bearer ${accessToken}` } }),
          fetch('/api/lms/assignments', { headers: { 'Authorization': `Bearer ${accessToken}` } }),
        ]);

        const weeksData = weeksRes.ok ? (await weeksRes.json()).data?.weeks || [] : [];
        let assignments: Record<string, WeekProgress['assignment']> = {};
        if (assignRes.ok) {
          const aData = await assignRes.json();
          (aData.data?.assignments || []).forEach((a: { week_id: string; id: string; status: string; submitted_at: string | null }) => {
            const existing = assignments[a.week_id];
            const priority = (s: string) => s === 'feedback_ready' ? 4 : s === 'submitted' ? 3 : s === 'processing' ? 2 : s === 'draft' ? 1 : 0;
            if (!existing || priority(a.status) > priority(existing.status)) {
              assignments[a.week_id] = { id: a.id, status: a.status as WeekProgress['assignment'] extends undefined ? never : NonNullable<WeekProgress['assignment']>['status'], submitted_at: a.submitted_at };
            }
          });
        }

        setWeeks(weeksData.map((w: WeekProgress) => ({ ...w, assignment: assignments[w.id] || null })));
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Group by week_number
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const map = new Map<number, WeekProgress[]>();
    for (const w of weeks) {
      if (!map.has(w.week_number)) map.set(w.week_number, []);
      map.get(w.week_number)!.push(w);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, subWeeks]) => {
        const hasVideo = subWeeks.some(sw => sw.video_url && sw.video_visible);
        const statuses = subWeeks.map(sw => sw.assignment?.status || 'not_started');
        const overallStatus = statuses.every(s => s === 'feedback_ready' || s === 'reviewed') ? 'feedback_ready'
          : statuses.some(s => s === 'submitted' || s === 'processing') ? 'submitted'
          : statuses.some(s => s === 'draft') ? 'draft'
          : 'not_started';
        return { weekNumber, subWeeks, hasVideo, overallStatus };
      });
  }, [weeks]);

  // Stats based on week groups (not individual course_weeks)
  const totalWeekGroups = weekGroups.length;
  const completedGroups = weekGroups.filter(g => g.overallStatus === 'feedback_ready').length;
  const submittedGroups = weekGroups.filter(g => g.overallStatus === 'submitted').length;
  const progressPercent = totalWeekGroups > 0 ? Math.round((completedGroups / totalWeekGroups) * 100) : 0;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" /></div>;
  }
  if (error) {
    return <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center"><p className="text-red-400">{error}</p></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">주차별 진도</h1>
        <p className="text-slate-400 mt-1">각 주차별 학습 진행 상황을 확인하세요</p>
      </div>

      {/* Progress Overview */}
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-300">전체 진도율</p>
            <p className="text-3xl font-bold text-white mt-1">{progressPercent}%</p>
          </div>
          <div className="text-right">
            <p className="text-slate-300 text-sm">
              <span className="text-green-400 font-medium">{completedGroups}</span> 완료 ·{' '}
              <span className="text-blue-400 font-medium">{submittedGroups}</span> 제출 ·{' '}
              <span className="text-slate-400 font-medium">{totalWeekGroups - completedGroups - submittedGroups}</span> 진행 전
            </p>
            <p className="text-slate-400 text-sm mt-1">전체 {totalWeekGroups}주차</p>
          </div>
        </div>
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      {/* Week Groups */}
      <div className="space-y-4">
        {weekGroups.map((group) => {
          const config = statusConfig[group.overallStatus] || statusConfig['not_started'];
          // Prefer week with video for "강의 보기" link
          const weekWithVideo = group.subWeeks.find(sw => sw.video_url && sw.video_visible);
          const firstWeek = weekWithVideo || group.subWeeks[0];

          return (
            <div key={group.weekNumber} className={`bg-slate-800/50 rounded-2xl border transition-all ${
              group.overallStatus === 'feedback_ready' ? 'border-green-500/30' : 'border-slate-700 hover:border-purple-500/50'
            }`}>
              {/* Week Header */}
              <div className="p-5 flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  group.overallStatus === 'feedback_ready' ? 'bg-green-600/20' :
                  group.overallStatus === 'submitted' ? 'bg-blue-600/20' :
                  group.overallStatus === 'draft' ? 'bg-yellow-600/20' : 'bg-slate-700/50'
                }`}>
                  {group.overallStatus === 'feedback_ready' ? (
                    <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xl font-bold text-purple-400">{group.weekNumber}</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-white text-lg">{group.weekNumber}주차</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                      {config.text}
                    </span>
                  </div>

                  {/* Sub-assignments list */}
                  <div className="space-y-2">
                    {group.subWeeks.map((sw) => {
                      const swStatus = sw.assignment?.status || 'not_started';
                      const swConfig = statusConfig[swStatus] || statusConfig['not_started'];
                      return (
                        <div key={sw.id} className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            swStatus === 'feedback_ready' || swStatus === 'reviewed' ? 'bg-green-500' :
                            swStatus === 'submitted' ? 'bg-blue-500' :
                            swStatus === 'draft' ? 'bg-yellow-500' : 'bg-slate-600'
                          }`} />
                          <span className="text-sm text-slate-300">{sw.title}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${swConfig.bgColor} ${swConfig.color}`}>
                            {swConfig.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Link
                    href={`/lms/weeks/${firstWeek.id}`}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-center"
                  >
                    강의 보기
                  </Link>
                  <Link
                    href={`/lms/assignments/new?weekId=${firstWeek.id}`}
                    className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-pink-600/20 text-pink-400 hover:bg-pink-600/30 text-center"
                  >
                    과제 제출
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {weekGroups.length === 0 && (
          <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
            <h3 className="text-lg font-semibold text-white mb-2">수강 중인 과정이 없습니다</h3>
            <p className="text-slate-400">등록된 과정의 주차별 진도가 여기에 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
