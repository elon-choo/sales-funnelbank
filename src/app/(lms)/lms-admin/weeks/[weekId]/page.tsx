// src/app/(lms)/lms-admin/weeks/[weekId]/page.tsx
// 주차별 콘텐츠 에디터 페이지
'use client';

import { useEffect, useState, use } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface FieldConfig {
  id?: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'textarea' | 'file' | 'text';
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
}

interface WeekContent {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  description?: string;
  assignment_type: string;
  deadline?: string;
  is_active: boolean;
  content_json?: Record<string, unknown>;
  video_url?: string;
  video_title?: string;
  video_duration?: number | null;
  video_thumbnail?: string;
  video_visible?: boolean;
  materials?: string[];
}

export default function WeekEditorPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = use(params);
  const { accessToken } = useAuthStore();
  const [week, setWeek] = useState<WeekContent | null>(null);
  const [fieldConfigs, setFieldConfigs] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'content' | 'fields'>('basic');

  useEffect(() => {
    fetchWeekContent();
  }, [weekId, accessToken]);

  const fetchWeekContent = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`/api/lms/weeks/${weekId}/content`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('주차 정보를 불러오는데 실패했습니다');

      const result = await response.json();
      if (result.success) {
        setWeek(result.data.week);
        setFieldConfigs(result.data.fieldConfigs.map((fc: Record<string, unknown>) => ({
          id: fc.id,
          fieldKey: fc.field_key,
          fieldLabel: fc.field_label,
          fieldType: fc.field_type,
          placeholder: fc.placeholder,
          helpText: fc.help_text,
          isRequired: fc.is_required,
        })));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const saveWeekContent = async () => {
    if (!accessToken || !week) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/lms/weeks/${weekId}/content`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: week.title,
          description: week.description,
          assignmentType: week.assignment_type,
          deadline: week.deadline,
          isActive: week.is_active,
          contentJson: week.content_json,
          videoUrl: week.video_url,
          videoTitle: week.video_title,
          videoDuration: week.video_duration,
          videoThumbnail: week.video_thumbnail,
          videoVisible: week.video_visible,
          materials: week.materials,
          fieldConfigs,
        }),
      });

      if (!response.ok) throw new Error('저장에 실패했습니다');

      const result = await response.json();
      if (result.success) {
        setSuccess('저장되었습니다');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const addField = () => {
    setFieldConfigs([
      ...fieldConfigs,
      {
        fieldKey: `field_${Date.now()}`,
        fieldLabel: '새 필드',
        fieldType: 'textarea',
        isRequired: true,
      },
    ]);
  };

  const updateField = (index: number, updates: Partial<FieldConfig>) => {
    const newConfigs = [...fieldConfigs];
    newConfigs[index] = { ...newConfigs[index], ...updates };
    setFieldConfigs(newConfigs);
  };

  const removeField = (index: number) => {
    setFieldConfigs(fieldConfigs.filter((_, i) => i !== index));
  };

  const moveField = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fieldConfigs.length) return;

    const newConfigs = [...fieldConfigs];
    [newConfigs[index], newConfigs[newIndex]] = [newConfigs[newIndex], newConfigs[index]];
    setFieldConfigs(newConfigs);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  if (!week) {
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 text-center">
        <p className="text-red-400">주차 정보를 찾을 수 없습니다</p>
        <Link href="/lms-admin/courses" className="mt-4 inline-block px-4 py-2 bg-slate-700 text-white rounded-lg">
          기수 관리로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-400 mb-1">
            <Link href="/lms-admin/courses" className="hover:text-white">기수 관리</Link>
            <span>/</span>
            <span>{week.week_number}주차</span>
          </div>
          <h1 className="text-2xl font-bold text-white">{week.title}</h1>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={week.is_active}
              onChange={(e) => setWeek({ ...week, is_active: e.target.checked })}
              className="w-4 h-4 rounded border-slate-600 bg-slate-900 text-amber-500 focus:ring-amber-500"
            />
            <span className="text-slate-400">활성화</span>
          </label>
          <button
            onClick={saveWeekContent}
            disabled={saving}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>
      )}
      {success && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 text-green-400">{success}</div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {[
          { id: 'basic', label: '기본 정보' },
          { id: 'content', label: '콘텐츠' },
          { id: 'fields', label: '과제 필드' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'basic' | 'content' | 'fields')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] ${
              activeTab === tab.id
                ? 'text-amber-400 border-amber-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
        {activeTab === 'basic' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">주차 제목</label>
              <input
                type="text"
                value={week.title}
                onChange={(e) => setWeek({ ...week, title: e.target.value })}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">설명</label>
              <textarea
                value={week.description || ''}
                onChange={(e) => setWeek({ ...week, description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">과제 타입</label>
                <select
                  value={week.assignment_type}
                  onChange={(e) => setWeek({ ...week, assignment_type: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="plan">세일즈 플랜</option>
                  <option value="funnel">퍼널 설계</option>
                  <option value="free">자유 형식</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">마감일</label>
                <input
                  type="datetime-local"
                  value={week.deadline ? week.deadline.slice(0, 16) : ''}
                  onChange={(e) => setWeek({ ...week, deadline: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'content' && (
          <div className="space-y-6">
            {/* Video/Lesson Section - Link to Videos Page */}
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 space-y-3">
              <h3 className="text-sm font-semibold text-amber-400 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                강의 영상 (레슨)
              </h3>
              <p className="text-sm text-slate-400">
                이 주차의 레슨(영상)은 영상 관리 페이지에서 관리합니다.<br />
                주차별로 여러 개의 레슨을 추가하고, 순서/공개 여부를 설정할 수 있습니다.
              </p>
              <Link
                href="/lms-admin/videos"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                영상 관리 페이지로 이동
              </Link>
            </div>

            {/* Markdown Content */}
            <div>
              <label className="block text-sm font-medium text-white mb-2">학습 자료 (Markdown)</label>
              <textarea
                value={week.content_json?.markdown as string || ''}
                onChange={(e) => setWeek({
                  ...week,
                  content_json: { ...week.content_json, markdown: e.target.value },
                })}
                rows={15}
                placeholder="# 이번 주 학습 목표&#10;&#10;- 목표 1&#10;- 목표 2&#10;&#10;## 핵심 내용&#10;..."
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
              />
            </div>
          </div>
        )}

        {activeTab === 'fields' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">과제 제출 시 수강생이 입력할 필드를 정의합니다.</p>
              <button
                onClick={addField}
                className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                필드 추가
              </button>
            </div>

            <div className="space-y-4">
              {fieldConfigs.map((field, index) => (
                <div key={field.id || index} className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => moveField(index, 'up')}
                        disabled={index === 0}
                        className="p-1 text-slate-500 hover:text-white disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => moveField(index, 'down')}
                        disabled={index === fieldConfigs.length - 1}
                        className="p-1 text-slate-500 hover:text-white disabled:opacity-30"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">필드 라벨</label>
                        <input
                          type="text"
                          value={field.fieldLabel}
                          onChange={(e) => updateField(index, { fieldLabel: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">필드 타입</label>
                        <select
                          value={field.fieldType}
                          onChange={(e) => updateField(index, { fieldType: e.target.value as 'textarea' | 'file' | 'text' })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          <option value="textarea">긴 텍스트</option>
                          <option value="text">짧은 텍스트</option>
                          <option value="file">파일 업로드</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">플레이스홀더</label>
                        <input
                          type="text"
                          value={field.placeholder || ''}
                          onChange={(e) => updateField(index, { placeholder: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <label className="flex items-center gap-2 text-sm text-slate-400">
                          <input
                            type="checkbox"
                            checked={field.isRequired}
                            onChange={(e) => updateField(index, { isRequired: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500"
                          />
                          필수
                        </label>
                        <button
                          onClick={() => removeField(index)}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {fieldConfigs.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  과제 필드가 없습니다. '필드 추가' 버튼을 클릭하여 추가하세요.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
