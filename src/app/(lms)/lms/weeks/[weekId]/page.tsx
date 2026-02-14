'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';
import VideoPlayer from '@/components/lms/VideoPlayer';

interface WeekDetail {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  description: string | null;
  assignment_type: string;
  deadline: string | null;
  is_active: boolean;
  content_json: { markdown?: string } | null;
  video_url: string | null;
  video_title: string | null;
  video_duration: number | null;
  video_thumbnail: string | null;
  video_visible: boolean;
  materials: string[] | null;
}

interface Lesson {
  id: string;
  week_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  video_duration: number | null;
  video_thumbnail: string | null;
  video_visible: boolean;
  sort_order: number;
}

interface VideoProgress {
  last_position: number;
  watch_percentage: number;
  is_completed: boolean;
}

interface LessonProgress {
  lessonId: string;
  watchPercentage: number;
  isCompleted: boolean;
  lastPosition: number;
  watchedSeconds: number;
}

interface Assignment {
  id: string;
  status: string;
  submitted_at: string | null;
}

export default function WeekDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);
  const { accessToken } = useAuthStore();
  const [week, setWeek] = useState<WeekDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<VideoProgress | null>(null);
  const [lessonProgressMap, setLessonProgressMap] = useState<Record<string, LessonProgress>>({});
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const hasLessons = lessons.length > 0;
  const selectedLesson = hasLessons ? lessons.find(l => l.id === selectedLessonId) || null : null;

  // Determine what video to show
  const activeVideoUrl = hasLessons
    ? selectedLesson?.video_url || null
    : (week?.video_url && week.video_visible ? week.video_url : null);
  const activeVideoTitle = hasLessons
    ? selectedLesson?.title || null
    : week?.video_title || null;
  const activeVideoThumbnail = hasLessons
    ? selectedLesson?.video_thumbnail || null
    : week?.video_thumbnail || null;
  const activeInitialPosition = hasLessons && selectedLessonId
    ? lessonProgressMap[selectedLessonId]?.lastPosition || 0
    : videoProgress?.last_position || 0;

  useEffect(() => {
    if (!accessToken) return;

    const fetchData = async () => {
      try {
        // Fetch week content
        const weekRes = await fetch(`/api/lms/weeks/${weekId}/content`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!weekRes.ok) throw new Error('주차 정보를 불러올 수 없습니다');
        const weekResult = await weekRes.json();
        if (!weekResult.success) throw new Error(weekResult.error?.message || '오류 발생');
        setWeek(weekResult.data.week);

        // Fetch lessons for this week
        const lessonsRes = await fetch(`/api/lms/lessons?weekId=${weekId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (lessonsRes.ok) {
          const lessonsResult = await lessonsRes.json();
          const lessonsList: Lesson[] = lessonsResult.data?.lessons || [];
          setLessons(lessonsList);
          // Auto-select first lesson
          if (lessonsList.length > 0) {
            setSelectedLessonId(lessonsList[0].id);
          }
        }

        // Fetch video progress (includes both legacy and lesson-based)
        const progressRes = await fetch(`/api/lms/video-progress?weekId=${weekId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (progressRes.ok) {
          const progressResult = await progressRes.json();
          if (progressResult.data?.progress) {
            setVideoProgress(progressResult.data.progress);
          }
          if (progressResult.data?.lessonProgress) {
            setLessonProgressMap(progressResult.data.lessonProgress);
          }
        }

        // Fetch assignment status
        const assignRes = await fetch('/api/lms/assignments', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (assignRes.ok) {
          const assignResult = await assignRes.json();
          const assignments = assignResult.data?.assignments || [];
          const match = assignments.find((a: { week_id: string }) => a.week_id === weekId);
          if (match) setAssignment(match);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [weekId, accessToken]);

  // Save video progress (lesson-based or legacy)
  const handleProgress = useCallback(
    async (currentTime: number, duration: number) => {
      if (!accessToken || !week || savingRef.current) return;
      savingRef.current = true;
      try {
        const body: Record<string, unknown> = {
          weekId: week.id,
          courseId: week.course_id,
          currentTime,
          duration,
        };
        if (hasLessons && selectedLessonId) {
          body.lessonId = selectedLessonId;
        }
        await fetch('/api/lms/video-progress', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });
      } catch {
        // silent fail
      } finally {
        savingRef.current = false;
      }
    },
    [accessToken, week, hasLessons, selectedLessonId]
  );

  const handleComplete = useCallback(async () => {
    if (!accessToken || !week) return;
    try {
      const body: Record<string, unknown> = {
        weekId: week.id,
        courseId: week.course_id,
        currentTime: selectedLesson?.video_duration || week.video_duration || 0,
        duration: selectedLesson?.video_duration || week.video_duration || 0,
        isCompleted: true,
      };
      if (hasLessons && selectedLessonId) {
        body.lessonId = selectedLessonId;
      }
      await fetch('/api/lms/video-progress', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (hasLessons && selectedLessonId) {
        // Update local lesson progress
        setLessonProgressMap(prev => ({
          ...prev,
          [selectedLessonId]: {
            ...(prev[selectedLessonId] || { lessonId: selectedLessonId, lastPosition: 0, watchedSeconds: 0 }),
            watchPercentage: 100,
            isCompleted: true,
          },
        }));
      } else {
        setVideoProgress(prev => prev
          ? { ...prev, is_completed: true, watch_percentage: 100 }
          : { last_position: 0, watch_percentage: 100, is_completed: true }
        );
      }
    } catch {
      // silent
    }
  }, [accessToken, week, hasLessons, selectedLessonId, selectedLesson]);

  const handleSelectLesson = (lessonId: string) => {
    setSelectedLessonId(lessonId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error || !week) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error || '주차를 찾을 수 없습니다'}</p>
        <Link href="/lms/weeks" className="mt-4 inline-block text-purple-400 hover:text-purple-300">
          ← 주차별 진도로 돌아가기
        </Link>
      </div>
    );
  }

  const markdown = week.content_json?.markdown || '';

  // Calculate overall lesson completion
  const completedLessons = lessons.filter(l => lessonProgressMap[l.id]?.isCompleted).length;
  const allLessonsCompleted = hasLessons && completedLessons === lessons.length;
  const isVideoCompleted = hasLessons ? allLessonsCompleted : videoProgress?.is_completed;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/lms/weeks" className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1 mb-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            주차별 진도
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {week.week_number}주차: {week.title}
          </h1>
          {week.description && (
            <p className="text-slate-400 mt-1">{week.description}</p>
          )}
        </div>
        {isVideoCompleted && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-600/20 rounded-full">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-sm text-green-400 font-medium">시청 완료</span>
          </div>
        )}
      </div>

      {/* Lesson List (if lessons exist) */}
      {hasLessons && (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                레슨 목록
              </h3>
              <span className="text-xs text-slate-500">
                {completedLessons}/{lessons.length} 완료
              </span>
            </div>
          </div>
          <div className="divide-y divide-slate-700/30">
            {lessons.map((lesson, idx) => {
              const lp = lessonProgressMap[lesson.id];
              const isSelected = selectedLessonId === lesson.id;
              const isCompleted = lp?.isCompleted;
              const percentage = lp?.watchPercentage || 0;

              return (
                <button
                  key={lesson.id}
                  onClick={() => handleSelectLesson(lesson.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? 'bg-purple-600/10 border-l-2 border-purple-500'
                      : 'hover:bg-slate-700/30 border-l-2 border-transparent'
                  }`}
                >
                  {/* Status Icon */}
                  <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center">
                    {isCompleted ? (
                      <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : isSelected ? (
                      <svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : percentage > 0 ? (
                      <div className="w-5 h-5 rounded-full border-2 border-purple-500 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-purple-500" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-600" />
                    )}
                  </div>

                  {/* Lesson Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-mono">{idx + 1}.</span>
                      <span className={`text-sm truncate ${isSelected ? 'text-white font-medium' : 'text-slate-300'}`}>
                        {lesson.title}
                      </span>
                      {isSelected && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-purple-600/30 text-purple-300 flex-shrink-0">
                          현재
                        </span>
                      )}
                    </div>
                    {lesson.description && (
                      <p className="text-xs text-slate-500 mt-0.5 truncate">{lesson.description}</p>
                    )}
                  </div>

                  {/* Duration & Progress */}
                  <div className="flex items-center gap-2 flex-shrink-0 text-xs text-slate-500">
                    {lesson.video_duration && (
                      <span>{Math.floor(lesson.video_duration / 60)}:{(lesson.video_duration % 60).toString().padStart(2, '0')}</span>
                    )}
                    {isCompleted ? (
                      <span className="text-green-400">완료</span>
                    ) : percentage > 0 ? (
                      <span className="text-purple-400">{percentage}%</span>
                    ) : (
                      <span>미시작</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Video Player */}
      {activeVideoUrl && (
        <div className="space-y-2">
          {activeVideoTitle && (
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {activeVideoTitle}
            </h2>
          )}
          <VideoPlayer
            key={activeVideoUrl}
            videoUrl={activeVideoUrl}
            title={activeVideoTitle || week.title}
            thumbnailUrl={activeVideoThumbnail || undefined}
            initialPosition={activeInitialPosition}
            onProgress={handleProgress}
            onComplete={handleComplete}
          />
          {/* Progress indicator for current video */}
          {(() => {
            const currentProgress = hasLessons && selectedLessonId
              ? lessonProgressMap[selectedLessonId]
              : videoProgress;
            const pct = hasLessons && selectedLessonId
              ? (lessonProgressMap[selectedLessonId]?.watchPercentage || 0)
              : (videoProgress?.watch_percentage || 0);
            const completed = hasLessons && selectedLessonId
              ? lessonProgressMap[selectedLessonId]?.isCompleted
              : videoProgress?.is_completed;

            if (currentProgress && !completed && pct > 0) {
              return (
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span>{pct}% 시청</span>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {/* No video placeholder */}
      {!activeVideoUrl && (
        <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
          <svg className="w-12 h-12 text-slate-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <p className="text-slate-400">
            {hasLessons
              ? '선택한 레슨에 영상이 등록되지 않았습니다.'
              : '이번 주차에는 영상이 아직 등록되지 않았습니다.'
            }
          </p>
        </div>
      )}

      {/* Content */}
      {markdown && (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            학습 자료
          </h3>
          <div className="prose prose-invert prose-sm max-w-none text-slate-300 leading-relaxed whitespace-pre-wrap">
            {markdown}
          </div>
        </div>
      )}

      {/* Materials */}
      {week.materials && week.materials.length > 0 && (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            첨부 자료
          </h3>
          <div className="space-y-2">
            {week.materials.map((url, index) => (
              <a
                key={index}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg hover:bg-slate-900 transition-colors text-slate-300 hover:text-white"
              >
                <svg className="w-5 h-5 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm truncate">{url.split('/').pop() || `자료 ${index + 1}`}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Actions: Assignment + Feedback */}
      <div className="flex flex-col sm:flex-row gap-3">
        {!assignment ? (
          <Link
            href={`/lms/assignments/new?weekId=${week.id}`}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            과제 제출하기
          </Link>
        ) : (
          <>
            <Link
              href={`/lms/assignments/${assignment.id}`}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-xl transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {assignment.status === 'draft' ? '이어서 작성' : '과제 보기'}
            </Link>
            {assignment.status === 'reviewed' && (
              <Link
                href="/lms/feedbacks"
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600/20 hover:bg-green-600/30 text-green-400 font-medium rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                피드백 보기
              </Link>
            )}
          </>
        )}
      </div>

      {/* Deadline info */}
      {week.deadline && (
        <div className="text-center text-sm text-slate-500">
          마감일: {new Date(week.deadline).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
    </div>
  );
}
