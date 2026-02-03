// src/app/(lms)/lms/feedbacks/page.tsx
// 학생 피드백 목록 페이지
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface Feedback {
  id: string;
  assignment_id: string;
  version: number;
  ai_model: string;
  raw_feedback: string;
  parsed_feedback: Record<string, unknown> | null;
  score: number | null;
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

interface FeedbacksResponse {
  feedbacks: Feedback[];
  total: number;
  limit: number;
  offset: number;
}

export default function FeedbacksPage() {
  const { accessToken } = useAuthStore();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeedbacks = async () => {
      if (!accessToken) return;

      try {
        const response = await fetch('/api/lms/feedbacks', {
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

  // Calculate average score
  const scores = feedbacks.map((f) => f.score).filter((s): s is number => s !== null);
  const averageScore = scores.length > 0
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 10) / 10
    : null;

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
        <p className="text-slate-400 mt-1">받은 AI 피드백을 모아보세요</p>
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
            {averageScore !== null ? `${averageScore}점` : '-'}
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

      {/* Score Distribution */}
      {scores.length > 0 && (
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
          <h3 className="text-sm font-medium text-white mb-3">점수 분포</h3>
          <div className="flex items-center gap-2">
            {[
              { label: '90+', min: 90, max: 100, color: 'bg-green-500' },
              { label: '80-89', min: 80, max: 89, color: 'bg-green-400' },
              { label: '70-79', min: 70, max: 79, color: 'bg-yellow-400' },
              { label: '60-69', min: 60, max: 69, color: 'bg-yellow-500' },
              { label: '60 미만', min: 0, max: 59, color: 'bg-red-400' },
            ].map((range) => {
              const count = scores.filter((s) => s >= range.min && s <= range.max).length;
              const percentage = scores.length > 0 ? (count / scores.length) * 100 : 0;
              return (
                <div key={range.label} className="flex-1">
                  <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${range.color}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-slate-500">{range.label}</span>
                    <span className="text-xs text-slate-400">{count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback List */}
      {feedbacks.length === 0 ? (
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
          {feedbacks.map((feedback) => (
            <Link
              key={feedback.id}
              href={`/lms/feedbacks/${feedback.id}`}
              className="block bg-slate-800/50 rounded-xl p-6 border border-slate-700 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold text-purple-400">
                      {feedback.assignments?.course_weeks?.week_number || '?'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">
                      {feedback.assignments?.course_weeks?.week_number}주차: {feedback.assignments?.course_weeks?.title || '과제'}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {feedback.assignments?.courses?.title}
                    </p>
                    <p className="text-sm text-slate-500 mt-2">
                      {new Date(feedback.created_at).toLocaleDateString('ko-KR')} · {feedback.ai_model || 'AI'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {feedback.score !== null && (
                    <span className={`px-4 py-2 rounded-xl text-lg font-bold ${
                      feedback.score >= 80 ? 'bg-green-600/20 text-green-400' :
                      feedback.score >= 60 ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-red-600/20 text-red-400'
                    }`}>
                      {feedback.score}점
                    </span>
                  )}
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Feedback Preview */}
              <div className="mt-4 p-4 bg-slate-900/50 rounded-lg">
                <p className="text-sm text-slate-300 line-clamp-3">
                  {feedback.raw_feedback?.substring(0, 300)}...
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
