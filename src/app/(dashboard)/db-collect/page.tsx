// src/app/(dashboard)/db-collect/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { Icons } from '@/components/icons';
import { useAuthStore } from '@/stores/authStore';

interface FormConfig {
  id: string;
  name: string;
  googleFormUrl: string;
  ctaText: string;
  ctaStyle: 'primary' | 'secondary' | 'gradient';
  position: 'hero' | 'floating' | 'bottom';
  createdAt: string;
  clickCount: number;
}

export default function DBCollectPage() {
  const { user } = useAuthStore();
  const [forms, setForms] = useState<FormConfig[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [newForm, setNewForm] = useState<{
    name: string;
    googleFormUrl: string;
    ctaText: string;
    ctaStyle: 'primary' | 'secondary' | 'gradient';
    position: 'hero' | 'floating' | 'bottom';
  }>({
    name: '',
    googleFormUrl: '',
    ctaText: '무료 상담 신청하기',
    ctaStyle: 'gradient',
    position: 'hero',
  });
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load saved forms from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('magnetic-sales-forms');
    if (saved) {
      setForms(JSON.parse(saved));
    }
  }, []);

  // Save forms to localStorage
  const saveForms = (updatedForms: FormConfig[]) => {
    setForms(updatedForms);
    localStorage.setItem('magnetic-sales-forms', JSON.stringify(updatedForms));
  };

  const validateGoogleFormUrl = (url: string): boolean => {
    return url.includes('docs.google.com/forms') || url.includes('forms.gle');
  };

  const handleCreateForm = () => {
    if (!newForm.name || !newForm.googleFormUrl) {
      alert('이름과 Google Form URL을 입력해주세요.');
      return;
    }

    if (!validateGoogleFormUrl(newForm.googleFormUrl)) {
      alert('유효한 Google Form URL을 입력해주세요.');
      return;
    }

    const formConfig: FormConfig = {
      id: crypto.randomUUID(),
      ...newForm,
      createdAt: new Date().toISOString(),
      clickCount: 0,
    };

    saveForms([...forms, formConfig]);
    setNewForm({
      name: '',
      googleFormUrl: '',
      ctaText: '무료 상담 신청하기',
      ctaStyle: 'gradient',
      position: 'hero',
    });
    setIsCreating(false);
  };

  const handleDeleteForm = (id: string) => {
    if (confirm('이 폼을 삭제하시겠습니까?')) {
      saveForms(forms.filter(f => f.id !== id));
    }
  };

  const generateEmbedCode = (form: FormConfig): string => {
    const buttonStyles = {
      primary: `background:#8B5CF6;color:white;padding:16px 32px;border-radius:8px;font-weight:bold;font-size:18px;border:none;cursor:pointer;transition:all 0.3s;`,
      secondary: `background:transparent;color:#8B5CF6;padding:16px 32px;border-radius:8px;font-weight:bold;font-size:18px;border:2px solid #8B5CF6;cursor:pointer;transition:all 0.3s;`,
      gradient: `background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:white;padding:16px 32px;border-radius:50px;font-weight:bold;font-size:18px;border:none;cursor:pointer;transition:all 0.3s;box-shadow:0 10px 30px rgba(102,126,234,0.4);`,
    };

    const positionStyles = {
      hero: '',
      floating: `position:fixed;bottom:20px;right:20px;z-index:9999;`,
      bottom: `position:fixed;bottom:0;left:0;right:0;padding:16px;background:rgba(0,0,0,0.9);text-align:center;z-index:9999;`,
    };

    return `<!-- Magnetic Sales CTA Button -->
<div id="ms-cta-${form.id}" style="${positionStyles[form.position]}">
  <a href="${form.googleFormUrl}" target="_blank" rel="noopener" style="${buttonStyles[form.ctaStyle]}" onclick="if(typeof gtag!=='undefined'){gtag('event','cta_click',{form_id:'${form.id}',form_name:'${form.name}'});}">${form.ctaText}</a>
</div>
<script>(function(){var btn=document.querySelector('#ms-cta-${form.id} a');if(btn){btn.onmouseover=function(){this.style.transform='scale(1.05)';};btn.onmouseout=function(){this.style.transform='scale(1)';};}})();</script>`;
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const CTAPreview = ({ form }: { form: typeof newForm | FormConfig }) => {
    const buttonClasses = {
      primary: 'bg-purple-600 hover:bg-purple-700 text-white px-8 py-4 rounded-lg font-bold text-lg',
      secondary: 'bg-transparent border-2 border-purple-600 text-purple-400 hover:bg-purple-600/10 px-8 py-4 rounded-lg font-bold text-lg',
      gradient: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-8 py-4 rounded-full font-bold text-lg shadow-lg shadow-purple-500/30',
    };

    return (
      <div className={`relative bg-gray-900 rounded-xl overflow-hidden ${previewMode === 'mobile' ? 'w-[375px]' : 'w-full'} h-[400px]`}>
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-gray-900 flex flex-col items-center justify-center p-8">
          <h2 className="text-2xl font-bold text-white mb-4 text-center">당신의 랜딩페이지</h2>
          <p className="text-gray-400 text-center mb-8">여기에 CTA 버튼이 표시됩니다</p>

          <div className={`${form.position === 'hero' ? '' : 'absolute'} ${
            form.position === 'floating' ? 'bottom-4 right-4' :
            form.position === 'bottom' ? 'bottom-0 left-0 right-0 bg-black/80 p-4 flex justify-center' : ''
          }`}>
            <button className={`${buttonClasses[form.ctaStyle]} transition-all transform hover:scale-105`}>
              {form.ctaText || '무료 상담 신청하기'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">DB 수집</h1>
            <p className="text-gray-400">Google Form으로 리드를 수집하고 관리하세요</p>
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all"
          >
            <Icons.plus className="w-5 h-5" />
            새 폼 연결
          </button>
        </div>

        {/* Create Form Modal */}
        {isCreating && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-800 flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">새 Google Form 연결</h2>
                <button onClick={() => setIsCreating(false)} className="text-gray-400 hover:text-white">
                  <Icons.x className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 grid lg:grid-cols-2 gap-6">
                {/* Form Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">폼 이름 *</label>
                    <input
                      type="text"
                      value={newForm.name}
                      onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                      placeholder="예: 무료 컨설팅 신청"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Google Form URL *</label>
                    <input
                      type="url"
                      value={newForm.googleFormUrl}
                      onChange={(e) => setNewForm({ ...newForm, googleFormUrl: e.target.value })}
                      placeholder="https://docs.google.com/forms/..."
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Google Forms에서 &quot;보내기&quot; → &quot;링크&quot;를 복사하세요</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">CTA 버튼 텍스트</label>
                    <input
                      type="text"
                      value={newForm.ctaText}
                      onChange={(e) => setNewForm({ ...newForm, ctaText: e.target.value })}
                      placeholder="무료 상담 신청하기"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">버튼 스타일</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['primary', 'secondary', 'gradient'] as const).map((style) => (
                        <button
                          key={style}
                          onClick={() => setNewForm({ ...newForm, ctaStyle: style })}
                          className={`p-3 rounded-lg border ${
                            newForm.ctaStyle === style
                              ? 'border-purple-500 bg-purple-500/10'
                              : 'border-gray-700 hover:border-gray-600'
                          } text-sm text-gray-300 capitalize`}
                        >
                          {style === 'primary' ? '기본' : style === 'secondary' ? '아웃라인' : '그라데이션'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">버튼 위치</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['hero', 'floating', 'bottom'] as const).map((pos) => (
                        <button
                          key={pos}
                          onClick={() => setNewForm({ ...newForm, position: pos })}
                          className={`p-3 rounded-lg border ${
                            newForm.position === pos
                              ? 'border-purple-500 bg-purple-500/10'
                              : 'border-gray-700 hover:border-gray-600'
                          } text-sm text-gray-300`}
                        >
                          {pos === 'hero' ? '히어로 섹션' : pos === 'floating' ? '플로팅' : '하단 고정'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-300">미리보기</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewMode('desktop')}
                        className={`p-2 rounded ${previewMode === 'desktop' ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                      >
                        <Icons.monitor className="w-4 h-4 text-gray-400" />
                      </button>
                      <button
                        onClick={() => setPreviewMode('mobile')}
                        className={`p-2 rounded ${previewMode === 'mobile' ? 'bg-gray-700' : 'hover:bg-gray-800'}`}
                      >
                        <Icons.smartphone className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <CTAPreview form={newForm} />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-800 flex justify-end gap-3">
                <button
                  onClick={() => setIsCreating(false)}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleCreateForm}
                  className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Forms List */}
        {forms.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-800 flex items-center justify-center">
              <Icons.database className="w-10 h-10 text-gray-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-400 mb-2">연결된 폼이 없습니다</h3>
            <p className="text-gray-500 mb-6">Google Form을 연결하여 리드 수집을 시작하세요</p>
            <button
              onClick={() => setIsCreating(true)}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-500 hover:to-pink-500 transition-all"
            >
              첫 폼 연결하기
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {forms.map((form) => (
              <div key={form.id} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors">
                <div className="h-40 bg-gradient-to-br from-purple-900/30 to-gray-900 relative flex items-center justify-center">
                  <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                    form.ctaStyle === 'gradient'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                      : form.ctaStyle === 'primary'
                      ? 'bg-purple-600 text-white'
                      : 'border-2 border-purple-600 text-purple-400'
                  }`}>
                    {form.ctaText}
                  </span>
                  <span className={`absolute text-xs text-gray-500 ${
                    form.position === 'floating' ? 'bottom-2 right-2' :
                    form.position === 'bottom' ? 'bottom-0 left-0 right-0 bg-black/50 py-1 text-center' :
                    'top-2 left-2'
                  }`}>
                    {form.position === 'hero' ? '히어로 섹션' : form.position === 'floating' ? '플로팅' : '하단 고정'}
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-semibold text-white mb-1">{form.name}</h3>
                  <p className="text-sm text-gray-500 truncate mb-3">{form.googleFormUrl}</p>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">
                      클릭: <span className="text-purple-400 font-semibold">{form.clickCount}</span>
                    </span>
                    <span className="text-gray-500">
                      {new Date(form.createdAt).toLocaleDateString('ko-KR')}
                    </span>
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-800 flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(generateEmbedCode(form), form.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors"
                    >
                      {copiedId === form.id ? (
                        <>
                          <Icons.check className="w-4 h-4 text-green-400" />
                          복사됨!
                        </>
                      ) : (
                        <>
                          <Icons.copy className="w-4 h-4" />
                          코드 복사
                        </>
                      )}
                    </button>
                    <a
                      href={form.googleFormUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      <Icons.externalLink className="w-4 h-4 text-gray-400" />
                    </a>
                    <button
                      onClick={() => handleDeleteForm(form.id)}
                      className="p-2 bg-gray-800 hover:bg-red-900/50 rounded-lg transition-colors"
                    >
                      <Icons.trash className="w-4 h-4 text-gray-400 hover:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Usage Guide */}
        <div className="mt-12 bg-gray-900/50 rounded-xl border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Icons.file className="w-5 h-5 text-purple-400" />
            사용 가이드
          </h3>
          <div className="grid md:grid-cols-3 gap-6 text-sm">
            <div>
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold mb-3">1</div>
              <h4 className="font-semibold text-white mb-1">Google Form 생성</h4>
              <p className="text-gray-400">Google Forms에서 상담 신청 폼을 만들고 공유 링크를 복사하세요.</p>
            </div>
            <div>
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold mb-3">2</div>
              <h4 className="font-semibold text-white mb-1">폼 연결</h4>
              <p className="text-gray-400">위의 &quot;새 폼 연결&quot; 버튼을 클릭하고 URL과 CTA 설정을 입력하세요.</p>
            </div>
            <div>
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold mb-3">3</div>
              <h4 className="font-semibold text-white mb-1">코드 삽입</h4>
              <p className="text-gray-400">&quot;코드 복사&quot;를 클릭하고 랜딩페이지 HTML에 붙여넣으세요.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
