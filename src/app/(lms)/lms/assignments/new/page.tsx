// src/app/(lms)/lms/assignments/new/page.tsx
// 과제 제출 폼 페이지
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface FieldConfig {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  placeholder: string;
  help_text: string;
  is_required: boolean;
  sort_order: number;
}

interface WeekInfo {
  id: string;
  week_number: number;
  title: string;
  course_id: string;
  is_active: boolean;
  deadline: string | null;
  assignment_type: string;
}

interface SubmissionInfo {
  totalSubmitted: number;
  maxAllowed: number;
  remaining: number;
  canSubmit: boolean;
}

interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url?: string;
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [weeks, setWeeks] = useState<WeekInfo[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<WeekInfo | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState(false);
  const [submissionInfo, setSubmissionInfo] = useState<SubmissionInfo | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [lastAssignmentId, setLastAssignmentId] = useState<string | null>(null);

  // 주차 목록 로딩
  useEffect(() => {
    const loadWeeks = async () => {
      if (!accessToken) return;

      try {
        // 등록된 코스 확인
        const dashRes = await fetch('/api/lms/dashboard', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const dashData = await dashRes.json();

        if (!dashData.success || !dashData.data?.enrollments?.length) {
          setError('등록된 기수가 없습니다. 관리자에게 문의하세요.');
          setLoading(false);
          return;
        }

        const enrollment = dashData.data.enrollments[0];
        const cId = enrollment.course_id;
        setCourseId(cId);
        setCourseName(enrollment.courses?.title || '');

        // 주차 목록 조회
        const weeksRes = await fetch(`/api/lms/weeks?courseId=${cId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const weeksData = await weeksRes.json();

        if (!weeksData.success || !weeksData.data?.weeks?.length) {
          setError('열려 있는 과제 주차가 없습니다.');
          setLoading(false);
          return;
        }

        const weekList = weeksData.data.weeks;
        setWeeks(weekList);

        // URL 파라미터로 주차 선택 또는 첫 번째 활성 주차
        const weekIdParam = searchParams.get('weekId');
        const target = weekIdParam
          ? weekList.find((w: WeekInfo) => w.id === weekIdParam)
          : weekList.find((w: WeekInfo) => w.is_active) || weekList[0];

        if (target) {
          setSelectedWeek(target);
        }
      } catch (err) {
        setError('데이터 로딩 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadWeeks();
  }, [accessToken, searchParams]);

  // 주차 선택 시 필드 및 제출 현황 로딩
  useEffect(() => {
    const loadFieldsAndSubmissions = async () => {
      if (!selectedWeek || !accessToken || !courseId) return;

      setLoadingFields(true);
      setError(null);
      setFields([]);
      setSavedDraft(false);
      setUploadedFiles([]);
      setLastAssignmentId(null);

      try {
        // 필드 설정 + 제출 현황 병렬 조회
        const [configRes, assignRes] = await Promise.all([
          fetch(`/api/lms/weeks/${selectedWeek.id}/content`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`/api/lms/assignments?weekId=${selectedWeek.id}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
        ]);

        const configData = await configRes.json();
        const assignData = await assignRes.json();

        // 필드 설정
        const rawConfigs = configData.data?.configs || configData.data?.fieldConfigs;
        if (configData.success && rawConfigs) {
          const sorted = rawConfigs.sort(
            (a: FieldConfig, b: FieldConfig) => a.sort_order - b.sort_order
          );
          setFields(sorted);

          // localStorage에서 초안 복원
          const draftKey = `assignment_draft_${selectedWeek.id}`;
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            try {
              setFormData(JSON.parse(saved));
              setSavedDraft(true);
            } catch {
              // invalid draft
            }
          } else {
            setFormData({});
          }
        }

        // 제출 현황 계산
        const assignments = assignData.data?.assignments || [];
        const submittedCount = assignments.filter(
          (a: { status: string }) => a.status === 'submitted' || a.status === 'reviewed'
        ).length;
        const maxAllowed = 2;

        setSubmissionInfo({
          totalSubmitted: submittedCount,
          maxAllowed,
          remaining: Math.max(0, maxAllowed - submittedCount),
          canSubmit: submittedCount < maxAllowed,
        });

        // 가장 최근 과제 ID (파일 업로드용)
        if (assignments.length > 0) {
          setLastAssignmentId(assignments[0].id);
        }
      } catch (err) {
        setError('필드 설정을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoadingFields(false);
      }
    };

    loadFieldsAndSubmissions();
  }, [selectedWeek, accessToken, courseId]);

  // 자동 저장 (localStorage)
  useEffect(() => {
    if (!selectedWeek || Object.keys(formData).length === 0) return;
    const draftKey = `assignment_draft_${selectedWeek.id}`;
    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [formData, selectedWeek]);

  const handleWeekChange = (weekId: string) => {
    const week = weeks.find(w => w.id === weekId);
    if (week) {
      setSelectedWeek(week);
      setFormData({});
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    // 파일 크기 체크 (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    // 먼저 과제를 draft로 저장 (파일 업로드에는 assignment_id가 필요)
    let assignmentId = lastAssignmentId;

    if (!assignmentId && selectedWeek && courseId) {
      setUploading(true);
      try {
        const draftRes = await fetch(
          `/api/lms/assignments?courseId=${courseId}&weekId=${selectedWeek.id}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              content: formData,
              isDraft: true,
            }),
          }
        );
        const draftData = await draftRes.json();
        if (draftData.success) {
          assignmentId = draftData.data.assignment.id;
          setLastAssignmentId(assignmentId);
        } else {
          setError('파일 업로드를 위한 과제 초안 생성에 실패했습니다.');
          setUploading(false);
          return;
        }
      } catch {
        setError('과제 초안 생성 중 오류가 발생했습니다.');
        setUploading(false);
        return;
      }
    }

    if (!assignmentId) {
      setError('파일 업로드를 위한 과제 ID가 없습니다.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formDataObj = new FormData();
      formDataObj.append('file', file);

      const res = await fetch(`/api/lms/assignments/${assignmentId}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: formDataObj,
      });

      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error?.message || '파일 업로드 실패');
      }

      setUploadedFiles(prev => [...prev, result.data.file]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파일 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!lastAssignmentId || !accessToken) return;

    try {
      const res = await fetch(`/api/lms/assignments/${lastAssignmentId}/files`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fileId }),
      });

      const result = await res.json();
      if (result.success) {
        setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
      }
    } catch {
      setError('파일 삭제 중 오류가 발생했습니다.');
    }
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!selectedWeek || !accessToken || !courseId) return;

    // 제출 횟수 제한 체크
    if (!isDraft && submissionInfo && !submissionInfo.canSubmit) {
      setError('이 주차의 최대 제출 횟수(2회)를 초과했습니다.');
      return;
    }

    // 필수 필드 검증 (제출 시에만)
    if (!isDraft) {
      const missing = fields
        .filter(f => f.is_required && (!formData[f.field_key] || formData[f.field_key].trim() === ''))
        .map(f => f.field_label);

      if (missing.length > 0) {
        setError(`다음 항목을 입력해주세요: ${missing.join(', ')}`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/lms/assignments?courseId=${courseId}&weekId=${selectedWeek.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            content: {
              ...formData,
              attachedFiles: uploadedFiles.map(f => ({
                id: f.id,
                name: f.file_name,
                type: f.file_type,
                size: f.file_size,
              })),
            },
            isDraft,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '제출에 실패했습니다.');
      }

      // 제출 성공 시 초안 삭제
      if (!isDraft) {
        localStorage.removeItem(`assignment_draft_${selectedWeek.id}`);
      }

      // 과제 목록으로 이동
      router.push('/lms/assignments');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error && !selectedWeek) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">{error}</p>
        <button
          onClick={() => router.push('/lms/dashboard')}
          className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
        >
          대시보드로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header with week selector */}
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-purple-300">{courseName}</p>
            <h1 className="text-2xl font-bold text-white mt-1">과제 제출</h1>
          </div>
          {submissionInfo && (
            <div className={`px-4 py-2 rounded-xl text-center ${
              submissionInfo.canSubmit
                ? 'bg-green-600/20 border border-green-500/30'
                : 'bg-red-600/20 border border-red-500/30'
            }`}>
              <p className="text-xs text-slate-400">남은 제출 횟수</p>
              <p className={`text-2xl font-bold ${
                submissionInfo.canSubmit ? 'text-green-400' : 'text-red-400'
              }`}>
                {submissionInfo.remaining}
                <span className="text-sm text-slate-500">/{submissionInfo.maxAllowed}</span>
              </p>
            </div>
          )}
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-300">과제 선택:</label>
          <select
            value={selectedWeek?.id || ''}
            onChange={e => handleWeekChange(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 flex-1"
          >
            {weeks.map(w => (
              <option key={w.id} value={w.id}>
                {w.week_number}주차 - {w.title}
                {w.assignment_type === 'funnel' ? ' (퍼널)' : w.assignment_type === 'plan' ? ' (기획서)' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedWeek?.deadline && (
          <p className="text-xs text-slate-400 mt-2">
            마감: {new Date(selectedWeek.deadline).toLocaleString('ko-KR')}
          </p>
        )}

        {savedDraft && (
          <span className="inline-flex items-center mt-3 px-2 py-1 rounded text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-500/30">
            자동 저장된 초안이 복원되었습니다
          </span>
        )}
      </div>

      {/* Submission limit warning */}
      {submissionInfo && !submissionInfo.canSubmit && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm font-medium">
            이 주차의 최대 제출 횟수(2회)를 모두 사용했습니다.
          </p>
          <p className="text-slate-400 text-xs mt-1">
            피드백은 피드백 목록에서 확인 및 다운로드할 수 있습니다.
          </p>
          <button
            onClick={() => router.push('/lms/feedbacks')}
            className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
          >
            피드백 확인하기
          </button>
        </div>
      )}

      {/* Error */}
      {error && selectedWeek && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading fields */}
      {loadingFields && (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500" />
        </div>
      )}

      {/* Form */}
      {!loadingFields && fields.length > 0 && (
        <>
          <div className="space-y-6">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="w-8 h-8 bg-purple-600/30 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold text-purple-400">
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <label className="block text-white font-medium mb-1">
                      {field.field_label}
                      {field.is_required && (
                        <span className="text-red-400 ml-1">*</span>
                      )}
                    </label>
                    {field.help_text && (
                      <p className="text-slate-400 text-sm mb-3">{field.help_text}</p>
                    )}
                  </div>
                </div>

                {field.field_type === 'textarea' ? (
                  <textarea
                    value={formData[field.field_key] || ''}
                    onChange={e => handleFieldChange(field.field_key, e.target.value)}
                    placeholder={field.placeholder}
                    rows={5}
                    disabled={submitting || (submissionInfo ? !submissionInfo.canSubmit : false)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y min-h-[120px] disabled:opacity-50"
                  />
                ) : (
                  <input
                    type="text"
                    value={formData[field.field_key] || ''}
                    onChange={e => handleFieldChange(field.field_key, e.target.value)}
                    placeholder={field.placeholder}
                    disabled={submitting || (submissionInfo ? !submissionInfo.canSubmit : false)}
                    className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
                  />
                )}

                {formData[field.field_key] && (
                  <p className="text-xs text-slate-500 mt-2 text-right">
                    {formData[field.field_key].length}자
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* File Upload Section */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-medium mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              파일 첨부 (선택사항)
            </h3>
            <p className="text-slate-400 text-sm mb-4">
              PDF, 이미지, Word, TXT, MD 파일을 첨부할 수 있습니다. (최대 10MB, 5개까지)
            </p>

            {/* Uploaded files list */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-2 mb-4">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-white text-sm truncate">{file.file_name}</span>
                      <span className="text-slate-500 text-xs flex-shrink-0">({formatFileSize(file.file_size)})</span>
                    </div>
                    <button
                      onClick={() => handleFileDelete(file.id)}
                      className="text-red-400 hover:text-red-300 text-xs ml-2 flex-shrink-0"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload button */}
            {uploadedFiles.length < 5 && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.md,.doc,.docx"
                  className="hidden"
                  disabled={uploading || submitting}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || submitting || (submissionInfo ? !submissionInfo.canSubmit : false)}
                  className="flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-slate-600 hover:border-purple-500/50 rounded-lg text-slate-400 hover:text-purple-400 transition-colors disabled:opacity-50 w-full justify-center"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-500" />
                      업로드 중...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      파일 선택
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-4 pb-8">
            <button
              onClick={() => router.push('/lms/assignments')}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              disabled={submitting}
            >
              &larr; 돌아가기
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleSubmit(true)}
                disabled={submitting}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                초안 저장
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting || (submissionInfo ? !submissionInfo.canSubmit : false)}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-medium rounded-xl transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                    제출 중...
                  </>
                ) : (
                  '과제 제출 & AI 피드백 받기'
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
