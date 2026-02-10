// src/app/(lms)/lms/assignments/new/page.tsx
// 과제 제출 폼 페이지 - 주차 단위 한번에 제출
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
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

interface WeekGroup {
  weekNumber: number;
  weeks: WeekInfo[];
  titles: string[];
  hasDeadline: string | null;
  isActive: boolean;
}

interface UploadedFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  url?: string;
}

// weekId별 필드 모음
interface WeekFieldGroup {
  week: WeekInfo;
  fields: FieldConfig[];
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
  const [selectedWeekNumber, setSelectedWeekNumber] = useState<number | null>(null);
  const [courseId, setCourseId] = useState<string | null>(null);
  const [courseName, setCourseName] = useState<string>('');

  // 주차 내 각 과제 유형별 필드
  const [weekFieldGroups, setWeekFieldGroups] = useState<WeekFieldGroup[]>([]);
  // formData: weekId::fieldKey -> value
  const [formData, setFormData] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState(false);

  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [draftAssignmentId, setDraftAssignmentId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  // 주차별로 그룹핑
  const weekGroups = useMemo<WeekGroup[]>(() => {
    const map = new Map<number, WeekInfo[]>();
    weeks.forEach(w => {
      if (!map.has(w.week_number)) map.set(w.week_number, []);
      map.get(w.week_number)!.push(w);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a - b)
      .map(([num, wks]) => ({
        weekNumber: num,
        weeks: wks,
        titles: wks.map(w => w.title),
        hasDeadline: wks.find(w => w.deadline)?.deadline || null,
        isActive: wks.some(w => w.is_active),
      }));
  }, [weeks]);

  // 선택된 주차의 WeekGroup
  const selectedGroup = useMemo(
    () => weekGroups.find(g => g.weekNumber === selectedWeekNumber) || null,
    [weekGroups, selectedWeekNumber]
  );

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

        setWeeks(weeksData.data.weeks);

        // URL 파라미터로 주차 번호가 지정되면 바로 선택
        const weekIdParam = searchParams.get('weekId');
        if (weekIdParam) {
          const target = weeksData.data.weeks.find((w: WeekInfo) => w.id === weekIdParam);
          if (target) {
            setSelectedWeekNumber(target.week_number);
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

  // 주차 선택 시 → 해당 주차의 모든 과제 유형 필드 로딩
  useEffect(() => {
    const loadAllFieldsForWeek = async () => {
      if (!selectedGroup || !accessToken || !courseId) return;

      setLoadingFields(true);
      setError(null);
      setWeekFieldGroups([]);
      setSavedDraft(false);
      setUploadedFiles([]);
      setDraftAssignmentId(null);

      try {
        // 주차 내 모든 과제 유형의 필드를 병렬로 로드
        const results = await Promise.all(
          selectedGroup.weeks.map(async (week) => {
            const res = await fetch(`/api/lms/weeks/${week.id}/content`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            const data = await res.json();
            const rawConfigs = data.data?.configs || data.data?.fieldConfigs || [];
            const sorted = rawConfigs.sort(
              (a: FieldConfig, b: FieldConfig) => a.sort_order - b.sort_order
            );
            return { week, fields: sorted } as WeekFieldGroup;
          })
        );

        setWeekFieldGroups(results);

        // localStorage 초안 복원
        const draftKey = `assignment_draft_week_${selectedGroup.weekNumber}`;
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          try {
            setFormData(JSON.parse(saved));
            setSavedDraft(true);
          } catch {
            setFormData({});
          }
        } else {
          setFormData({});
        }
      } catch (err) {
        setError('필드 설정을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoadingFields(false);
      }
    };

    loadAllFieldsForWeek();
  }, [selectedGroup, accessToken, courseId]);

  // 자동 저장 (localStorage)
  useEffect(() => {
    if (selectedWeekNumber === null || Object.keys(formData).length === 0 || submitMode !== 'input') return;
    const draftKey = `assignment_draft_week_${selectedWeekNumber}`;
    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [formData, selectedWeekNumber, submitMode]);

  const handleSelectWeekNumber = (weekNum: number) => {
    setSelectedWeekNumber(weekNum);
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
      setSelectedWeekNumber(null);
    } else {
      router.push('/lms/assignments');
    }
  };

  // formKey: weekId::fieldKey
  const makeFormKey = (weekId: string, fieldKey: string) => `${weekId}::${fieldKey}`;

  const handleFieldChange = (weekId: string, fieldKey: string, value: string) => {
    const key = makeFormKey(weekId, fieldKey);
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const getFieldValue = (weekId: string, fieldKey: string) => {
    return formData[makeFormKey(weekId, fieldKey)] || '';
  };

  const processFileUpload = async (file: File) => {
    if (!accessToken || !selectedGroup || !courseId) return;

    if (file.size > 10 * 1024 * 1024) {
      setError('파일 크기는 10MB를 초과할 수 없습니다.');
      return;
    }

    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'md', 'doc', 'docx'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      setError(`지원하지 않는 파일 형식입니다. (${allowedExtensions.join(', ')})`);
      return;
    }

    if (uploadedFiles.length >= 5) {
      setError('최대 5개 파일까지 첨부할 수 있습니다.');
      return;
    }

    let assignmentId = draftAssignmentId;
    const firstWeek = selectedGroup.weeks[0];

    // draft 과제 생성 (파일 업로드에 필요)
    if (!assignmentId) {
      setUploading(true);
      try {
        const draftRes = await fetch(
          `/api/lms/assignments?courseId=${courseId}&weekId=${firstWeek.id}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ content: { _submitMode: 'file', _placeholder: true }, isDraft: true }),
          }
        );
        const draftData = await draftRes.json();
        if (draftData.success) {
          assignmentId = draftData.data.assignment.id;
          setDraftAssignmentId(assignmentId);
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
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`/api/lms/assignments/${assignmentId}/files`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: fd,
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < files.length; i++) {
      if (uploadedFiles.length + i >= 5) break;
      await processFileUpload(files[i]);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // 여러 파일 드롭 시 순차 업로드
      for (let i = 0; i < files.length; i++) {
        if (uploadedFiles.length + i >= 5) break;
        await processFileUpload(files[i]);
      }
    }
  };

  const handleFileDelete = async (fileId: string) => {
    if (!draftAssignmentId || !accessToken) return;

    try {
      const res = await fetch(`/api/lms/assignments/${draftAssignmentId}/files`, {
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
    if (!selectedGroup || !accessToken || !courseId) return;

    // 파일 모드: 파일 필수
    if (submitMode === 'file' && !isDraft && uploadedFiles.length === 0) {
      setError('파일을 1개 이상 첨부해주세요.');
      return;
    }

    // 입력 모드: 필수 필드 검증
    if (submitMode === 'input' && !isDraft) {
      const allMissing: string[] = [];
      weekFieldGroups.forEach(({ week, fields }) => {
        fields.forEach(f => {
          if (f.is_required) {
            const val = getFieldValue(week.id, f.field_key);
            if (!val || val.trim() === '') {
              allMissing.push(`[${getAssignmentTypeLabel(week.assignment_type)}] ${f.field_label}`);
            }
          }
        });
      });
      if (allMissing.length > 0) {
        setError(`다음 항목을 입력해주세요: ${allMissing.join(', ')}`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      // 각 과제 유형별로 제출
      const fileInfo = uploadedFiles.length > 0
        ? uploadedFiles.map(f => ({ id: f.id, name: f.file_name, type: f.file_type, size: f.file_size }))
        : undefined;

      for (const { week, fields } of weekFieldGroups) {
        const content: Record<string, unknown> = {};

        if (submitMode === 'input') {
          fields.forEach(f => {
            content[f.field_key] = getFieldValue(week.id, f.field_key);
          });
        } else {
          content.submitMode = 'file';
        }

        if (fileInfo) {
          content.attachedFiles = fileInfo;
        }

        const response = await fetch(
          `/api/lms/assignments?courseId=${courseId}&weekId=${week.id}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ content, isDraft }),
          }
        );
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error?.message || `${week.title} 제출에 실패했습니다.`);
        }
      }

      if (!isDraft && selectedWeekNumber !== null) {
        localStorage.removeItem(`assignment_draft_week_${selectedWeekNumber}`);
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

  const getTypeAccentColor = (type: string) => {
    switch (type) {
      case 'plan': return 'purple';
      case 'funnel': return 'pink';
      default: return 'slate';
    }
  };

  // 전체 필드 수 계산
  const totalFieldCount = weekFieldGroups.reduce((sum, g) => sum + g.fields.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error && selectedWeekNumber === null && step === 'select-week') {
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
          onClick={() => { setStep('select-week'); setSelectedWeekNumber(null); setSubmitMode(null); }}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            step === 'select-week'
              ? 'bg-purple-600 text-white'
              : selectedWeekNumber !== null ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30' : 'bg-slate-700 text-slate-400'
          }`}
        >
          1. 주차 선택
        </button>
        <span className="text-slate-600">&rarr;</span>
        <button
          onClick={() => { if (selectedWeekNumber !== null) { setStep('select-mode'); setSubmitMode(null); } }}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            step === 'select-mode'
              ? 'bg-purple-600 text-white'
              : submitMode ? 'bg-purple-600/20 text-purple-400 hover:bg-purple-600/30' : 'bg-slate-700 text-slate-400'
          }`}
          disabled={selectedWeekNumber === null}
        >
          2. 제출 방법
        </button>
        <span className="text-slate-600">&rarr;</span>
        <span className={`px-3 py-1.5 rounded-full ${
          step === 'form' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-slate-400'
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

      {/* ========== STEP 1: 주차 선택 ========== */}
      {step === 'select-week' && (
        <>
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
            <p className="text-sm text-purple-300">{courseName}</p>
            <h1 className="text-2xl font-bold text-white mt-1">주차 선택</h1>
            <p className="text-slate-400 text-sm mt-2">제출할 주차를 선택하세요. 해당 주차의 모든 과제를 한번에 제출합니다.</p>
          </div>

          <div className="grid gap-4">
            {weekGroups.map(group => (
              <button
                key={group.weekNumber}
                onClick={() => handleSelectWeekNumber(group.weekNumber)}
                className="w-full text-left p-5 rounded-xl border bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/20 transition-all hover:scale-[1.01] hover:border-purple-500/40"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-bold px-3 py-1 rounded-full bg-purple-600/30 text-purple-300">
                        {group.weekNumber}주차
                      </span>
                      {!group.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-500/20 text-slate-500">
                          비활성
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {group.weeks.map(w => (
                        <div key={w.id} className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                            w.assignment_type === 'plan'
                              ? 'bg-purple-500/20 text-purple-300'
                              : w.assignment_type === 'funnel'
                              ? 'bg-pink-500/20 text-pink-300'
                              : 'bg-slate-500/20 text-slate-300'
                          }`}>
                            {getAssignmentTypeLabel(w.assignment_type)}
                          </span>
                          <span className="text-white text-sm">{w.title}</span>
                        </div>
                      ))}
                    </div>
                    {group.hasDeadline && (
                      <p className="text-xs text-slate-400 mt-2">
                        마감: {new Date(group.hasDeadline).toLocaleString('ko-KR')}
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
      {step === 'select-mode' && selectedGroup && (
        <>
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
            <p className="text-sm text-purple-300">{courseName}</p>
            <h1 className="text-2xl font-bold text-white mt-1">제출 방법 선택</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm font-bold px-3 py-1 rounded-full bg-purple-600/30 text-purple-300">
                {selectedGroup.weekNumber}주차
              </span>
              <span className="text-slate-400 text-sm">
                {selectedGroup.weeks.map(w => w.title).join(' + ')}
              </span>
            </div>
          </div>

          {loadingFields ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* 직접 입력 */}
              <button
                onClick={() => handleSelectMode('input')}
                className="group p-6 rounded-xl border-2 border-purple-500/30 bg-purple-900/10 hover:bg-purple-900/30 hover:border-purple-500/60 transition-all text-left"
              >
                <div className="w-12 h-12 bg-purple-600/20 rounded-xl flex items-center justify-center mb-4 group-hover:bg-purple-600/30 transition-colors">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-1">직접 입력</h3>
                <p className="text-sm text-slate-400">
                  항목별로 직접 내용을 작성하여 제출합니다.
                  {totalFieldCount > 0 && ` (총 ${totalFieldCount}개 항목)`}
                </p>
              </button>

              {/* 파일 첨부 */}
              <button
                onClick={() => handleSelectMode('file')}
                className="group p-6 rounded-xl border-2 border-pink-500/30 bg-pink-900/10 hover:bg-pink-900/30 hover:border-pink-500/60 transition-all text-left"
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
              &larr; 주차 선택으로
            </button>
          </div>
        </>
      )}

      {/* ========== STEP 3: 작성 & 제출 ========== */}
      {step === 'form' && selectedGroup && submitMode && (
        <>
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
            <div>
              <p className="text-sm text-purple-300">{courseName}</p>
              <h1 className="text-2xl font-bold text-white mt-1">
                {selectedGroup.weekNumber}주차 과제
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  submitMode === 'input'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-pink-500/20 text-pink-300'
                }`}>
                  {submitMode === 'input' ? '직접 입력' : '파일 첨부'}
                </span>
                {selectedGroup.weeks.map(w => (
                  <span key={w.id} className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    w.assignment_type === 'plan'
                      ? 'bg-purple-500/20 text-purple-300'
                      : w.assignment_type === 'funnel'
                      ? 'bg-pink-500/20 text-pink-300'
                      : 'bg-slate-500/20 text-slate-300'
                  }`}>
                    {w.title}
                  </span>
                ))}
              </div>
            </div>
            {selectedGroup.hasDeadline && (
              <p className="text-xs text-slate-400 mt-3">
                마감: {new Date(selectedGroup.hasDeadline).toLocaleString('ko-KR')}
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
              ) : weekFieldGroups.length > 0 ? (
                <div className="space-y-8">
                  {weekFieldGroups.map(({ week, fields }) => {
                    const accent = getTypeAccentColor(week.assignment_type);
                    return (
                      <div key={week.id}>
                        {/* 과제 유형 헤더 */}
                        {weekFieldGroups.length > 1 && (
                          <div className={`flex items-center gap-2 mb-4 pb-3 border-b ${
                            accent === 'purple' ? 'border-purple-500/30' : accent === 'pink' ? 'border-pink-500/30' : 'border-slate-500/30'
                          }`}>
                            <div className={`w-3 h-3 rounded-full ${
                              accent === 'purple' ? 'bg-purple-500' : accent === 'pink' ? 'bg-pink-500' : 'bg-slate-500'
                            }`} />
                            <h2 className="text-lg font-bold text-white">
                              {week.title}
                            </h2>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              accent === 'purple' ? 'bg-purple-500/20 text-purple-300' : accent === 'pink' ? 'bg-pink-500/20 text-pink-300' : 'bg-slate-500/20 text-slate-300'
                            }`}>
                              {getAssignmentTypeLabel(week.assignment_type)}
                            </span>
                          </div>
                        )}

                        <div className="space-y-5">
                          {fields.map((field, index) => (
                            <div
                              key={field.id}
                              className={`bg-slate-800/50 rounded-xl p-6 border ${
                                accent === 'purple' ? 'border-purple-900/30' : accent === 'pink' ? 'border-pink-900/30' : 'border-slate-700'
                              }`}
                            >
                              <div className="flex items-start gap-3 mb-3">
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                                  accent === 'purple' ? 'bg-purple-600/30 text-purple-400' : accent === 'pink' ? 'bg-pink-600/30 text-pink-400' : 'bg-slate-600/30 text-slate-400'
                                }`}>
                                  {index + 1}
                                </span>
                                <div className="flex-1">
                                  <label className="block text-white font-medium mb-1">
                                    {field.field_label}
                                    {field.is_required && <span className="text-red-400 ml-1">*</span>}
                                  </label>
                                  {field.help_text && (
                                    <p className="text-slate-400 text-sm mb-3">{field.help_text}</p>
                                  )}
                                </div>
                              </div>

                              {field.field_type === 'textarea' ? (
                                <textarea
                                  value={getFieldValue(week.id, field.field_key)}
                                  onChange={e => handleFieldChange(week.id, field.field_key, e.target.value)}
                                  placeholder={field.placeholder}
                                  rows={5}
                                  disabled={submitting}
                                  className={`w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent resize-y min-h-[120px] disabled:opacity-50 ${
                                    accent === 'purple' ? 'focus:ring-purple-500' : accent === 'pink' ? 'focus:ring-pink-500' : 'focus:ring-slate-500'
                                  }`}
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={getFieldValue(week.id, field.field_key)}
                                  onChange={e => handleFieldChange(week.id, field.field_key, e.target.value)}
                                  placeholder={field.placeholder}
                                  disabled={submitting}
                                  className={`w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-50 ${
                                    accent === 'purple' ? 'focus:ring-purple-500' : accent === 'pink' ? 'focus:ring-pink-500' : 'focus:ring-slate-500'
                                  }`}
                                />
                              )}

                              {getFieldValue(week.id, field.field_key) && (
                                <p className="text-xs text-slate-500 mt-2 text-right">
                                  {getFieldValue(week.id, field.field_key).length}자
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="bg-slate-800/50 rounded-xl p-8 border border-slate-700 text-center">
                  <p className="text-slate-400">이 주차에 대한 입력 필드가 설정되지 않았습니다.</p>
                </div>
              )}
            </>
          )}

          {/* ===== 파일 첨부 모드 ===== */}
          {submitMode === 'file' && (
            <div
              className="bg-slate-800/50 rounded-xl p-6 border border-slate-700"
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              <h3 className="text-white font-medium mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {selectedGroup.weekNumber}주차 파일 업로드
              </h3>
              <p className="text-slate-400 text-sm mb-6">
                PDF, 이미지(JPG/PNG/GIF/WebP), Word, TXT, MD 파일을 첨부할 수 있습니다. (최대 10MB, 5개까지)
              </p>

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

              {uploadedFiles.length < 5 && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.md,.doc,.docx"
                    className="hidden"
                    disabled={uploading || submitting}
                    multiple
                  />
                  <div
                    onClick={() => !uploading && !submitting && fileInputRef.current?.click()}
                    className={`flex flex-col items-center justify-center gap-3 px-4 py-10 border-2 border-dashed rounded-xl transition-all cursor-pointer w-full ${
                      isDragging
                        ? 'border-pink-500 bg-pink-500/10 text-pink-400 scale-[1.02]'
                        : uploading || submitting
                        ? 'border-slate-600 text-slate-500 opacity-50 cursor-not-allowed'
                        : 'border-slate-600 hover:border-pink-500/50 text-slate-400 hover:text-pink-400'
                    }`}
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-pink-500" />
                        <span className="text-sm">업로드 중...</span>
                      </>
                    ) : isDragging ? (
                      <>
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm font-semibold">여기에 놓으세요!</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <span className="text-sm font-medium">파일을 드래그하거나 클릭하여 선택</span>
                        <span className="text-xs text-slate-500">
                          {uploadedFiles.length > 0
                            ? `${uploadedFiles.length}/5개 첨부됨`
                            : 'PDF, 이미지, Word, TXT 등'}
                        </span>
                      </>
                    )}
                  </div>
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
                disabled={submitting}
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 text-white font-medium rounded-xl transition-opacity disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                    제출 중...
                  </>
                ) : (
                  `${selectedGroup.weekNumber}주차 과제 제출`
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
