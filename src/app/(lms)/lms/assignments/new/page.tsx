// src/app/(lms)/lms/assignments/new/page.tsx
// 과제 제출 폼 페이지
'use client';

import { useEffect, useState } from 'react';
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
  courses?: { id: string; title: string };
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuthStore();

  const [weekInfo, setWeekInfo] = useState<WeekInfo | null>(null);
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedDraft, setSavedDraft] = useState(false);

  // 주차 및 필드 설정 로딩
  useEffect(() => {
    const loadConfig = async () => {
      if (!accessToken) return;

      try {
        // 현재 등록된 코스에서 활성 주차 가져오기
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
        const courseId = enrollment.course_id;

        // 주차 목록 조회
        const weeksRes = await fetch(`/api/lms/weeks?courseId=${courseId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const weeksData = await weeksRes.json();

        if (!weeksData.success) {
          setError('주차 정보를 불러올 수 없습니다.');
          setLoading(false);
          return;
        }

        // 활성 주차 찾기 (searchParams에 weekId가 있으면 해당 주차, 없으면 첫 번째 활성 주차)
        const weekIdParam = searchParams.get('weekId');
        const weeks = weeksData.data?.weeks || [];
        const targetWeek = weekIdParam
          ? weeks.find((w: WeekInfo) => w.id === weekIdParam)
          : weeks.find((w: WeekInfo & { is_active: boolean }) => w.is_active);

        if (!targetWeek) {
          setError('활성화된 과제 주차가 없습니다.');
          setLoading(false);
          return;
        }

        setWeekInfo({ ...targetWeek, course_id: courseId });

        // 주차별 과제 필드 설정 조회
        const configRes = await fetch(`/api/lms/weeks/${targetWeek.id}/content`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const configData = await configRes.json();

        if (configData.success && configData.data?.configs) {
          const sorted = configData.data.configs.sort(
            (a: FieldConfig, b: FieldConfig) => a.sort_order - b.sort_order
          );
          setFields(sorted);

          // localStorage에서 초안 복원
          const draftKey = `assignment_draft_${targetWeek.id}`;
          const saved = localStorage.getItem(draftKey);
          if (saved) {
            try {
              setFormData(JSON.parse(saved));
              setSavedDraft(true);
            } catch {
              // invalid draft, ignore
            }
          }
        }
      } catch (err) {
        setError('데이터 로딩 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadConfig();
  }, [accessToken, searchParams]);

  // 자동 저장 (localStorage)
  useEffect(() => {
    if (!weekInfo || Object.keys(formData).length === 0) return;
    const draftKey = `assignment_draft_${weekInfo.id}`;
    localStorage.setItem(draftKey, JSON.stringify(formData));
  }, [formData, weekInfo]);

  const handleFieldChange = (key: string, value: string) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (isDraft: boolean) => {
    if (!weekInfo || !accessToken) return;

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
        `/api/lms/assignments?courseId=${weekInfo.course_id}&weekId=${weekInfo.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            content: formData,
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
        localStorage.removeItem(`assignment_draft_${weekInfo.id}`);
      }

      // 과제 목록으로 이동
      router.push('/lms/assignments');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error && !weekInfo) {
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
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 rounded-2xl p-6 border border-purple-500/20">
        <h1 className="text-2xl font-bold text-white">
          {weekInfo?.week_number}주차 과제 제출
        </h1>
        <p className="text-slate-300 mt-1">{weekInfo?.title}</p>
        {savedDraft && (
          <span className="inline-flex items-center mt-2 px-2 py-1 rounded text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-500/30">
            자동 저장된 초안이 복원되었습니다
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Form */}
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
                disabled={submitting}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y min-h-[120px]"
              />
            ) : (
              <input
                type="text"
                value={formData[field.field_key] || ''}
                onChange={e => handleFieldChange(field.field_key, e.target.value)}
                placeholder={field.placeholder}
                disabled={submitting}
                className="w-full bg-slate-900/50 border border-slate-600 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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

      {/* Submit Buttons */}
      <div className="flex items-center justify-between pt-4 pb-8">
        <button
          onClick={() => router.push('/lms/assignments')}
          className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          disabled={submitting}
        >
          ← 돌아가기
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
            disabled={submitting}
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
    </div>
  );
}
