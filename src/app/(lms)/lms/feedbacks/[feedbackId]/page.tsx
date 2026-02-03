// src/app/(lms)/lms/feedbacks/[feedbackId]/page.tsx
// 피드백 상세 페이지
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface FeedbackDetail {
  id: string;
  assignment_id: string;
  version: number;
  ai_model: string;
  raw_feedback: string;
  parsed_feedback: {
    summary?: string;
    strengths?: string[];
    improvements?: string[];
    suggestions?: string[];
    detailedAnalysis?: string;
    [key: string]: unknown;
  } | null;
  score: number | null;
  created_at: string;
  assignments: {
    id: string;
    user_id: string;
    course_id: string;
    week_id: string;
    content: Record<string, unknown>;
    version: number;
    status: string;
    submitted_at: string;
    courses: {
      id: string;
      title: string;
    };
    course_weeks: {
      id: string;
      week_number: number;
      title: string;
      assignment_type: string;
    };
  };
}

export default function FeedbackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const feedbackId = params.feedbackId as string;

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!accessToken || !feedbackId) return;

      try {
        const response = await fetch(`/api/lms/feedbacks/${feedbackId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('피드백을 찾을 수 없습니다');
          }
          throw new Error('피드백을 불러오는데 실패했습니다');
        }

        const result = await response.json();
        if (result.success) {
          setFeedback(result.data.feedback);
        } else {
          throw new Error(result.error?.message || '알 수 없는 오류');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchFeedback();
  }, [accessToken, feedbackId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !feedback) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error || '피드백을 찾을 수 없습니다'}</p>
        <button
          onClick={() => router.push('/lms/feedbacks')}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  const assignment = feedback.assignments;
  const parsed = feedback.parsed_feedback;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/lms/feedbacks" className="text-slate-400 hover:text-purple-400 transition-colors">
          피드백 목록
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-white">
          {assignment?.course_weeks?.week_number}주차 피드백
        </span>
      </div>

      {/* Header */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-purple-400">
                {assignment?.course_weeks?.week_number || '?'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {assignment?.course_weeks?.week_number}주차: {assignment?.course_weeks?.title || '과제'}
              </h1>
              <p className="text-slate-400 mt-1">{assignment?.courses?.title}</p>
              <div className="flex items-center gap-4 mt-3">
                <span className="text-sm text-slate-500">
                  {feedback.ai_model || 'AI'} · {new Date(feedback.created_at).toLocaleString('ko-KR')}
                </span>
              </div>
            </div>
          </div>
          {feedback.score !== null && (
            <div className={`px-6 py-3 rounded-xl text-center ${
              feedback.score >= 80 ? 'bg-green-600/20' :
              feedback.score >= 60 ? 'bg-yellow-600/20' :
              'bg-red-600/20'
            }`}>
              <span className="text-xs text-slate-400 uppercase tracking-wide">점수</span>
              <p className={`text-3xl font-bold ${
                feedback.score >= 80 ? 'text-green-400' :
                feedback.score >= 60 ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {feedback.score}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Parsed Feedback Sections */}
      {parsed && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Summary */}
          {parsed.summary && (
            <div className="lg:col-span-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-2xl p-6 border border-purple-500/20">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                요약
              </h2>
              <p className="text-slate-300 leading-relaxed">{parsed.summary}</p>
            </div>
          )}

          {/* Strengths */}
          {parsed.strengths && parsed.strengths.length > 0 && (
            <div className="bg-green-900/20 rounded-2xl p-6 border border-green-500/20">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                강점
              </h2>
              <ul className="space-y-3">
                {parsed.strengths.map((strength, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-300">
                    <span className="w-6 h-6 bg-green-600/30 rounded-full flex items-center justify-center flex-shrink-0 text-xs text-green-400">
                      {index + 1}
                    </span>
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Improvements */}
          {parsed.improvements && parsed.improvements.length > 0 && (
            <div className="bg-yellow-900/20 rounded-2xl p-6 border border-yellow-500/20">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                개선점
              </h2>
              <ul className="space-y-3">
                {parsed.improvements.map((improvement, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-300">
                    <span className="w-6 h-6 bg-yellow-600/30 rounded-full flex items-center justify-center flex-shrink-0 text-xs text-yellow-400">
                      {index + 1}
                    </span>
                    {improvement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Suggestions */}
          {parsed.suggestions && parsed.suggestions.length > 0 && (
            <div className="lg:col-span-2 bg-blue-900/20 rounded-2xl p-6 border border-blue-500/20">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                제안사항
              </h2>
              <ul className="space-y-3">
                {parsed.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-start gap-3 text-slate-300">
                    <span className="w-6 h-6 bg-blue-600/30 rounded-full flex items-center justify-center flex-shrink-0 text-xs text-blue-400">
                      💡
                    </span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Raw Feedback */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          전체 피드백
        </h2>
        <div className="bg-slate-900/50 rounded-xl p-6 max-h-[600px] overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none">
            {feedback.raw_feedback.split('\n').map((paragraph, index) => (
              <p key={index} className="text-slate-300 leading-relaxed mb-4">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/lms/feedbacks"
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          ← 목록으로
        </Link>
        <Link
          href={`/lms/assignments/${feedback.assignment_id}`}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
        >
          원본 과제 보기 →
        </Link>
      </div>
    </div>
  );
}
