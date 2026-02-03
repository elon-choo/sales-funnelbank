// src/app/(dashboard)/planner/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Magnetic Sales 6 Phases, 18 Steps Structure
const PHASES = [
  {
    id: 1,
    name: '비즈니스 기초',
    description: '사업의 핵심 정보를 파악합니다',
    steps: [
      { id: 'business_name', question: '비즈니스/브랜드 이름이 무엇인가요?', type: 'text', placeholder: '예: 마그네틱 세일즈 아카데미' },
      { id: 'industry', question: '어떤 업종/산업에 속하나요?', type: 'select', options: ['교육/코칭', '마케팅/광고', '건강/웰니스', 'IT/소프트웨어', '금융/투자', '뷰티/패션', '식품/요식업', '부동산', '기타'] },
      { id: 'business_model', question: '주요 수익 모델은 무엇인가요?', type: 'select', options: ['1:1 코칭/컨설팅', '그룹 코칭/강의', '온라인 강의', '멤버십/구독', '제품 판매', '서비스 제공', '기타'] },
    ]
  },
  {
    id: 2,
    name: '타겟 고객 분석',
    description: '이상적인 고객을 정의합니다',
    steps: [
      { id: 'target_demographic', question: '타겟 고객의 인구통계학적 특성은?', type: 'textarea', placeholder: '예: 30-40대 직장인 여성, 서울/수도권 거주, 연소득 5천만원 이상' },
      { id: 'target_psychographic', question: '타겟 고객의 심리적 특성과 가치관은?', type: 'textarea', placeholder: '예: 자기계발에 관심이 많고, 시간 대비 효율을 중시하며, 검증된 방법을 선호' },
      { id: 'customer_avatar', question: '이상적인 고객 1명을 구체적으로 묘사해주세요', type: 'textarea', placeholder: '예: 35세 김민지씨, 중견기업 마케팅팀 과장, 월 300만원 부수입을 원함...' },
    ]
  },
  {
    id: 3,
    name: '문제와 고통점',
    description: '고객이 겪는 문제를 파악합니다',
    steps: [
      { id: 'main_problem', question: '고객이 겪는 가장 큰 문제/고통은 무엇인가요?', type: 'textarea', placeholder: '예: 수많은 마케팅 방법을 시도했지만 실제 매출로 연결되지 않음' },
      { id: 'pain_points', question: '구체적인 고통점들을 나열해주세요 (최소 3개)', type: 'tags', placeholder: '고통점 입력 후 Enter' },
      { id: 'failed_solutions', question: '고객이 이미 시도했지만 실패한 해결책은?', type: 'textarea', placeholder: '예: 블로그 마케팅, 인스타 광고, 네이버 광고 등을 시도했지만...' },
      { id: 'cost_of_inaction', question: '이 문제를 해결하지 않으면 어떤 결과가 생기나요?', type: 'textarea', placeholder: '예: 계속되는 매출 정체, 사업 실패 위험, 정신적 스트레스...' },
    ]
  },
  {
    id: 4,
    name: '솔루션과 차별화',
    description: '당신만의 해결책을 정의합니다',
    steps: [
      { id: 'solution', question: '당신의 솔루션은 무엇인가요?', type: 'textarea', placeholder: '예: 마그네틱 세일즈 시스템 - 고객이 스스로 찾아오게 만드는 세일즈 자동화 프레임워크' },
      { id: 'unique_mechanism', question: '다른 것들과 다른 차별화 포인트는? (Unique Mechanism)', type: 'textarea', placeholder: '예: 단순 마케팅이 아닌, 심리학 기반 "끌림 공식"을 활용한 3단계 자동화 시스템' },
      { id: 'benefits', question: '고객이 얻게 되는 구체적인 혜택은? (최소 5개)', type: 'tags', placeholder: '혜택 입력 후 Enter' },
      { id: 'transformation', question: 'Before → After: 고객의 변화를 설명해주세요', type: 'textarea', placeholder: '예: Before: 매일 영업 전화에 지친 상태 → After: 자동으로 문의가 들어오는 시스템 보유' },
    ]
  },
  {
    id: 5,
    name: '신뢰와 증거',
    description: '신뢰를 구축할 증거를 수집합니다',
    steps: [
      { id: 'credentials', question: '당신의 자격/경력/전문성은 무엇인가요?', type: 'textarea', placeholder: '예: 10년차 마케팅 전문가, 500+ 클라이언트 성공 사례, 삼성/LG 컨설팅 경력' },
      { id: 'testimonials', question: '고객 후기/성공 사례를 입력해주세요', type: 'tags', placeholder: '후기 입력 후 Enter' },
      { id: 'social_proof', question: '기타 신뢰 요소는? (미디어 노출, 수강생 수 등)', type: 'textarea', placeholder: '예: 유튜브 구독자 10만명, 조선일보 인터뷰, 베스트셀러 저자' },
    ]
  },
  {
    id: 6,
    name: '오퍼와 CTA',
    description: '거부할 수 없는 제안을 설계합니다',
    steps: [
      { id: 'main_offer', question: '핵심 오퍼는 무엇인가요?', type: 'textarea', placeholder: '예: 마그네틱 세일즈 마스터 과정 (12주 프로그램)' },
      { id: 'price_value', question: '가격과 가치 제안을 설명해주세요', type: 'textarea', placeholder: '예: 정가 300만원 → 얼리버드 특가 197만원 (1인당 연평균 ROI 3,000%)' },
      { id: 'bonuses', question: '포함된 보너스/특전은? (최소 3개)', type: 'tags', placeholder: '보너스 입력 후 Enter' },
      { id: 'guarantee', question: '어떤 보장/위험 제거를 제공하나요?', type: 'textarea', placeholder: '예: 30일 무조건 환불 보장, 결과 없으면 1:1 무료 컨설팅' },
      { id: 'urgency', question: '긴급성/희소성 요소는?', type: 'textarea', placeholder: '예: 선착순 20명 한정, 이번 주 금요일까지만 특가 적용' },
      { id: 'cta_text', question: 'CTA 버튼에 들어갈 문구는?', type: 'text', placeholder: '예: 지금 바로 신청하기' },
      { id: 'google_form_url', question: 'Google Form URL (상담 신청 폼)', type: 'text', placeholder: 'https://docs.google.com/forms/d/e/...' },
    ]
  },
];

