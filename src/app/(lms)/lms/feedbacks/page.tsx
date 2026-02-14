// src/app/(lms)/lms/feedbacks/page.tsx
// 학생 피드백 목록 페이지 - 주차별 그룹핑 + 전체 피드백 히스토리
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface Feedback {
  id: string;
  assignment_id: string;
  version: number;
  content: string;
  summary: string;
  scores: { total: number } | null;
  status: string;
  created_at: string;
  assignments: {
    id: string;
    user_id: string;
    course_id: string;
    week_id: string;
    version: number;
    status: string;
    courses: {
      id: string;
      title: string;
    };
    course_weeks: {
      id: string;
      week_number: number;
      title: string;
    };
  };
}

interface SubAssignmentGroup {
  weekId: string;
  title: string;
  feedbacks: Feedback[]; // all feedbacks, newest first
  latestScore: number | null;
}

interface WeekFeedbackGroup {
  weekNumber: number;
  courseName: string;
  subGroups: SubAssignmentGroup[];
  latestScore: number | null;
  totalFeedbacks: number;
  latestDate: string;
}

export default function FeedbacksPage() {
  const { accessToken } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      if (!accessToken) return;

      try {
        const response = await fetch('/api/lms/feedbacks?limit=200', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('피드백 목록을 불러오는데 실패했습니다');
        }

        const result = await response.json();
        if (result.success) {
          setFeedbacks(result.data.feedbacks || []);
        } else {
          throw new Error(result.error?.message || '알 수 없는 오류');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchFeedbacks();
  }, [accessToken]);

  // Group ALL feedbacks by week_number → sub-assignment (week_id) → all versions
  const weekGroups = useMemo<WeekFeedbackGroup[]>(() => {
    // Group by week_number
    const weekMap = new Map<number, Map<string, { title: string; feedbacks: Feedback[] }>>();

    for (const fb of feedbacks) {
      const weekNum = fb.assignments?.course_weeks?.week_number;
      const weekId = fb.assignments?.course_weeks?.id;
      const title = fb.assignments?.course_weeks?.title || '과제';
      if (weekNum == null || !weekId) continue;

      if (!weekMap.has(weekNum)) weekMap.set(weekNum, new Map());
      const subMap = weekMap.get(weekNum)!;
      if (!subMap.has(weekId)) subMap.set(weekId, { title, feedbacks: [] });
      subMap.get(weekId)!.feedbacks.push(fb);
    }

    return Array.from(weekMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNumber, subMap]) => {
        const subGroups: SubAssignmentGroup[] = Array.from(subMap.entries())
          .map(([weekId, { title, feedbacks: fbs }]) => {
            // Sort newest first
            const sorted = fbs.sort((a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            const latestScore = sorted[0]?.scores?.total ?? null;
            return { weekId, title, feedbacks: sorted, latestScore };
          })
          .sort((a, b) => a.title.localeCompare(b.title));

        const totalFeedbacks = subGroups.reduce((sum, sg) => sum + sg.feedbacks.length, 0);
        const allLatestScores = subGroups
          .map(sg => sg.latestScore)
          .filter((s): s is number => s !== null);
        const latestScore = allLatestScores.length > 0
          ? Math.round(allLatestScores.reduce((a, b) => a + b, 0) / allLatestScores.length * 10) / 10
          : null;

        const allDates = subGroups.flatMap(sg => sg.feedbacks.map(f => f.created_at));
        const latestDate = allDates.sort().reverse()[0] || '';

        return {
          weekNumber,
          courseName: subGroups[0]?.feedbacks[0]?.assignments?.courses?.title || '',
          subGroups,
          latestScore,
          totalFeedbacks,
          latestDate,
        };
      });
  }, [feedbacks]);

  // Auto-expand first week if only one, or expand all
  useEffect(() => {
    if (weekGroups.length === 1) {
      setExpandedWeek(weekGroups[0].weekNumber);
    }
  }, [weekGroups]);

  // Overall stats
  const allScores = feedbacks
    .map(f => f.scores?.total)
    .filter((s): s is number => s != null);
  const overallAverage = allScores.length > 0
    ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10
    : null;

  const scoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-600/20 text-green-400';
    if (score >= 40) return 'bg-yellow-600/20 text-yellow-400';
    return 'bg-red-600/20 text-red-400';
  };

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">내 피드백</h1>
        <p className="text-slate-400 mt-1">받은 AI 피드백을 주차별로 모아보세요</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase tracking-wide">총 피드백</span>
          <p className="text-2xl font-bold text-white mt-1">{feedbacks.length}개</p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase tracking-wide">평균 점수</span>
          <p className="text-2xl font-bold text-white mt-1">
            {overallAverage !== null ? `${overallAverage}점` : '-'}
          </p>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <span className="text-xs text-slate-500 uppercase tracking-wide">최근 피드백</span>
          <p className="text-2xl font-bold text-white mt-1">
            {feedbacks.length > 0
              ? new Date(feedbacks[0].created_at).toLocaleDateString('ko-KR')
              : '-'}
          </p>
        </div>
      </div>

      {/* Feedback List - Grouped by Week */}
      {weekGroups.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">피드백이 없습니다</h3>
          <p className="text-slate-400">
            과제를 제출하면 AI가 분석하여 피드백을 생성합니다.
          </p>
          <Link
            href="/lms/assignments"
            className="inline-block mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            과제 목록 보기
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {weekGroups.map((group) => {
            const isExpanded = expandedWeek === group.weekNumber;

            return (
              <div
                key={group.weekNumber}
                className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden"
              >
                {/* Week Header - clickable */}
                <button
                  onClick={() => setExpandedWeek(isExpanded ? null : group.weekNumber)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-700/20 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-lg font-bold text-purple-400">
                        {group.weekNumber}
                      </span>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-white">{group.weekNumber}주차 피드백</h3>
                      <p className="text-sm text-slate-400">
                        {group.courseName} · {group.totalFeedbacks}개 피드백
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {group.latestScore != null && (
                      <span className={`px-4 py-2 rounded-xl text-lg font-bold ${scoreColor(group.latestScore)}`}>
                        {group.latestScore}점
                      </span>
                    )}
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-slate-700/50">
                    {group.subGroups.map((sub) => (
                      <div key={sub.weekId}>
                        {/* Sub-assignment header (only if multiple sub-assignments) */}
                        {group.subGroups.length > 1 && (
                          <div className="px-6 py-2 bg-slate-900/30 border-b border-slate-700/30">
                            <span className="text-xs font-medium text-purple-400 uppercase tracking-wider">
                              {sub.title}
                            </span>
                          </div>
                        )}

                        {/* Feedback list for this sub-assignment */}
                        <div className="divide-y divide-slate-700/20">
                          {sub.feedbacks.map((feedback, idx) => {
                            const isLatest = idx === 0;
                            return (
                              <Link
                                key={feedback.id}
                                href={`/lms/feedbacks/${feedback.id}`}
                                className={`block px-6 py-4 hover:bg-slate-700/20 transition-colors ${
                                  !isLatest ? 'opacity-60 hover:opacity-100' : ''
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                      isLatest ? 'bg-purple-500' : 'bg-slate-600'
                                    }`} />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <h4 className="text-sm font-medium text-white truncate">
                                          {group.subGroups.length === 1 ? sub.title : `v${feedback.version}`}
                                        </h4>
                                        {isLatest && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-300 font-medium">
                                            최신
                                          </span>
                                        )}
                                        {!isLatest && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400">
                                            v{feedback.version}
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        {new Date(feedback.created_at).toLocaleString('ko-KR', {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}
                                        {' · '}과제 v{feedback.assignments?.version}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    {feedback.scores?.total != null && (
                                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${scoreColor(feedback.scores.total)}`}>
                                        {feedback.scores.total}점
                                      </span>
                                    )}
                                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </div>

                                {/* Preview - only for latest */}
                                {isLatest && (feedback.summary || feedback.content) && (
                                  <div className="mt-2 ml-5">
                                    <p className="text-xs text-slate-400 line-clamp-2">
                                      {feedback.summary || feedback.content?.substring(0, 200)}
                                    </p>
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
