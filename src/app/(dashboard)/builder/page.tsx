// src/app/(dashboard)/builder/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface SectionContent {
  headline?: string;
  subheadline?: string;
  bodyText?: string;
  bulletPoints?: string[];
  ctaText?: string;
}

interface Section {
  id: string;
  type: string;
  order: number;
  content: SectionContent;
  visualPrompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

interface LandingPagePlan {
  businessInfo: {
    name: string;
    tagline: string;
  };
  sections: Section[];
  googleFormUrl?: string;
  metadata?: {
    generatedAt: string;
    userId: string;
  };
}

const SECTION_ICONS: Record<string, string> = {
  hero: '🎯',
  problem: '😰',
  solution: '💡',
  benefits: '✨',
  proof: '⭐',
  offer: '🎁',
  cta: '🚀',
  faq: '❓',
};

const SECTION_NAMES: Record<string, string> = {
  hero: '히어로',
  problem: '문제',
  solution: '솔루션',
  benefits: '혜택',
  proof: '증거',
  offer: '오퍼',
  cta: 'CTA',
  faq: 'FAQ',
};

export default function BuilderPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [plan, setPlan] = useState<LandingPagePlan | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load plan from session storage
  useEffect(() => {
    const savedPlan = sessionStorage.getItem('landingPagePlan');
    if (savedPlan) {
      try {
        setPlan(JSON.parse(savedPlan));
      } catch {
        router.push('/planner');
      }
    } else {
      router.push('/planner');
    }
  }, [router]);

  // Auto-select first section
  useEffect(() => {
    if (plan && !selectedSection) {
      setSelectedSection(plan.sections[0]?.id || null);
    }
  }, [plan, selectedSection]);

