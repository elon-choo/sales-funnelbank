'use client';

import { useEffect, useState } from 'react';
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
  courses: {
    id: string;
    title: string;
  };
  assignment?: {
    id: string;
    status: 'draft' | 'submitted' | 'reviewed';
    submitted_at: string | null;
    feedbacks?: Array<{
      id: string;
      score: number | null;
    }>;
  };
  videoProgress?: {
    watchPercentage: number;
    isCompleted: boolean;
    lessonCount?: number;
    lessonCompleted?: number;
  };
}

const statusConfig: Record<string, { text: string; color: string; bgColor: string }> = {
  not_started: { text: '미시작', color: 'text-slate-400', bgColor: 'bg-slate-600/20' },
  draft: { text: '작성 중', color: 'text-yellow-400', bgColor: 'bg-yellow-600/20' },
  submitted: { text: '제출 완료', color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  reviewed: { text: '피드백 완료', color: 'text-green-400', bgColor: 'bg-green-600/20' },
};

export default function WeeksProgressPage() {
  const { accessToken } = useAuthStore();
  const [weeks, setWeeks] = useState<WeekProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken) return;

      try {
        // Fetch weeks
        const weeksResponse = await fetch('/api/lms/weeks', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        if (!weeksResponse.ok) {
          throw new Error('주차 정보를 불러오는데 실패했습니다');
        }

        const weeksResult = await weeksResponse.json();
        const weeksData = weeksResult.data?.weeks || [];

        // Fetch assignments to get progress
        const assignmentsResponse = await fetch('/api/lms/assignments', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        });

        let assignments: Record<string, WeekProgress['assignment']> = {};
        if (assignmentsResponse.ok) {
          const assignmentsResult = await assignmentsResponse.json();
          const assignmentsList = assignmentsResult.data?.assignments || [];

          // Index by week_id
          assignmentsList.forEach((a: { week_id: string; id: string; status: string; submitted_at: string | null }) => {
            assignments[a.week_id] = {
              id: a.id,
              status: a.status as 'draft' | 'submitted' | 'reviewed',
              submitted_at: a.submitted_at,
            };
          });
        }

        // Fetch video progress for all weeks (including lesson-based)
        let videoProgressMap: Record<string, { watchPercentage: number; isCompleted: boolean; lessonCount?: number; lessonCompleted?: number }> = {};
        if (weeksData.length > 0) {
          const courseId = weeksData[0].course_id;
          const vpRes = await fetch(`/api/lms/video-progress/course?courseId=${courseId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` },
          });
          if (vpRes.ok) {
            const vpResult = await vpRes.json();
            const byWeek = vpResult.data?.progressByWeek || {};
            Object.keys(byWeek).forEach((wid) => {
              videoProgressMap[wid] = {
                watchPercentage: byWeek[wid].watchPercentage || 0,
                isCompleted: byWeek[wid].isCompleted || false,
                lessonCount: byWeek[wid].lessonCount || 0,
                lessonCompleted: byWeek[wid].lessonCompleted || 0,
              };
            });
          }
        }

        // Merge weeks with assignments and video progress
        const mergedWeeks = weeksData.map((week: WeekProgress) => ({
          ...week,
          assignment: assignments[week.id] || null,
          videoProgress: videoProgressMap[week.id] || null,
        }));

        setWeeks(mergedWeeks);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken]);

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
      </div>
    );
  }

  const completedCount = weeks.filter(w => w.assignment?.status === 'reviewed').length;
  const submittedCount = weeks.filter(w => w.assignment?.status === 'submitted').length;
  const progressPercent = weeks.length > 0 ? Math.round((completedCount / weeks.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">주차별 진도</h1>
        <p className="text-slate-400 mt-1">각 주차별 과제 진행 상황을 확인하세요</p>
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
              <span className="text-green-400 font-medium">{completedCount}</span> 완료 ·{' '}
              <span className="text-blue-400 font-medium">{submittedCount}</span> 제출 ·{' '}
              <span className="text-slate-400 font-medium">{weeks.length - completedCount - submittedCount}</span> 진행 전
            </p>
            <p className="text-slate-400 text-sm mt-1">전체 {weeks.length}주차</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Week List */}
      <div className="space-y-3">
        {weeks.map((week, index) => {
          const status = week.assignment?.status || 'not_started';
          const config = statusConfig[status];
          const isLocked = !week.is_active;
          const isPastDeadline = week.deadline && new Date(week.deadline) < new Date();

          return (
            <div
              key={week.id}
              className={`bg-slate-800/50 rounded-2xl p-5 border transition-all ${
                isLocked
                  ? 'border-slate-700/50 opacity-60'
                  : status === 'reviewed'
                  ? 'border-green-500/30 hover:border-green-500/50'
                  : 'border-slate-700 hover:border-purple-500/50'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Week Number Badge */}
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  status === 'reviewed'
                    ? 'bg-green-600/20'
                    : status === 'submitted'
                    ? 'bg-blue-600/20'
                    : status === 'draft'
                    ? 'bg-yellow-600/20'
                    : 'bg-slate-700/50'
                }`}>
                  {status === 'reviewed' ? (
                    <svg className="w-7 h-7 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isLocked ? (
                    <svg className="w-7 h-7 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  ) : (
                    <span className={`text-xl font-bold ${
                      status === 'submitted' ? 'text-blue-400' :
                      status === 'draft' ? 'text-yellow-400' :
                      'text-slate-400'
                    }`}>
                      {week.week_number}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-white">
                      {week.week_number}주차: {week.title}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config.bgColor} ${config.color}`}>
                      {config.text}
                    </span>
                    {isPastDeadline && status !== 'reviewed' && status !== 'submitted' && (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-600/20 text-red-400">
                        마감 지남
                      </span>
                    )}
                  </div>

                  {week.description && (
                    <p className="text-sm text-slate-400 line-clamp-1">{week.description}</p>
                  )}

                  {/* Video Progress Bar - Lesson-based or legacy */}
                  {(week.videoProgress || (week.video_url && week.video_visible)) && (
                    <div className="flex items-center gap-2 mt-2">
                      <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {week.videoProgress?.lessonCount && week.videoProgress.lessonCount > 0 ? (
                        <>
                          <span className="text-xs text-slate-400">
                            {week.videoProgress.lessonCount}개 레슨
                          </span>
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                week.videoProgress?.isCompleted ? 'bg-green-500' : 'bg-purple-500'
                              }`}
                              style={{ width: `${week.videoProgress?.watchPercentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {week.videoProgress?.isCompleted
                              ? '시청완료'
                              : `${week.videoProgress?.lessonCompleted || 0}/${week.videoProgress?.lessonCount} 완료`
                            }
                          </span>
                        </>
                      ) : (
                        <>
                          <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden max-w-[120px]">
                            <div
                              className={`h-full rounded-full transition-all ${
                                week.videoProgress?.isCompleted ? 'bg-green-500' : 'bg-purple-500'
                              }`}
                              style={{ width: `${week.videoProgress?.watchPercentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-500">
                            {week.videoProgress?.isCompleted ? '시청완료' : `${week.videoProgress?.watchPercentage || 0}%`}
                          </span>
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                    <span>유형: {week.assignment_type}</span>
                    {week.deadline && (
                      <span>마감: {new Date(week.deadline).toLocaleDateString('ko-KR')}</span>
                    )}
                    {week.assignment?.submitted_at && (
                      <span>제출: {new Date(week.assignment.submitted_at).toLocaleDateString('ko-KR')}</span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {!isLocked && (
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <Link
                      href={`/lms/weeks/${week.id}`}
                      className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 text-center"
                    >
                      강의 보기
                    </Link>
                    {week.assignment && (
                      <Link
                        href={`/lms/assignments/${week.assignment.id}`}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-center ${
                          status === 'reviewed'
                            ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                            : status === 'submitted'
                            ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                            : 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30'
                        }`}
                      >
                        {status === 'reviewed' ? '피드백 보기' :
                         status === 'submitted' ? '진행 상황' :
                         '이어서 작성'}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {weeks.length === 0 && (
          <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
            <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <h3 className="text-lg font-semibold text-white mb-2">수강 중인 과정이 없습니다</h3>
            <p className="text-slate-400">등록된 과정의 주차별 진도가 여기에 표시됩니다.</p>
          </div>
        )}
      </div>
    </div>
  );
}
