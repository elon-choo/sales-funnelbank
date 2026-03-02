// src/app/(lms)/lms/weeks/[weekId]/page.tsx
// 주차 상세 페이지 - 4탭 (강의/과제/자료/피드백)
'use client';

import { useEffect, useState, useCallback, use } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';
import VideoPlayer from '@/components/lms/VideoPlayer';

type TabId = 'lesson' | 'assignment' | 'material' | 'feedback';

interface WeekData {
  id: string;
  week_number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  video_title: string | null;
  video_duration: number | null;
  video_thumbnail: string | null;
  content_json: Record<string, unknown> | null;
  materials: string[] | null;
  course_id: string;
  is_active: boolean;
}

interface Assignment {
  id: string;
  week_id: string;
  version: number;
  status: string;
  submitted_at: string | null;
  course_weeks: { id: string; week_number: number; title: string };
}

interface Feedback {
  id: string;
  assignment_id: string;
  scores: { total: number } | null;
  created_at: string;
  assignments: { course_weeks: { title: string; week_number: number } };
}

export default function WeekDetailPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);
  const { accessToken } = useAuthStore();
  const [week, setWeek] = useState<WeekData | null>(null);
  const [siblingWeeks, setSiblingWeeks] = useState<WeekData[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [videoProgress, setVideoProgress] = useState<{ last_position: number; watch_percentage: number; is_completed: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('lesson');

  const fetchData = useCallback(async () => {
    if (!accessToken || !weekId) return;
    setLoading(true);
    try {
      // Fetch week content
      const weekRes = await fetch(`/api/lms/weeks/${weekId}/content`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const weekData = await weekRes.json();
      if (weekData.success) {
        const w = weekData.data.week || weekData.data;
        setWeek(w);

        // Fetch sibling weeks (same week_number) for assignment tab
        if (w.week_number) {
          const allWeeksRes = await fetch(`/api/lms/weeks?courseId=${w.course_id}`, { headers: { Authorization: `Bearer ${accessToken}` } });
          const allWeeksData = await allWeeksRes.json();
          if (allWeeksData.success) {
            const siblings = (allWeeksData.data.weeks || []).filter((wk: WeekData) => wk.week_number === w.week_number);
            setSiblingWeeks(siblings);
          }
        }
      }

      // Fetch video progress
      const progressRes = await fetch(`/api/lms/video-progress?weekId=${weekId}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      const progressData = await progressRes.json();
      if (progressData.success && progressData.data.progress) {
        setVideoProgress(progressData.data.progress);
      }

      // Fetch assignments for this week_number
      const assignRes = await fetch('/api/lms/assignments', { headers: { Authorization: `Bearer ${accessToken}` } });
      const assignData = await assignRes.json();
      if (assignData.success) {
        setAssignments(assignData.data.assignments || []);
      }

      // Fetch feedbacks
      const fbRes = await fetch('/api/lms/feedbacks', { headers: { Authorization: `Bearer ${accessToken}` } });
      const fbData = await fbRes.json();
      if (fbData.success) {
        setFeedbacks(fbData.data.feedbacks || []);
      }
    } catch (err) {
      console.error('Week detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [accessToken, weekId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleVideoProgress = useCallback(async (currentTime: number, duration: number) => {
    if (!accessToken || !weekId) return;
    try {
      await fetch('/api/lms/video-progress', {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekId, courseId: week?.course_id, currentTime, duration }),
      });
    } catch { /* non-critical */ }
  }, [accessToken, weekId, week?.course_id]);

  const handleVideoComplete = useCallback(() => {
    // Refresh progress
    fetchData();
  }, [fetchData]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" /></div>;
  }

  if (!week) {
    return <div className="text-center py-12 text-slate-400">주차 정보를 찾을 수 없습니다</div>;
  }

  // Filter assignments/feedbacks for this week_number
  const weekNumber = week.week_number;
  const siblingIds = siblingWeeks.map(s => s.id);
  const weekAssignments = assignments.filter(a => siblingIds.includes(a.week_id || a.course_weeks?.id));
  const weekFeedbacks = feedbacks.filter(f => {
    const fWeekNum = f.assignments?.course_weeks?.week_number;
    return fWeekNum === weekNumber;
  });

  const tabs: { id: TabId; label: string; icon: string; count?: number }[] = [
    { id: 'lesson', label: '강의', icon: '📹' },
    { id: 'assignment', label: '과제', icon: '📝', count: siblingWeeks.length },
    { id: 'material', label: '자료', icon: '📎' },
    { id: 'feedback', label: '피드백', icon: '💬', count: weekFeedbacks.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/lms/weeks" className="text-slate-400 hover:text-purple-400">주차별 진도</Link>
        <span className="text-slate-600">/</span>
        <span className="text-white">{weekNumber}주차</span>
      </div>

      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 bg-purple-600/30 rounded-xl flex items-center justify-center">
            <span className="text-2xl font-bold text-purple-400">{weekNumber}</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{weekNumber}주차</h1>
            <p className="text-slate-400 text-sm">{siblingWeeks.map(s => s.title).join(' + ')}</p>
          </div>
        </div>
        {videoProgress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>영상 시청률</span>
              <span>{videoProgress.watch_percentage}%{videoProgress.is_completed ? ' ✅' : ''}</span>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full">
              <div className={`h-full rounded-full ${videoProgress.is_completed ? 'bg-green-500' : 'bg-purple-500'}`} style={{ width: `${videoProgress.watch_percentage}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-700 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-[1px] whitespace-nowrap flex items-center gap-2 transition-colors ${
              activeTab === tab.id ? 'text-purple-400 border-purple-400' : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-600/30 text-purple-300">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== 강의 탭 ===== */}
      {activeTab === 'lesson' && (() => {
        // Find video from current week or any sibling week (same week_number)
        const videoWeek = week.video_url ? week : siblingWeeks.find(sw => sw.video_url);
        const videoUrl = (videoWeek as WeekData | undefined)?.video_url;
        const videoTitle = (videoWeek as WeekData | undefined)?.video_title;
        const videoThumbnail = (videoWeek as WeekData | undefined)?.video_thumbnail;

        return (
        <div className="space-y-4">
          {videoUrl ? (
            <VideoPlayer
              videoUrl={videoUrl}
              title={videoTitle || `${weekNumber}주차 강의`}
              thumbnailUrl={videoThumbnail || undefined}
              initialPosition={videoProgress?.last_position || 0}
              onProgress={handleVideoProgress}
              onComplete={handleVideoComplete}
            />
          ) : (
            <div className="aspect-video bg-slate-800/50 rounded-xl flex flex-col items-center justify-center border border-slate-700">
              <svg className="w-16 h-16 text-slate-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p className="text-slate-500">아직 등록된 강의 영상이 없습니다</p>
            </div>
          )}

          {week.description && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-white font-medium mb-3">주차 소개</h3>
              <p className="text-slate-300 text-sm whitespace-pre-wrap">{week.description}</p>
            </div>
          )}
        </div>
        );
      })()}

      {/* ===== 과제 탭 ===== */}
      {activeTab === 'assignment' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-medium">이번 주차 과제 ({siblingWeeks.length}개)</h3>
            <Link href="/lms/assignments/new" className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm transition-colors">
              과제 제출하기
            </Link>
          </div>

          {siblingWeeks.map(sw => {
            const swAssignments = weekAssignments.filter(a => (a.week_id || a.course_weeks?.id) === sw.id);
            const latestAssignment = swAssignments.sort((a, b) => b.version - a.version)[0];
            const status = latestAssignment?.status || 'not_started';
            const hasFeedback = status === 'feedback_ready';
            const relatedFb = weekFeedbacks.find(f => f.assignment_id === latestAssignment?.id);

            return (
              <div key={sw.id} className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-white font-medium">{sw.title}</h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        hasFeedback ? 'bg-green-600/20 text-green-400' :
                        status === 'submitted' ? 'bg-blue-600/20 text-blue-400' :
                        status === 'draft' ? 'bg-yellow-600/20 text-yellow-400' :
                        'bg-slate-600/20 text-slate-400'
                      }`}>
                        {hasFeedback ? '피드백 완료' : status === 'submitted' ? '제출됨' : status === 'draft' ? '작성 중' : '미시작'}
                      </span>
                      {latestAssignment?.submitted_at && (
                        <span className="text-xs text-slate-500">
                          제출: {new Date(latestAssignment.submitted_at).toLocaleDateString('ko-KR')}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {relatedFb && (
                      <Link href={`/lms/feedbacks/${relatedFb.id}`} className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg text-xs transition-colors">
                        피드백 보기
                      </Link>
                    )}
                    {latestAssignment ? (
                      <Link href={`/lms/assignments/${latestAssignment.id}`} className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-400 rounded-lg text-xs transition-colors">
                        과제 보기
                      </Link>
                    ) : (
                      <Link href={`/lms/assignments/new?weekId=${sw.id}`} className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs transition-colors">
                        과제 작성
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ===== 자료 탭 ===== */}
      {activeTab === 'material' && (
        <div className="space-y-4">
          {week.description ? (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-white font-medium mb-3">학습 자료</h3>
              <div className="prose prose-invert prose-sm max-w-none">
                <p className="text-slate-300 whitespace-pre-wrap">{week.description}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
              <p className="text-slate-500">등록된 학습 자료가 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* ===== 피드백 탭 ===== */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {weekFeedbacks.length === 0 ? (
            <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700 text-center">
              <p className="text-slate-500">아직 받은 피드백이 없습니다</p>
              <p className="text-slate-600 text-xs mt-2">과제를 제출하면 AI가 분석하여 피드백을 생성합니다</p>
            </div>
          ) : (
            weekFeedbacks.map(fb => (
              <Link
                key={fb.id}
                href={`/lms/feedbacks/${fb.id}`}
                className="block bg-slate-800/50 rounded-xl p-5 border border-slate-700 hover:border-purple-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium text-sm">{fb.assignments?.course_weeks?.title || '과제'}</h4>
                    <p className="text-xs text-slate-500 mt-1">{new Date(fb.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {fb.scores?.total != null && (
                      <span className={`px-3 py-1 rounded-lg text-sm font-bold ${
                        fb.scores.total >= 70 ? 'bg-green-600/20 text-green-400' :
                        fb.scores.total >= 40 ? 'bg-yellow-600/20 text-yellow-400' :
                        'bg-red-600/20 text-red-400'
                      }`}>
                        {fb.scores.total}점
                      </span>
                    )}
                    <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
