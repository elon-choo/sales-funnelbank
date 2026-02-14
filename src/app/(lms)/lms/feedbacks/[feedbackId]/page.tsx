// src/app/(lms)/lms/feedbacks/[feedbackId]/page.tsx
// 피드백 상세 페이지 - 마크다운 렌더링 + PDF 다운로드
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Markdown } from '@/components/ui/markdown';
import Link from 'next/link';

interface FeedbackDetail {
  id: string;
  assignment_id: string;
  user_id: string;
  content: string;
  summary: string;
  scores: { total: number } | null;
  version: number;
  status: string;
  created_at: string;
  assignments: {
    id: string;
    course_id: string;
    week_id: string;
    content: Record<string, string>;
    version: number;
    status: string;
    submitted_at: string;
    courses: { id: string; title: string };
    course_weeks: {
      id: string;
      week_number: number;
      title: string;
      assignment_type: string;
    };
  };
}

interface StudentProfile {
  id: string;
  email: string;
  full_name: string;
}

export default function FeedbackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken, user } = useAuthStore();
  const [feedback, setFeedback] = useState<FeedbackDetail | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [isAdminView, setIsAdminView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const feedbackId = params.feedbackId as string;

  useEffect(() => {
    const fetchFeedback = async () => {
      if (!accessToken || !feedbackId) return;

      try {
        const response = await fetch(`/api/lms/feedbacks/${feedbackId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          if (response.status === 404) throw new Error('피드백을 찾을 수 없습니다');
          throw new Error('피드백을 불러오는데 실패했습니다');
        }

        const result = await response.json();
        if (result.success) {
          setFeedback(result.data.feedback);
          if (result.data.isAdminView) {
            setIsAdminView(true);
            setStudentProfile(result.data.studentProfile);
          }
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

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = async () => {
    if (!accessToken || !feedbackId || pdfLoading) return;
    setPdfLoading(true);
    try {
      const response = await fetch(`/api/lms/feedbacks/${feedbackId}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('PDF 생성 실패');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `feedback_${feedbackId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('PDF 다운로드에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
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
  const score = feedback.scores?.total;

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Breadcrumb - hidden in print */}
      <div className="flex items-center gap-2 text-sm print:hidden">
        <Link href="/lms/feedbacks" className="text-slate-400 hover:text-purple-400 transition-colors">
          피드백 목록
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-white">
          {assignment?.course_weeks?.week_number}주차 피드백
        </span>
      </div>

      {/* Admin Banner */}
      {isAdminView && studentProfile && (
        <div className="bg-amber-900/30 border border-amber-500/40 rounded-xl px-5 py-3 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-amber-600/30 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div>
              <span className="text-xs text-amber-400/70 uppercase tracking-wider font-medium">관리자 열람</span>
              <p className="text-sm text-amber-200 font-medium">
                {studentProfile.full_name} ({studentProfile.email})
              </p>
            </div>
          </div>
          <Link
            href="/lms-admin/feedbacks"
            className="text-xs text-amber-400 hover:text-amber-300 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 rounded-lg transition-colors"
          >
            ← 관리자 피드백 목록
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 print:bg-white print:border-gray-300 print:text-black">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0 print:bg-purple-100">
              <span className="text-2xl font-bold text-purple-400 print:text-purple-700">
                {assignment?.course_weeks?.week_number || '?'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white print:text-black">
                {assignment?.course_weeks?.week_number}주차: {assignment?.course_weeks?.title || '과제'}
              </h1>
              <p className="text-slate-400 mt-1 print:text-gray-600">{assignment?.courses?.title}</p>
              <p className="text-sm text-slate-500 mt-2 print:text-gray-500">
                {new Date(feedback.created_at).toLocaleString('ko-KR')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {score !== undefined && score !== null && (
              <div className={`px-6 py-3 rounded-xl text-center ${
                score >= 80 ? 'bg-green-600/20 print:bg-green-100' :
                score >= 60 ? 'bg-yellow-600/20 print:bg-yellow-100' :
                'bg-red-600/20 print:bg-red-100'
              }`}>
                <span className="text-xs text-slate-400 uppercase tracking-wide print:text-gray-500">총점</span>
                <p className={`text-3xl font-bold ${
                  score >= 80 ? 'text-green-400 print:text-green-700' :
                  score >= 60 ? 'text-yellow-400 print:text-yellow-700' :
                  'text-red-400 print:text-red-700'
                }`}>
                  {score}
                </p>
                <span className="text-xs text-slate-500 print:text-gray-500">/ 100</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feedback Content - Markdown */}
      <div className="bg-slate-800/50 rounded-2xl p-8 border border-slate-700 print:bg-white print:border-gray-300 print:p-4">
        <div className="prose prose-invert prose-lg max-w-none print:prose print:prose-sm">
          <Markdown content={feedback.content} />
        </div>
      </div>

      {/* Actions - hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href="/lms/feedbacks"
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          ← 목록으로
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPdf}
            disabled={pdfLoading}
            className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors flex items-center gap-2"
          >
            {pdfLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            )}
            {pdfLoading ? 'PDF 생성 중...' : 'PDF 다운로드'}
          </button>
          <Link
            href={`/lms/assignments/${feedback.assignment_id}`}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl transition-colors"
          >
            원본 과제 보기 →
          </Link>
        </div>
      </div>
    </div>
  );
}