interface FormData {
  [key: string]: string | string[];
}

export default function PlannerPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<FormData>({});
  const [tagInput, setTagInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const phase = PHASES[currentPhase];
  const step = phase?.steps[currentStep];
  const totalSteps = PHASES.reduce((acc, p) => acc + p.steps.length, 0);
  const currentTotalStep = PHASES.slice(0, currentPhase).reduce((acc, p) => acc + p.steps.length, 0) + currentStep + 1;
  const progress = (currentTotalStep / totalSteps) * 100;

  const handleNext = () => {
    if (currentStep < phase.steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (currentPhase < PHASES.length - 1) {
      setCurrentPhase(currentPhase + 1);
      setCurrentStep(0);
    } else {
      setShowSummary(true);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (currentPhase > 0) {
      setCurrentPhase(currentPhase - 1);
      setCurrentStep(PHASES[currentPhase - 1].steps.length - 1);
    }
  };

  const handleInputChange = (value: string) => {
    setFormData(prev => ({ ...prev, [step.id]: value }));
  };

  const handleTagAdd = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      const currentTags = (formData[step.id] as string[]) || [];
      if (!currentTags.includes(tagInput.trim())) {
        setFormData(prev => ({
          ...prev,
          [step.id]: [...currentTags, tagInput.trim()]
        }));
      }
      setTagInput('');
    }
  };

  const handleTagRemove = (tag: string) => {
    const currentTags = (formData[step.id] as string[]) || [];
    setFormData(prev => ({
      ...prev,
      [step.id]: currentTags.filter(t => t !== tag)
    }));
  };

  const handleGeneratePlan = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/planner/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ formData }),
      });

      if (!response.ok) throw new Error('Failed to generate plan');

      const result = await response.json();

      // Store the plan and redirect to builder
      sessionStorage.setItem('landingPagePlan', JSON.stringify(result.plan));
      router.push('/builder');
    } catch (error) {
      console.error('Generation error:', error);
      alert('기획서 생성 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (showSummary) {
    return (
      <div className="min-h-screen bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <button
              onClick={() => setShowSummary(false)}
              className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
            >
              <Icons.arrowLeft className="w-4 h-4" />
              돌아가기
            </button>
            <h1 className="text-3xl font-bold text-white">기획 요약</h1>
            <p className="text-gray-400 mt-2">입력하신 정보를 확인하고 랜딩페이지를 생성하세요</p>
          </div>

          {/* Summary Cards */}
          <div className="space-y-6 mb-8">
            {PHASES.map(p => (
              <div key={p.id} className="glass-card rounded-xl border border-white/10 p-6">
                <h3 className="text-lg font-semibold text-purple-400 mb-4">
                  Phase {p.id}: {p.name}
                </h3>
                <div className="space-y-3">
                  {p.steps.map(s => {
                    const value = formData[s.id];
                    return (
                      <div key={s.id} className="flex flex-col">
                        <span className="text-sm text-gray-500">{s.question}</span>
                        <span className="text-white">
                          {Array.isArray(value) ? value.join(', ') : value || '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Generate Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleGeneratePlan}
              disabled={isGenerating}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-12 py-6 text-xl font-bold rounded-xl"
            >
              {isGenerating ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white mr-3"></div>
                  AI가 기획서를 생성중입니다...
                </>
              ) : (
                <>
                  <Icons.sparkles className="w-6 h-6 mr-2" />
                  랜딩페이지 기획서 생성하기
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Progress Header */}
      <div className="sticky top-0 z-50 bg-gray-900/95 backdrop-blur border-b border-white/10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          {/* Phase Indicator */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {PHASES.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center ${i < PHASES.length - 1 ? 'flex-1' : ''}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      i < currentPhase
                        ? 'bg-green-500 text-white'
                        : i === currentPhase
                        ? 'bg-purple-500 text-white'
                        : 'bg-gray-700 text-gray-400'
                    }`}
                  >
                    {i < currentPhase ? <Icons.check className="w-4 h-4" /> : p.id}
                  </div>
                  {i < PHASES.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 ${
                        i < currentPhase ? 'bg-green-500' : 'bg-gray-700'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm text-gray-400">
              Phase {currentPhase + 1}: {phase.name}
            </span>
            <span className="text-sm text-gray-400">
              {currentTotalStep} / {totalSteps}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <span className="text-purple-400 text-sm font-medium mb-2 block">
            {phase.name} - Step {currentStep + 1}/{phase.steps.length}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
            {step.question}
          </h2>
          <p className="text-gray-400">{phase.description}</p>
        </div>

        {/* Input Field */}
        <div className="mb-8">
          {step.type === 'text' && (
            <Input
              value={(formData[step.id] as string) || ''}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={step.placeholder}
              className="w-full bg-gray-800 border-gray-700 text-white text-lg py-6 px-4 rounded-xl focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          )}

          {step.type === 'textarea' && (
            <Textarea
              value={(formData[step.id] as string) || ''}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder={step.placeholder}
              className="w-full bg-gray-800 border-gray-700 text-white text-lg p-4 rounded-xl min-h-[150px] focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
          )}

          {step.type === 'select' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {step.options?.map((option) => (
                <button
                  key={option}
                  onClick={() => handleInputChange(option)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    formData[step.id] === option
                      ? 'border-purple-500 bg-purple-500/20 text-white'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {step.type === 'tags' && (
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                {((formData[step.id] as string[]) || []).map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => handleTagRemove(tag)}
                      className="hover:text-red-400"
                    >
                      <Icons.x className="w-4 h-4" />
                    </button>
                  </span>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagAdd}
                placeholder={step.placeholder}
                className="w-full bg-gray-800 border-gray-700 text-white text-lg py-6 px-4 rounded-xl focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <p className="text-sm text-gray-500 mt-2">Enter를 눌러 항목 추가</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button
            onClick={handlePrev}
            variant="outline"
            disabled={currentPhase === 0 && currentStep === 0}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <Icons.arrowLeft className="w-4 h-4 mr-2" />
            이전
          </Button>

          <Button
            onClick={handleNext}
            className="bg-purple-600 hover:bg-purple-500"
          >
            {currentPhase === PHASES.length - 1 && currentStep === phase.steps.length - 1 ? (
              <>
                완료
                <Icons.check className="w-4 h-4 ml-2" />
              </>
            ) : (
              <>
                다음
                <Icons.arrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        {/* Skip Link */}
        <div className="text-center mt-8">
          <button
            onClick={() => setShowSummary(true)}
            className="text-sm text-gray-500 hover:text-gray-400 underline"
          >
            건너뛰고 지금까지 입력한 정보로 생성하기
          </button>
        </div>
      </div>
    </div>
  );
}
