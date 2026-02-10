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

type SubmitMode = 'input' | 'file';
type Step = 'select-week' | 'select-mode' | 'form';

export default function NewAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>('select-week');
  const [submitMode, setSubmitMode] = useState<SubmitMode | null>(null);

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

        // URL 파라미터로 주차가 지정되면 바로 선택
        const weekIdParam = searchParams.get('weekId');
        if (weekIdParam) {
          const target = weekList.find((w: WeekInfo) => w.id === weekIdParam);
          if (target) {
            setSelectedWeek(target);
            setStep('select-mode');
          }
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

        const rawConfigs = configData.data?.configs || configData.data?.fieldConfigs;
        if (configData.success && rawConfigs) {
          const sorted = rawConfigs.sort(
            (a: FieldConfig, b: FieldConfig) => a.sort_order - b.sort_order
          );
          setFields(sorted);

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

  // 자동 저장 (localStorage) - 직접 입력 모드일 때만
  useEffect(() => {
    if (!selectedWeek || Object.keys(formData).length === 0 || submitMode !== 'input') return;
    const draftKey = `assignment_draft_${selectedWeek.id}`;
    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [formData, selectedWeek, submitMode]);

  const handleSelectWeek = (week: WeekInfo) => {
    setSelectedWeek(week);
    setFormData({});
    setSubmitMode(null);
    setStep('select-mode');
  };

  const handleSelectMode = (mode: SubmitMode) => {
    setSubmitMode(mode);
    setStep('form');
  };

  const handleBack = () => {
    if (step === 'form') {
      setStep('select-mode');
      setSubmitMode(null);
    } else if (step === 'select-mode') {
      setStep('select-week');
      setSelectedWeek(null);
      setSubmissionInfo(null);
    } else {
      router.push('/lms/assignments');
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

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
              content: {},
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

    if (!isDraft && submissionInfo && !submissionInfo.canSubmit) {
      setError('이 주차의 최대 제출 횟수(2회)를 초과했습니다.');
      return;
    }

    // 파일 모드: 파일이 없으면 제출 불가
    if (submitMode === 'file' && !isDraft && uploadedFiles.length === 0) {
      setError('파일을 1개 이상 첨부해주세요.');
      return;
    }

    // 입력 모드: 필수 필드 검증
    if (submitMode === 'input' && !isDraft) {
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
      const content: Record<string, unknown> = submitMode === 'input'
        ? { ...formData }
        : { submitMode: 'file' };

      if (uploadedFiles.length > 0) {
        content.attachedFiles = uploadedFiles.map(f => ({
          id: f.id,
          name: f.file_name,
          type: f.file_type,
          size: f.file_size,
        }));
      }

      const response = await fetch(
        `/api/lms/assignments?courseId=${courseId}&weekId=${selectedWeek.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            content,
            isDraft,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '제출에 실패했습니다.');
      }

      if (!isDraft) {
        localStorage.removeItem(`assignment_draft_${selectedWeek.id}`);
      }

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

  const getAssignmentTypeLabel = (type: string) => {
    switch (type) {
      case 'plan': return '기획서';
      case 'funnel': return '퍼널';
      case 'free': return '자유';
      default: return type;
    }
  };

  const getAssignmentTypeColor = (type: string) => {
    switch (type) {
      case 'plan': return 'from-purple-600/30 to-purple-800/30 border-purple-500/30';
      case 'funnel': return 'from-pink-600/30 to-pink-800/30 border-pink-500/30';
      default: return 'from-slate-600/30 to-slate-800/30 border-slate-500/30';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error && !selectedWeek && step === 'select-week') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.push('/lms/dashboard')}
            className="mt-4 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Progress indicator */}
      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => { setStep('select-week'); setSelectedWeek(null); setSubmitMode(null); }}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            step === 'select-week'
              ? 'bg-purple-600 text-white'
              : selectedWeek ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30' : 'bg-slate-700 text-slate-400'
          }`}
        >
          1. 과제 선택
        </button>
        <span className="text-slate-600">&rarr;</span>
        <button
          onClick={() => { if (selectedWeek) { setStep('select-mode'); setSubmitMode(null); } }}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            step === 'select-mode'
              ? 'bg-purple-600 text-white'
              : submitMode ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30' : 'bg-slate-700 text-slate-400'
          }`}
          disabled={!selectedWeek}
        >
          2. 제출 방법
        </button>
        <span className="text-slate-600">&rarr;</span>
        <span className={`px-3 py-1.5 rounded-full ${
          step === 'form'
            ? 'bg-purple-600 text-white'
            : 'bg-slate-700 text-slate-400'
        }`}>
          3. 작성 & 제출
        </span>
      </div>

      {/* Error */}
      {error && step !== 'select-week' && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* ========== STEP 1: 과제 선택 ========== */}
      {step === 'select-week' && (
        <>
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
            <p className="text-sm text-purple-300">{courseName}</p>
            <h1 className="text-2xl font-bold text-white mt-1">과제 선택</h1>
            <p className="text-slate-400 text-sm mt-2">제출할 주차와 과제 유형을 선택하세요.</p>
          </div>

          <div className="grid gap-4">
            {weeks.map(week => (
              <button
                key={week.id}
                onClick={() => handleSelectWeek(week)}
                className={`w-full text-left p-5 rounded-xl border bg-gradient-to-r transition-all hover:scale-[1.01] ${getAssignmentTypeColor(week.assignment_type)}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                        {week.week_number}주차
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        week.assignment_type === 'plan'
                          ? 'bg-purple-500/20 text-purple-300'
                          : week.assignment_type === 'funnel'
                          ? 'bg-pink-500/20 text-pink-300'
                          : 'bg-slate-500/20 text-slate-300'
                      }`}>
                        {getAssignmentTypeLabel(week.assignment_type)}
                      </span>
                      {!week.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-500">
                          비활성
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white">{week.title}</h3>
                    {week.deadline && (
                      <p className="text-xs text-slate-400 mt-1">
                        마감: {new Date(week.deadline).toLocaleString('ko-KR')}
                      </p>
                    )}
                  </div>
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>

          <div className="pt-2 pb-8">
            <button
              onClick={() => router.push('/lms/assignments')}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              &larr; 과제 목록
            </button>
          </div>
        </>
      )}

      {/* ========== STEP 2: 제출 방법 선택 ========== */}
      {step === 'select-mode' && selectedWeek && (
        <>
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-300">{courseName}</p>
                <h1 className="text-2xl font-bold text-white mt-1">제출 방법 선택</h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-300">
                    {selectedWeek.week_number}주차
                  </span>
                  <span className="text-white font-medium">{selectedWeek.title}</span>
                </div>
              </div>
              {submissionInfo && (
                <div className={`px-4 py-2 rounded-xl text-center ${
                  submissionInfo.canSubmit
                    ? 'bg-green-600/20 border border-green-500/30'
                    : 'bg-red-600/20 border border-red-500/30'
                }`}>
                  <p className="text-xs text-slate-400">남은 제출</p>
                  <p className={`text-2xl font-bold ${
                    submissionInfo.canSubmit ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {submissionInfo.remaining}
                    <span className="text-sm text-slate-500">/{submissionInfo.maxAllowed}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Submission limit warning */}
          {submissionInfo && !submissionInfo.canSubmit && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
              <p className="text-red-400 text-sm font-medium">
                이 과제의 최대 제출 횟수(2회)를 모두 사용했습니다.
              </p>
              <button
                onClick={() => router.push('/lms/feedbacks')}
                className="mt-3 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm rounded-lg transition-colors"
              >
                피드백 확인하기
              </button>
            </div>
          )}

          {loadingFields ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 직접 입력 */}
              <button
                onClick={() => handleSelectMode('input')}
                disabled={submissionInfo ? !submissionInfo.canSubmit : false}
                className="group p-6 rounded-xl border-2 border-purple-500/30 bg-purple-900/10 hover:bg-purple-900/30 hover:border-purple-500/60 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600/30 transition-colors">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">직접 입력</h3>
                <p className="text-sm text-slate-400">
                  항목별로 직접 내용을 작성하여 제출합니다.
                  {fields.length > 0 && ` (${fields.length}개 항목)`}
                </p>
              </button>

              {/* 파일 첨부 */}
              <button
                onClick={() => handleSelectMode('file')}
                disabled={submissionInfo ? !submissionInfo.canSubmit : false}
                className="group p-6 rounded-xl border-2 border-pink-500/30 bg-pink-900/10 hover:bg-pink-900/30 hover:border-pink-500/60 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <div className="w-12 h-12 bg-pink-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-pink-600/30 transition-colors">
                  <svg className="w-6 h-6 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">파일 첨부</h3>
                <p className="text-sm text-slate-400">
                  작성한 파일(PDF, Word, 이미지 등)을 업로드하여 제출합니다.
                </p>
              </button>
            </div>
          )}

          <div className="pt-2 pb-8">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              &larr; 과제 선택으로
            </button>
          </div>
        </>
      )}

      {/* ========== STEP 3: 작성 & 제출 ========== */}
      {step === 'form' && selectedWeek && submitMode && (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-purple-300">{courseName}</p>
                <h1 className="text-2xl font-bold text-white mt-1">
                  {selectedWeek.week_number}주차 - {selectedWeek.title}
                </h1>
                <div className="flex items-center gap-2 mt-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    submitMode === 'input'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-pink-500/20 text-pink-300'
                  }`}>
                    {submitMode === 'input' ? '직접 입력' : '파일 첨부'}
                  </span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    selectedWeek.assignment_type === 'plan'
                      ? 'bg-purple-500/20 text-purple-300'
                      : 'bg-pink-500/20 text-pink-300'
                  }`}>
                    {getAssignmentTypeLabel(selectedWeek.assignment_type)}
                  </span>
                </div>
              </div>
              {submissionInfo && (
                <div className={`px-4 py-2 rounded-xl text-center ${
                  submissionInfo.canSubmit
                    ? 'bg-green-600/20 border border-green-500/30'
                    : 'bg-red-600/20 border border-red-500/30'
                }`}>
                  <p className="text-xs text-slate-400">남은 제출</p>
                  <p className={`text-2xl font-bold ${
                    submissionInfo.canSubmit ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {submissionInfo.remaining}
                    <span className="text-sm text-slate-500">/{submissionInfo.maxAllowed}</span>
                  </p>
                </div>
              )}
            </div>
            {selectedWeek.deadline && (
              <p className="text-xs text-slate-400 mt-3">
                마감: {new Date(selectedWeek.deadline).toLocaleString('ko-KR')}
              </p>
            )}
            {savedDraft && submitMode === 'input' && (
              <span className="inline-flex items-center mt-3 px-2 py-1 rounded text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-500/30">
                자동 저장된 초안이 복원되었습니다
              </span>
            )}
          </div>

          {/* ===== 직접 입력 모드 ===== */}
          {submitMode === 'input' && (
            <>
              {loadingFields ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500" />
                </div>
              ) : fields.length > 0 ? (
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
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
                  <p className="text-slate-400">이 과제에 대한 입력 필드가 설정되지 않았습니다.</p>
                </div>
              )}
            </>
          )}

          {/* ===== 파일 첨부 모드 ===== */}
          {submitMode === 'file' && (
            <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
              <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                파일 업로드
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                PDF, 이미지(JPG/PNG/GIF/WebP), Word, TXT, MD 파일을 첨부할 수 있습니다. (최대 10MB, 5개까지)
              </p>

              {/* Uploaded files list */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2 mb-6">
                  {uploadedFiles.map(file => (
                    <div key={file.id} className="flex items-center justify-between bg-slate-900/50 rounded-lg px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-pink-600/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm truncate">{file.file_name}</p>
                          <p className="text-slate-500 text-xs">{formatFileSize(file.file_size)}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleFileDelete(file.id)}
                        className="text-red-400 hover:text-red-300 text-sm ml-3 flex-shrink-0 px-2 py-1 hover:bg-red-500/10 rounded"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload area */}
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
                    className="flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed border-slate-600 hover:border-pink-500/50 rounded-xl text-slate-400 hover:text-pink-400 transition-colors disabled:opacity-50 w-full"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" />
                        <span className="text-sm">업로드 중...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                        </svg>
                        <span className="text-sm font-medium">파일을 선택하세요</span>
                        <span className="text-xs text-slate-500">
                          {uploadedFiles.length > 0
                            ? `${uploadedFiles.length}/5개 첨부됨`
                            : '클릭하여 파일 선택'
                          }
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {uploadedFiles.length >= 5 && (
                <p className="text-sm text-slate-400 text-center py-2">
                  최대 5개 파일이 첨부되었습니다.
                </p>
              )}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex items-center justify-between pt-4 pb-8">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              disabled={submitting}
            >
              &larr; 제출 방법 선택
            </button>

            <div className="flex items-center gap-3">
              {submitMode === 'input' && (
                <button
                  onClick={() => handleSubmit(true)}
                  disabled={submitting}
                  className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors disabled:opacity-50"
                >
                  초안 저장
                </button>
              )}
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
