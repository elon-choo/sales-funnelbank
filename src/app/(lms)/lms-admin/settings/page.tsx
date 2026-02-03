// src/app/(lms)/lms-admin/settings/page.tsx
// AI 피드백 설정 관리 페이지
'use client';

import { useEffect, useState } from 'react';
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

const AVAILABLE_MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 ($0.27/피드백)', tier: 'default' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5 ($1.35/피드백)', tier: 'premium' },
  { value: 'gpt-4o', label: 'GPT-4o ($0.40/피드백)', tier: 'default' },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash ($0.08/피드백)', tier: 'default' },
];

const TONE_OPTIONS = [
  { value: 'professional', label: '전문적' },
  { value: 'friendly', label: '친근한' },
  { value: 'encouraging', label: '격려하는' },
  { value: 'strict', label: '엄격한' },
];

export default function AISettingsPage() {
  const { accessToken } = useAuthStore();
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'model' | 'prompt' | 'scoring' | 'premium'>('model');
  const [newPremiumUserId, setNewPremiumUserId] = useState('');

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
      if (result.success) {
        setSettings(result.data.settings);
      }
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
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
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
        [key]: {
          ...settings.ai_scoring_criteria[key],
          [field]: value,
        },
      },
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI 피드백 설정</h1>
          <p className="text-slate-400">AI 모델, 프롬프트, 평가 기준을 커스터마이징합니다</p>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="px-6 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              저장 중...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              설정 저장
            </>
          )}
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4 text-green-400">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700 overflow-x-auto">
        {[
          { id: 'model', label: 'AI 모델 설정' },
          { id: 'prompt', label: '프롬프트 템플릿' },
          { id: 'scoring', label: '평가 기준' },
          { id: 'premium', label: '프리미엄 사용자' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as 'model' | 'prompt' | 'scoring' | 'premium')}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-[1px] whitespace-nowrap ${
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
      {settings && (
        <div className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700">
          {activeTab === 'model' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-white mb-2">기본 AI 모델</label>
                <select
                  value={settings.ai_default_model}
                  onChange={(e) => updateSetting('ai_default_model', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {AVAILABLE_MODELS.filter((m) => m.tier === 'default').map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-slate-400">일반 피드백 생성에 사용되는 모델</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">프리미엄 AI 모델</label>
                <select
                  value={settings.ai_premium_model}
                  onChange={(e) => updateSetting('ai_premium_model', e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  {AVAILABLE_MODELS.map((model) => (
                    <option key={model.value} value={model.value}>{model.label}</option>
                  ))}
                </select>
                <p className="mt-1 text-sm text-slate-400">고품질 피드백 요청 시 사용되는 모델</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">월간 예산 (USD)</label>
                  <input
                    type="number"
                    value={settings.ai_monthly_budget}
                    onChange={(e) => updateSetting('ai_monthly_budget', Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">최대 토큰 수</label>
                  <input
                    type="number"
                    value={settings.ai_max_tokens}
                    onChange={(e) => updateSetting('ai_max_tokens', Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">피드백 톤</label>
                  <select
                    value={settings.ai_tone}
                    onChange={(e) => updateSetting('ai_tone', e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {TONE_OPTIONS.map((tone) => (
                      <option key={tone.value} value={tone.value}>{tone.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Temperature ({settings.ai_temperature})</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={settings.ai_temperature}
                    onChange={(e) => updateSetting('ai_temperature', Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>정확한 (0)</span>
                    <span>창의적 (1)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prompt' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">피드백 프롬프트 템플릿</label>
                <textarea
                  value={settings.ai_feedback_prompt_template}
                  onChange={(e) => updateSetting('ai_feedback_prompt_template', e.target.value)}
                  rows={20}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-sm"
                />
                <p className="mt-2 text-sm text-slate-400">
                  Markdown 형식을 사용할 수 있습니다. 변수: {'{student_name}'}, {'{week_number}'}, {'{assignment_content}'}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'scoring' && (
            <div className="space-y-6">
              <p className="text-sm text-slate-400">
                각 평가 기준의 가중치 합이 100%가 되도록 설정해주세요.
              </p>

              {Object.entries(settings.ai_scoring_criteria).map(([key, criteria]) => (
                <div key={key} className="p-4 bg-slate-900/50 rounded-xl border border-slate-700">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">기준명</label>
                      <input
                        type="text"
                        value={criteria.name}
                        onChange={(e) => updateScoringCriteria(key, 'name', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">가중치 (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={criteria.weight}
                        onChange={(e) => updateScoringCriteria(key, 'weight', Number(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">설명</label>
                      <input
                        type="text"
                        value={criteria.description}
                        onChange={(e) => updateScoringCriteria(key, 'description', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl">
                <span className="text-slate-400">총 가중치</span>
                <span className={`text-lg font-bold ${
                  Object.values(settings.ai_scoring_criteria).reduce((sum, c) => sum + c.weight, 0) === 100
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}>
                  {Object.values(settings.ai_scoring_criteria).reduce((sum, c) => sum + c.weight, 0)}%
                </span>
              </div>
            </div>
          )}

          {activeTab === 'premium' && (
            <div className="space-y-6">
              <div>
                <p className="text-sm text-slate-400 mb-4">
                  프리미엄 사용자는 고품질 AI 모델(Opus 4.5)을 사용하여 피드백을 받습니다.
                  사용자 ID를 추가하여 프리미엄 혜택을 부여하세요.
                </p>

                {/* Add Premium User */}
                <div className="flex gap-3 mb-6">
                  <input
                    type="text"
                    value={newPremiumUserId}
                    onChange={(e) => setNewPremiumUserId(e.target.value)}
                    placeholder="사용자 ID (UUID)"
                    className="flex-1 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    onClick={() => {
                      if (newPremiumUserId && !settings.premium_user_ids?.includes(newPremiumUserId)) {
                        updateSetting('premium_user_ids', [...(settings.premium_user_ids || []), newPremiumUserId]);
                        setNewPremiumUserId('');
                      }
                    }}
                    className="px-6 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-colors"
                  >
                    추가
                  </button>
                </div>

                {/* Premium Users List */}
                <div className="space-y-2">
                  {(settings.premium_user_ids || []).length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      등록된 프리미엄 사용자가 없습니다
                    </div>
                  ) : (
                    (settings.premium_user_ids || []).map((userId, index) => (
                      <div
                        key={userId}
                        className="flex items-center justify-between p-4 bg-slate-900/50 rounded-xl border border-slate-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-mono text-sm">{userId}</p>
                            <p className="text-xs text-slate-500">프리미엄 사용자 #{index + 1}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            updateSetting(
                              'premium_user_ids',
                              (settings.premium_user_ids || []).filter((id) => id !== userId)
                            );
                          }}
                          className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Summary */}
                <div className="flex items-center justify-between p-4 bg-slate-900/30 rounded-xl mt-6">
                  <span className="text-slate-400">총 프리미엄 사용자</span>
                  <span className="text-lg font-bold text-amber-400">
                    {(settings.premium_user_ids || []).length}명
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
