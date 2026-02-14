// src/app/(lms)/lms-admin/settings/page.tsx
// AI 피드백 설정 - 모델/프롬프트(주차별 버전관리)/평가기준/RAG관리
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface ScoringCriteria {
  name: string;
  weight: number;
  description: string;
}

interface AISettings {
  ai_default_model: string;
  ai_premium_model: string;
  ai_monthly_budget: number;
  ai_feedback_prompt_template: string;
  ai_scoring_criteria: Record<string, ScoringCriteria>;
  ai_tone: string;
  ai_language: string;
  ai_max_tokens: number;
  ai_temperature: number;
  premium_user_ids: string[];
}

interface PromptVersion {
  id: string;
  week_key: string;
  version: number;
  content: string;
  is_active: boolean;
  change_note: string;
  created_at: string;
}

interface RagDataset {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  chunk_count: number;
  version: number;
  is_active: boolean;
  status: string;
  created_at: string;
}

const AVAILABLE_MODELS = [
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 ($5/$15 per 1M)' },
  { value: 'gemini-3-pro-preview', label: 'Gemini 3.0 Pro ($2/$10 per 1M)' },
  { value: 'gpt-5.1', label: 'GPT 5.1 ($2/$8 per 1M)' },
  { value: 'gemini-3-flash-preview', label: 'Gemini 3.0 Flash ($0.15/$0.60 per 1M)' },
];

const WEEK_KEYS = [
  { key: 'week1', label: '1주차' },
  { key: 'week2', label: '2주차' },
  { key: 'week3', label: '3주차' },
  { key: 'week4', label: '4주차' },
];

type TabId = 'model' | 'prompt' | 'rag';