  const updateSection = useCallback((sectionId: string, updates: Partial<Section>) => {
    setPlan(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map(s =>
          s.id === sectionId ? { ...s, ...updates } : s
        ),
      };
    });
  }, []);

  const updateSectionContent = useCallback((sectionId: string, field: keyof SectionContent, value: string | string[]) => {
    setPlan(prev => {
      if (!prev) return null;
      return {
        ...prev,
        sections: prev.sections.map(s =>
          s.id === sectionId
            ? { ...s, content: { ...s.content, [field]: value } }
            : s
        ),
      };
    });
  }, []);

  const generateSectionImage = async (section: Section) => {
    updateSection(section.id, { isGenerating: true });

    try {
      const response = await fetch('/api/builder/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sectionType: section.type,
          visualPrompt: section.visualPrompt,
          aspectRatio: section.type === 'hero' ? '16:9' : '3:2',
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const { imageUrl } = await response.json();
      updateSection(section.id, { imageUrl, isGenerating: false });
    } catch (error) {
      console.error('Image generation error:', error);
      updateSection(section.id, { isGenerating: false });
      // Use placeholder on error
      updateSection(section.id, { imageUrl: `/images/placeholder-${section.type}.png` });
    }
  };

  const generateAllImages = async () => {
    if (!plan) return;

    setIsGeneratingImages(true);
    setGenerationProgress(0);

    const sectionsToGenerate = plan.sections.filter(s => !s.imageUrl);
    const total = sectionsToGenerate.length;

    for (let i = 0; i < sectionsToGenerate.length; i++) {
      await generateSectionImage(sectionsToGenerate[i]);
      setGenerationProgress(Math.round(((i + 1) / total) * 100));
    }

    setIsGeneratingImages(false);
  };

  const handleSave = async () => {
    if (!plan) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/builder/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) throw new Error('Failed to save');

      const { id, slug } = await response.json();

      // Update session storage
      sessionStorage.setItem('landingPagePlan', JSON.stringify({ ...plan, id, slug }));

      alert(`저장되었습니다! 미리보기: /p/${slug}`);
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentSection = plan?.sections.find(s => s.id === selectedSection);

  if (!plan) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Left Sidebar - Section List */}
      <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="font-bold text-white text-lg">섹션 목록</h2>
          <p className="text-sm text-gray-400 mt-1">{plan.sections.length}개 섹션</p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {plan.sections.map((section, index) => (
            <button
              key={section.id}
              onClick={() => setSelectedSection(section.id)}
              className={`w-full p-3 rounded-lg mb-2 text-left transition-all ${
                selectedSection === section.id
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{SECTION_ICONS[section.type] || '📄'}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">
                    {index + 1}. {SECTION_NAMES[section.type] || section.type}
                  </div>
                  <div className="text-xs opacity-75 truncate">
                    {section.content.headline?.substring(0, 30) || '(제목 없음)'}
                  </div>
                </div>
                {section.imageUrl && (
                  <Icons.check className="w-4 h-4 text-green-400 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Generate All Images Button */}
        <div className="p-4 border-t border-gray-700">
          <Button
            onClick={generateAllImages}
            disabled={isGeneratingImages}
            className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
          >
            {isGeneratingImages ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                {generationProgress}%
              </>
            ) : (
              <>
                <Icons.image className="w-4 h-4 mr-2" />
                전체 이미지 생성
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content - Editor */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/planner')}
              className="text-gray-400 hover:text-white"
            >
              <Icons.arrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-bold text-white">{plan.businessInfo.name}</h1>
              <p className="text-xs text-gray-400">{plan.businessInfo.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Preview Mode Toggle */}
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setPreviewMode('desktop')}
                className={`px-3 py-1 rounded ${
                  previewMode === 'desktop' ? 'bg-purple-600 text-white' : 'text-gray-400'
                }`}
              >
                <Icons.monitor className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPreviewMode('mobile')}
                className={`px-3 py-1 rounded ${
                  previewMode === 'mobile' ? 'bg-purple-600 text-white' : 'text-gray-400'
                }`}
              >
                <Icons.smartphone className="w-4 h-4" />
              </button>
            </div>

            <Button
              variant="outline"
              onClick={() => setShowPreview(!showPreview)}
              className="border-gray-600"
            >
              <Icons.eye className="w-4 h-4 mr-2" />
              미리보기
            </Button>

            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-green-600 hover:bg-green-500"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
              ) : (
                <>
                  <Icons.save className="w-4 h-4 mr-2" />
                  저장
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Section Editor */}
          <div className={`${showPreview ? 'w-1/2' : 'w-full'} overflow-y-auto p-6`}>
            {currentSection ? (
              <div className="max-w-2xl mx-auto space-y-6">
                {/* Section Header */}
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <span className="text-3xl">{SECTION_ICONS[currentSection.type]}</span>
                    {SECTION_NAMES[currentSection.type]} 섹션
                  </h2>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateSectionImage(currentSection)}
                    disabled={currentSection.isGenerating}
                    className="border-purple-500 text-purple-400"
                  >
                    {currentSection.isGenerating ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-500"></div>
                    ) : (
                      <>
                        <Icons.sparkles className="w-4 h-4 mr-2" />
                        이미지 생성
                      </>
                    )}
                  </Button>
                </div>

                {/* Image Preview */}
                {currentSection.imageUrl && (
                  <div className="relative rounded-xl overflow-hidden">
                    <img
                      src={currentSection.imageUrl}
                      alt={currentSection.content.headline || ''}
                      className="w-full h-48 object-cover"
                    />
                    <button
                      onClick={() => updateSection(currentSection.id, { imageUrl: undefined })}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-full hover:bg-red-400"
                    >
                      <Icons.x className="w-4 h-4 text-white" />
                    </button>
                  </div>
                )}

                {/* Content Fields */}
                <div className="space-y-4">
                  {/* Headline */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      헤드라인
                    </label>
                    <Input
                      value={currentSection.content.headline || ''}
                      onChange={(e) => updateSectionContent(currentSection.id, 'headline', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white"
                      placeholder="강력한 헤드라인을 입력하세요"
                    />
                  </div>

                  {/* Subheadline */}
                  {['hero', 'solution', 'cta'].includes(currentSection.type) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        서브 헤드라인
                      </label>
                      <Input
                        value={currentSection.content.subheadline || ''}
                        onChange={(e) => updateSectionContent(currentSection.id, 'subheadline', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="서브 헤드라인"
                      />
                    </div>
                  )}

                  {/* Body Text */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      본문 텍스트
                    </label>
                    <Textarea
                      value={currentSection.content.bodyText || ''}
                      onChange={(e) => updateSectionContent(currentSection.id, 'bodyText', e.target.value)}
                      className="bg-gray-800 border-gray-700 text-white min-h-[100px]"
                      placeholder="상세 설명을 입력하세요"
                    />
                  </div>

                  {/* Bullet Points */}
                  {currentSection.content.bulletPoints && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        불릿 포인트
                      </label>
                      <div className="space-y-2">
                        {currentSection.content.bulletPoints.map((point, index) => (
                          <div key={index} className="flex gap-2">
                            <Input
                              value={point}
                              onChange={(e) => {
                                const newPoints = [...(currentSection.content.bulletPoints || [])];
                                newPoints[index] = e.target.value;
                                updateSectionContent(currentSection.id, 'bulletPoints', newPoints);
                              }}
                              className="bg-gray-800 border-gray-700 text-white flex-1"
                            />
                            <button
                              onClick={() => {
                                const newPoints = currentSection.content.bulletPoints?.filter((_, i) => i !== index);
                                updateSectionContent(currentSection.id, 'bulletPoints', newPoints || []);
                              }}
                              className="p-2 text-red-400 hover:text-red-300"
                            >
                              <Icons.x className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newPoints = [...(currentSection.content.bulletPoints || []), ''];
                            updateSectionContent(currentSection.id, 'bulletPoints', newPoints);
                          }}
                          className="text-sm text-purple-400 hover:text-purple-300"
                        >
                          + 항목 추가
                        </button>
                      </div>
                    </div>
                  )}

                  {/* CTA Text */}
                  {['hero', 'cta'].includes(currentSection.type) && (
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        CTA 버튼 텍스트
                      </label>
                      <Input
                        value={currentSection.content.ctaText || ''}
                        onChange={(e) => updateSectionContent(currentSection.id, 'ctaText', e.target.value)}
                        className="bg-gray-800 border-gray-700 text-white"
                        placeholder="지금 시작하기"
                      />
                    </div>
                  )}

                  {/* Visual Prompt */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      이미지 생성 프롬프트 (영문)
                    </label>
                    <Textarea
                      value={currentSection.visualPrompt || ''}
                      onChange={(e) => updateSection(currentSection.id, { visualPrompt: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white min-h-[80px] text-sm"
                      placeholder="AI 이미지 생성을 위한 프롬프트 (영문)"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                섹션을 선택하세요
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {showPreview && (
            <div className="w-1/2 border-l border-gray-700 bg-gray-950 overflow-y-auto">
              <div
                className={`mx-auto ${
                  previewMode === 'mobile' ? 'max-w-sm' : 'max-w-full'
                }`}
              >
                <PreviewRenderer plan={plan} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Preview Renderer Component
function PreviewRenderer({ plan }: { plan: LandingPagePlan }) {
  return (
    <div className="text-white">
      {plan.sections.map(section => (
        <SectionPreview key={section.id} section={section} googleFormUrl={plan.googleFormUrl} />
      ))}
    </div>
  );
}

function SectionPreview({ section, googleFormUrl }: { section: Section; googleFormUrl?: string }) {
  const ctaUrl = googleFormUrl || '#';

  switch (section.type) {
    case 'hero':
      return (
        <section className="min-h-[60vh] bg-gradient-to-br from-purple-900 via-purple-800 to-pink-800 flex items-center relative overflow-hidden">
          {section.imageUrl && (
            <div className="absolute inset-0">
              <img src={section.imageUrl} alt="" className="w-full h-full object-cover opacity-30" />
            </div>
          )}
          <div className="relative z-10 text-center w-full px-6 py-16">
            <h1 className="text-3xl md:text-5xl font-extrabold mb-4 leading-tight">
              {section.content.headline}
            </h1>
            {section.content.subheadline && (
              <p className="text-lg md:text-xl text-purple-200 mb-6">
                {section.content.subheadline}
              </p>
            )}
            {section.content.bodyText && (
              <p className="text-purple-300 mb-8 max-w-xl mx-auto">
                {section.content.bodyText}
              </p>
            )}
            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-white text-purple-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-purple-100 transition-all shadow-2xl"
            >
              {section.content.ctaText || '지금 시작하기'}
            </a>
          </div>
        </section>
      );

    case 'problem':
      return (
        <section className="py-16 bg-gray-900 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-red-400">
              {section.content.headline}
            </h2>
            {section.content.bodyText && (
              <p className="text-gray-300 text-center mb-8">{section.content.bodyText}</p>
            )}
            {section.content.bulletPoints && (
              <ul className="space-y-3">
                {section.content.bulletPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-gray-300">
                    <span className="text-red-400 mt-0.5">✗</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      );

    case 'solution':
      return (
        <section className="py-16 bg-gradient-to-b from-gray-900 to-purple-900/30 px-6">
          {section.imageUrl && (
            <div className="max-w-4xl mx-auto mb-8">
              <img src={section.imageUrl} alt="" className="rounded-xl w-full" />
            </div>
          )}
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-4">{section.content.headline}</h2>
            {section.content.subheadline && (
              <p className="text-xl text-purple-300 mb-4">{section.content.subheadline}</p>
            )}
            {section.content.bodyText && (
              <p className="text-gray-300">{section.content.bodyText}</p>
            )}
          </div>
        </section>
      );

    case 'benefits':
      return (
        <section className="py-16 bg-gray-800 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              {section.content.headline}
            </h2>
            {section.content.bulletPoints && (
              <div className="grid md:grid-cols-2 gap-4">
                {section.content.bulletPoints.map((benefit, i) => (
                  <div key={i} className="bg-gray-700/50 p-4 rounded-xl flex items-start gap-3">
                    <span className="text-green-400 text-xl">✓</span>
                    <span className="text-gray-200">{benefit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case 'proof':
      return (
        <section className="py-16 bg-gray-900 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              {section.content.headline}
            </h2>
            {section.content.bulletPoints && (
              <div className="space-y-4">
                {section.content.bulletPoints.map((testimonial, i) => (
                  <div key={i} className="bg-gray-800/50 p-6 rounded-xl border border-gray-700">
                    <p className="text-gray-300 italic">&ldquo;{testimonial}&rdquo;</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case 'offer':
      return (
        <section className="py-16 bg-gradient-to-r from-purple-800 to-pink-800 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-3xl font-bold mb-6">{section.content.headline}</h2>
            {section.content.bodyText && (
              <p className="text-xl text-purple-100 mb-8">{section.content.bodyText}</p>
            )}
            {section.content.bulletPoints && (
              <ul className="text-left max-w-md mx-auto space-y-2 mb-8">
                {section.content.bulletPoints.map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-purple-100">
                    <span className="text-green-400">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      );

    case 'cta':
      return (
        <section className="py-20 bg-gray-900 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl md:text-4xl font-bold mb-4">{section.content.headline}</h2>
            {section.content.subheadline && (
              <p className="text-xl text-purple-300 mb-6">{section.content.subheadline}</p>
            )}
            <a
              href={ctaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-10 py-5 rounded-full font-bold text-xl hover:from-purple-500 hover:to-pink-500 transition-all shadow-2xl"
            >
              {section.content.ctaText || '지금 신청하기'}
            </a>
            {section.content.bodyText && (
              <p className="text-sm text-gray-500 mt-6">{section.content.bodyText}</p>
            )}
          </div>
        </section>
      );

    case 'faq':
      return (
        <section className="py-16 bg-gray-800 px-6">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
              {section.content.headline}
            </h2>
            {section.content.bulletPoints && (
              <div className="space-y-3">
                {section.content.bulletPoints.map((faq, i) => {
                  const [q, a] = faq.split('|');
                  return (
                    <details key={i} className="bg-gray-700/50 rounded-xl overflow-hidden">
                      <summary className="p-4 cursor-pointer font-semibold text-purple-300 hover:text-purple-200">
                        Q. {q}
                      </summary>
                      <div className="p-4 pt-0 text-gray-300">
                        {a || '답변이 준비중입니다.'}
                      </div>
                    </details>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      );

    default:
      return null;
  }
}
