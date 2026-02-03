// src/app/(lms)/lms/assignments/[assignmentId]/page.tsx
// 과제 상세 페이지
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface AssignmentDetail {
  id: string;
  course_id: string;
  week_id: string;
  content: Record<string, unknown>;
  version: number;
  status: 'draft' | 'submitted' | 'reviewed';
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
  courses: {
    id: string;
    title: string;
  };
  course_weeks: {
    id: string;
    week_number: number;
    title: string;
    deadline: string | null;
    assignment_type: string;
  };
}

interface Feedback {
  id: string;
  score: number | null;
  raw_feedback: string;
  parsed_feedback: Record<string, unknown> | null;
  created_at: string;
}

interface AttachedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  created_at: string;
}

const statusLabels: Record<string, { text: string; color: string }> = {
  draft: { text: '초안', color: 'bg-slate-600/20 text-slate-400 border-slate-500/30' },
  submitted: { text: '제출됨', color: 'bg-blue-600/20 text-blue-400 border-blue-500/30' },
  reviewed: { text: '피드백 완료', color: 'bg-green-600/20 text-green-400 border-green-500/30' },
};

export default function AssignmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const [assignment, setAssignment] = useState<AssignmentDetail | null>(null);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const assignmentId = params.assignmentId as string;

  useEffect(() => {
    const fetchData = async () => {
      if (!accessToken || !assignmentId) return;

      try {
        // Fetch assignment details from the list (filtering by ID in frontend for now)
        const assignmentResponse = await fetch(`/api/lms/assignments`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!assignmentResponse.ok) {
          throw new Error('과제 정보를 불러오는데 실패했습니다');
        }

        const assignmentResult = await assignmentResponse.json();
        const foundAssignment = assignmentResult.data?.assignments?.find(
          (a: AssignmentDetail) => a.id === assignmentId
        );

        if (!foundAssignment) {
          throw new Error('과제를 찾을 수 없습니다');
        }

        setAssignment(foundAssignment);

        // Fetch feedbacks for this assignment
        const feedbackResponse = await fetch(`/api/lms/feedbacks?assignmentId=${assignmentId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (feedbackResponse.ok) {
          const feedbackResult = await feedbackResponse.json();
          setFeedbacks(feedbackResult.data?.feedbacks || []);
        }

        // Fetch attached files
        const filesResponse = await fetch(`/api/lms/assignments/${assignmentId}/files`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (filesResponse.ok) {
          const filesResult = await filesResponse.json();
          setFiles(filesResult.data?.files || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [accessToken, assignmentId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`/api/lms/assignments/${assignmentId}/files`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setFiles((prev) => [...prev, result.data.file]);
      } else {
        setUploadError(result.error?.message || '업로드 실패');
      }
    } catch {
      setUploadError('파일 업로드 중 오류가 발생했습니다');
    } finally {
      setUploading(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!accessToken || !confirm('이 파일을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/lms/assignments/${assignmentId}/files`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileId }),
      });

      const result = await response.json();

      if (result.success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId));
      } else {
        alert(result.error?.message || '삭제 실패');
      }
    } catch {
      alert('파일 삭제 중 오류가 발생했습니다');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return (
        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (type === 'application/pdf') {
      return (
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error || '과제를 찾을 수 없습니다'}</p>
        <button
          onClick={() => router.push('/lms/assignments')}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          목록으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm">
        <Link href="/lms/assignments" className="text-slate-400 hover:text-purple-400 transition-colors">
          과제 목록
        </Link>
        <span className="text-slate-600">/</span>
        <span className="text-white">
          {assignment.course_weeks?.week_number}주차
        </span>
      </div>

      {/* Header */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-purple-600/20 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-2xl font-bold text-purple-400">
                {assignment.course_weeks?.week_number || '?'}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">
                {assignment.course_weeks?.week_number}주차: {assignment.course_weeks?.title || '과제'}
              </h1>
              <p className="text-slate-400 mt-1">{assignment.courses?.title}</p>
              <div className="flex items-center gap-4 mt-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusLabels[assignment.status]?.color}`}>
                  {statusLabels[assignment.status]?.text || assignment.status}
                </span>
                <span className="text-sm text-slate-500">버전 {assignment.version}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Meta Info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700">
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wide">작성일</span>
            <p className="text-white mt-1">{new Date(assignment.created_at).toLocaleDateString('ko-KR')}</p>
          </div>
          {assignment.submitted_at && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">제출일</span>
              <p className="text-white mt-1">{new Date(assignment.submitted_at).toLocaleDateString('ko-KR')}</p>
            </div>
          )}
          {assignment.course_weeks?.deadline && (
            <div>
              <span className="text-xs text-slate-500 uppercase tracking-wide">마감일</span>
              <p className="text-white mt-1">{new Date(assignment.course_weeks.deadline).toLocaleDateString('ko-KR')}</p>
            </div>
          )}
          <div>
            <span className="text-xs text-slate-500 uppercase tracking-wide">유형</span>
            <p className="text-white mt-1">{assignment.course_weeks?.assignment_type || 'script'}</p>
          </div>
        </div>
      </div>

      {/* Content Preview */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">제출 내용</h2>
        <div className="bg-slate-900/50 rounded-xl p-4 max-h-96 overflow-y-auto">
          <pre className="text-sm text-slate-300 whitespace-pre-wrap">
            {typeof assignment.content === 'object'
              ? JSON.stringify(assignment.content, null, 2)
              : String(assignment.content)}
          </pre>
        </div>
      </div>

      {/* Attached Files */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">첨부파일</h2>
          {assignment.status !== 'reviewed' && files.length < 5 && (
            <label className={`px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
              uploading
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 border border-purple-500/30'
            }`}>
              {uploading ? (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  업로드 중...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  파일 추가
                </span>
              )}
              <input
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.doc,.docx"
              />
            </label>
          )}
        </div>

        {uploadError && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {uploadError}
          </div>
        )}

        {files.length === 0 ? (
          <div className="bg-slate-900/50 rounded-xl p-8 text-center">
            <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <p className="text-slate-400">첨부된 파일이 없습니다</p>
            {assignment.status !== 'reviewed' && (
              <p className="text-sm text-slate-500 mt-2">
                PDF, 이미지, 문서 파일을 첨부할 수 있습니다 (최대 5개, 각 10MB)
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-3 bg-slate-900/50 rounded-xl hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {getFileIcon(file.file_type)}
                  <div>
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white hover:text-purple-400 transition-colors"
                    >
                      {file.file_name}
                    </a>
                    <p className="text-xs text-slate-500">
                      {formatFileSize(file.file_size)} · {new Date(file.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-slate-400 hover:text-white transition-colors"
                    title="다운로드"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </a>
                  {assignment.status !== 'reviewed' && (
                    <button
                      onClick={() => handleFileDelete(file.id)}
                      className="p-2 text-slate-400 hover:text-red-400 transition-colors"
                      title="삭제"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
            {files.length >= 5 && (
              <p className="text-xs text-slate-500 text-center py-2">
                파일은 최대 5개까지 첨부할 수 있습니다
              </p>
            )}
          </div>
        )}
      </div>

      {/* Feedback Section */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        <h2 className="text-lg font-semibold text-white mb-4">AI 피드백</h2>

        {feedbacks.length === 0 ? (
          <div className="bg-slate-900/50 rounded-xl p-8 text-center">
            {assignment.status === 'submitted' ? (
              <>
                <div className="w-12 h-12 bg-yellow-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-yellow-400 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <p className="text-yellow-400 font-medium">피드백 생성 중...</p>
                <p className="text-sm text-slate-400 mt-2">
                  AI가 과제를 분석하고 있습니다. 잠시 후 다시 확인해주세요.
                </p>
              </>
            ) : assignment.status === 'draft' ? (
              <>
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <p className="text-slate-400">과제를 제출하면 AI 피드백을 받을 수 있습니다.</p>
              </>
            ) : (
              <>
                <svg className="w-12 h-12 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-slate-400">아직 피드백이 없습니다.</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {feedbacks.map((feedback) => (
              <Link
                key={feedback.id}
                href={`/lms/feedbacks/${feedback.id}`}
                className="block bg-slate-900/50 rounded-xl p-4 hover:bg-slate-900 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    {feedback.score !== null && (
                      <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                        feedback.score >= 80 ? 'bg-green-600/20 text-green-400' :
                        feedback.score >= 60 ? 'bg-yellow-600/20 text-yellow-400' :
                        'bg-red-600/20 text-red-400'
                      }`}>
                        {feedback.score}점
                      </span>
                    )}
                    <span className="text-sm text-slate-400">
                      {new Date(feedback.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <p className="text-slate-300 line-clamp-3">
                  {feedback.raw_feedback?.substring(0, 200)}...
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Link
          href="/lms/assignments"
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          ← 목록으로
        </Link>
        {assignment.status === 'draft' && (
          <button
            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
          >
            과제 제출하기
          </button>
        )}
      </div>
    </div>
  );
}