export default function AISettingsPage() {
  const { accessToken } = useAuthStore();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('model');

  // Prompt state
  const [promptVersions, setPromptVersions] = useState<Record<string, PromptVersion[]>>({});
  const [selectedWeekKey, setSelectedWeekKey] = useState('week1');
  const [promptContent, setPromptContent] = useState('');
  const [promptNote, setPromptNote] = useState('');
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptLoading, setPromptLoading] = useState(false);

  // RAG state
  const [ragDatasets, setRagDatasets] = useState<RagDataset[]>([]);
  const [ragLoading, setRagLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [ragWeekFilter, setRagWeekFilter] = useState<string>('all');
  const [ragUploadWeek, setRagUploadWeek] = useState<string>('all');

  useEffect(() => {
    fetchSettings();
  }, [accessToken]);

  const fetchSettings = async () => {
    if (!accessToken) return;
    try {
      const response = await fetch('/api/lms/settings', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      if (!response.ok) throw new Error('설정을 불러오는데 실패했습니다');
      const result = await response.json();
      if (result.success) setSettings(result.data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!accessToken || !settings) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/lms/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ settings }),
      });
      if (!response.ok) throw new Error('설정 저장에 실패했습니다');
      const result = await response.json();
      if (result.success) {
        setSuccess('설정이 저장되었습니다');
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof AISettings>(key: K, value: AISettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  const updateScoringCriteria = (key: string, field: keyof ScoringCriteria, value: string | number) => {
    if (!settings) return;
    setSettings({
      ...settings,
      ai_scoring_criteria: {
        ...settings.ai_scoring_criteria,
        [key]: { ...settings.ai_scoring_criteria[key], [field]: value },
      },
    });
  };

  // === Prompt Functions ===
  const fetchPrompts = useCallback(async () => {
    if (!accessToken) return;
    setPromptLoading(true);
    try {
      const res = await fetch('/api/lms/admin/prompts', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await res.json();
      if (result.success) {
        setPromptVersions(result.data.prompts || {});
        // Load active prompt content for selected week
        const weekVersions = result.data.prompts[selectedWeekKey] || [];
        const active = weekVersions.find((v: PromptVersion) => v.is_active);
        if (active) setPromptContent(active.content);
      }
    } catch { /* ignore */ } finally {
      setPromptLoading(false);
    }
  }, [accessToken, selectedWeekKey]);

  useEffect(() => {
    if (activeTab === 'prompt') fetchPrompts();
  }, [activeTab, fetchPrompts]);

  useEffect(() => {
    const weekVersions = promptVersions[selectedWeekKey] || [];
    const active = weekVersions.find(v => v.is_active);
    if (active) setPromptContent(active.content);
    else setPromptContent('');
  }, [selectedWeekKey, promptVersions]);

  const savePrompt = async () => {
    if (!accessToken || !promptContent.trim()) return;
    setPromptSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/lms/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          weekKey: selectedWeekKey,
          content: promptContent,
          changeNote: promptNote || undefined,
        }),
      });
      const result = await res.json();
      if (result.success) {
        setSuccess(`${selectedWeekKey} 프롬프트 v${result.data.prompt.version} 저장됨`);
        setPromptNote('');
        fetchPrompts();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(result.error?.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setPromptSaving(false);
    }
  };

  const activateVersion = async (versionId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/lms/admin/prompts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ weekKey: selectedWeekKey, versionId }),
      });
      const result = await res.json();
      if (result.success) {
        setSuccess(`v${result.data.activatedVersion} 활성화됨`);
        fetchPrompts();
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch { /* ignore */ }
  };

  // === RAG Functions ===
  const fetchRagDatasets = useCallback(async () => {
    if (!accessToken) return;
    setRagLoading(true);
    try {
      const res = await fetch('/api/lms/rag', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await res.json();
      if (result.success) setRagDatasets(result.data.datasets || []);
    } catch { /* ignore */ } finally {
      setRagLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (activeTab === 'rag') fetchRagDatasets();
  }, [activeTab, fetchRagDatasets]);

  const handleRagUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !accessToken) return;

    const allowedTypes = ['.jsonl', '.json', '.txt', '.md', '.csv'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(ext)) {
      setError(`지원하지 않는 파일 형식입니다. (${allowedTypes.join(', ')})`);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const text = await file.text();
      // Map week key to actual week_id from course_weeks
      const weekIdMap: Record<string, string> = {
        'week1_biz': '039aae79-7c19-4cdd-a193-405ad33d95f3',
        'week1_funnel': '4bfae65c-d195-44b3-a5c2-fa9b96987f56',
        'week2': 'b8c4e2a1-3d5f-4a7b-9c1e-2f8d6a4b3c5e',
      };
      const weekId = ragUploadWeek !== 'all' ? weekIdMap[ragUploadWeek] || undefined : undefined;

      const res = await fetch('/api/lms/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: file.name.replace(/\.[^.]+$/, ''),
          content: text,
          fileType: ext,
          fileSize: file.size,
          weekId,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const emb = result.data.embeddingsCreated || 0;
        setSuccess(`${file.name} 업로드 완료 (${result.data.chunksCreated} chunks, ${emb} embeddings${weekId ? ', 주차 매핑됨' : ''})`);
        fetchRagDatasets();
        setTimeout(() => setSuccess(null), 5000);
      } else {
        throw new Error(result.error?.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '업로드 실패');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const currentVersions = promptVersions[selectedWeekKey] || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI 피드백 설정</h1>
          <p className="text-slate-400">AI 모델, 프롬프트, 평가 기준, RAG 데이터를 관리합니다</p>
        </div>
        {activeTab === 'model' && (
          <button
            onClick={saveSettings}
            disabled={saving}
            className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white" /> 저장 중...</>
            ) : (
              <><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> 설정 저장</>
            )}
          </button>
        )}
      </div>

      {/* Alerts */}
      {error && <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>}
      {success && <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 text-green-400">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 overflow-x-auto">
        {([
          { id: 'model', label: 'AI 모델 설정' },
          { id: 'prompt', label: '프롬프트 템플릿' },
          { id: 'rag', label: 'RAG 데이터 관리' },
        ] as { id: TabId; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${
              activeTab === tab.id ? 'text-amber-400 border-amber-400' : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ========== MODEL TAB ========== */}
      {settings && activeTab === 'model' && (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 space-y-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">기본 AI 모델</label>
            <select value={settings.ai_default_model} onChange={(e) => updateSetting('ai_default_model', e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500">
              {AVAILABLE_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">프리미엄 AI 모델</label>
            <select value={settings.ai_premium_model} onChange={(e) => updateSetting('ai_premium_model', e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500">
              {AVAILABLE_MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-white mb-2">월간 예산 (USD)</label>
              <input type="number" value={settings.ai_monthly_budget} onChange={(e) => updateSetting('ai_monthly_budget', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-2">최대 토큰 수</label>
              <input type="number" value={settings.ai_max_tokens} onChange={(e) => updateSetting('ai_max_tokens', Number(e.target.value))} className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-amber-500" />
            </div>
          </div>
        </div>
      )}

      {/* ========== PROMPT TAB ========== */}
      {activeTab === 'prompt' && (
        <div className="space-y-4">
          {/* Week Selector */}
          <div className="flex items-center gap-2">
            {WEEK_KEYS.map((w) => {
              const versions = promptVersions[w.key] || [];
              const hasContent = versions.length > 0;
              return (
                <button
                  key={w.key}
                  onClick={() => setSelectedWeekKey(w.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
                    selectedWeekKey === w.key
                      ? 'bg-amber-600 text-white'
                      : hasContent
                      ? 'bg-slate-700 text-white hover:bg-slate-600'
                      : 'bg-slate-800 text-slate-500 hover:bg-slate-700'
                  }`}
                >
                  {w.label}
                  {hasContent && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Editor */}
            <div className="lg:col-span-2 bg-slate-800/50 rounded-xl border border-slate-700 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-medium">{selectedWeekKey} 시스템 프롬프트</h3>
                <span className="text-xs text-slate-500">
                  {promptContent.length.toLocaleString()}자
                </span>
              </div>
              <textarea
                value={promptContent}
                onChange={(e) => setPromptContent(e.target.value)}
                rows={20}
                placeholder={`${selectedWeekKey}에 사용할 시스템 프롬프트를 입력하세요...`}
                className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 resize-y min-h-[400px]"
              />
              <div className="flex items-center gap-3">
                <input
                  value={promptNote}
                  onChange={(e) => setPromptNote(e.target.value)}
                  placeholder="변경 사유 (선택)"
                  className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={savePrompt}
                  disabled={promptSaving || !promptContent.trim()}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {promptSaving ? (
                    <><div className="animate-spin rounded-full h-3 w-3 border-t-2 border-white" /> 저장 중</>
                  ) : '새 버전 저장'}
                </button>
              </div>
            </div>

            {/* Version History */}
            <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-4">
              <h3 className="text-white font-medium mb-3">버전 히스토리</h3>
              {promptLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-amber-500" />
                </div>
              ) : currentVersions.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8">아직 저장된 프롬프트가 없습니다</p>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {currentVersions.map((v) => (
                    <div
                      key={v.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        v.is_active
                          ? 'border-amber-500/50 bg-amber-900/20'
                          : 'border-slate-700 hover:border-slate-600 bg-slate-900/30'
                      }`}
                      onClick={() => {
                        setPromptContent(v.content);
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-white">v{v.version}</span>
                        <div className="flex items-center gap-2">
                          {v.is_active ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-600/30 text-amber-300">활성</span>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); activateVersion(v.id); }}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 hover:bg-slate-600 hover:text-white"
                            >
                              활성화
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(v.created_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {v.change_note && (
                        <p className="text-xs text-slate-400 mt-1 truncate">{v.change_note}</p>
                      )}
                      <p className="text-[10px] text-slate-600 mt-1">{v.content.length.toLocaleString()}자</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== RAG TAB ========== */}
      {activeTab === 'rag' && (
        <div className="space-y-4">
          {/* Upload */}
          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
            <h3 className="text-white font-medium mb-3">벡터 데이터셋 업로드</h3>
            <p className="text-sm text-slate-400 mb-3">파일 업로드 → 자동 청크 분할 → OpenAI 임베딩 생성 → pgvector DB 저장</p>

            {/* Week selection for upload */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-slate-400">매핑 주차:</span>
              {[
                { key: 'all', label: '전체 (공용)' },
                { key: 'week1_biz', label: '1주차 기획서' },
                { key: 'week1_funnel', label: '1주차 퍼널' },
                { key: 'week2', label: '2주차' },
              ].map(w => (
                <button
                  key={w.key}
                  onClick={() => setRagUploadWeek(w.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    ragUploadWeek === w.key
                      ? 'bg-amber-600 text-white'
                      : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
            <label className={`flex flex-col items-center justify-center gap-3 px-4 py-8 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
              uploading ? 'border-slate-600 opacity-50' : 'border-slate-600 hover:border-amber-500/50 hover:bg-amber-500/5'
            }`}>
              <input
                type="file"
                accept=".jsonl,.json,.txt,.md,.csv"
                onChange={handleRagUpload}
                disabled={uploading}
                className="hidden"
              />
              {uploading ? (
                <><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-amber-500" /><span className="text-sm text-slate-400">업로드 중...</span></>
              ) : (
                <>
                  <svg className="w-10 h-10 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm text-slate-400">파일을 클릭하여 선택</span>
                  <span className="text-xs text-slate-600">JSONL, JSON, TXT, MD, CSV (최대 10MB)</span>
                </>
              )}
            </label>
          </div>

          {/* Dataset List */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-white font-medium">등록된 데이터셋 ({ragDatasets.length})</h3>
              <button onClick={fetchRagDatasets} className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-700 hover:bg-slate-600">
                새로고침
              </button>
            </div>
            {ragLoading ? (
              <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-6 w-6 border-t-2 border-amber-500" /></div>
            ) : ragDatasets.length === 0 ? (
              <div className="text-center py-8 text-slate-500">등록된 데이터셋이 없습니다</div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {ragDatasets.map((ds) => (
                  <div key={ds.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-700/20">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ds.is_active ? 'bg-green-500' : 'bg-slate-600'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{ds.name}</p>
                        <p className="text-xs text-slate-500">
                          {ds.chunk_count} chunks · v{ds.version} · {ds.file_size ? `${(ds.file_size / 1024).toFixed(1)}KB` : '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${ds.is_active ? 'bg-green-600/20 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                        {ds.is_active ? '활성' : '비활성'}
                      </span>
                      <span className="text-xs text-slate-600">
                        {new Date(ds.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
