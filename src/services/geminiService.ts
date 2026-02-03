// src/services/geminiService.ts
// Gemini AI Service for Landing Page Generation

import { GoogleGenerativeAI } from '@google/generative-ai';

// Types
export interface PlanningData {
  businessName: string;
  industry: string;
  targetAudience: string;
  painPoints: string[];
  solution: string;
  uniqueValue: string;
  benefits: string[];
  testimonials: string[];
  offer: string;
  urgency: string;
  guarantee: string;
  ctaText: string;
  googleFormUrl?: string;
}

export interface SectionPlan {
  id: string;
  type: 'hero' | 'problem' | 'solution' | 'benefits' | 'proof' | 'offer' | 'cta' | 'faq';
  title: string;
  content: {
    headline: string;
    subheadline?: string;
    bodyText?: string;
    bulletPoints?: string[];
    ctaText?: string;
  };
  visualPrompt: string;
  imageUrl?: string;
  isGenerating?: boolean;
}

export interface LandingPagePlan {
  sections: SectionPlan[];
  metadata: {
    generatedAt: string;
    totalSections: number;
  };
}

// Magnetic Sales Section Templates
const MAGNETIC_SALES_SECTIONS = {
  hero: {
    purpose: '강력한 첫인상과 핵심 가치 제안',
    elements: ['attention-grabbing headline', 'sub-headline with benefit', 'hero image', 'primary CTA'],
  },
  problem: {
    purpose: '타겟 고객의 고통점 공감',
    elements: ['problem agitation', 'emotional connection', 'cost of not solving'],
  },
  solution: {
    purpose: '솔루션 소개와 차별화',
    elements: ['solution overview', 'unique mechanism', 'how it works'],
  },
  benefits: {
    purpose: '혜택 중심의 가치 전달',
    elements: ['benefit bullets', 'before/after', 'transformation promise'],
  },
  proof: {
    purpose: '신뢰 구축',
    elements: ['testimonials', 'case studies', 'credentials', 'social proof'],
  },
  offer: {
    purpose: '거부할 수 없는 오퍼',
    elements: ['offer stack', 'bonuses', 'pricing', 'value justification'],
  },
  cta: {
    purpose: '행동 유도',
    elements: ['urgency', 'scarcity', 'risk reversal', 'guarantee', 'CTA button'],
  },
  faq: {
    purpose: '이의 제기 처리',
    elements: ['common objections', 'FAQ items', 'reassurance'],
  },
};

// Category-specific regulations (Korean advertising laws)
const CATEGORY_REGULATIONS: Record<string, string[]> = {
  health: [
    '치료', '완치', '100%', '기적', '특효', '만병통치',
    '암 예방', '당뇨 치료', '의학적 효과',
  ],
  finance: [
    '원금 보장', '무조건 수익', '확정 수익률',
    '손실 없음', '리스크 제로',
  ],
  education: [
    '합격 보장', '무조건 취업', '100% 성공',
  ],
  default: [
    '최고', '최초', '유일' // 객관적 근거 없이 사용 금지
  ],
};

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;

  private getClient(): GoogleGenerativeAI {
    if (!this.genAI) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key not configured');
      }
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
    return this.genAI;
  }

  // Generate Landing Page Plan from Planning Data
  async generateLandingPagePlan(planningData: PlanningData): Promise<LandingPagePlan> {
    const client = this.getClient();
    const model = client.getGenerativeModel({ model: 'gemini-1.5-pro' });

    const prompt = this.buildPlanningPrompt(planningData);

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });

    const response = result.response;
    const text = response.text();

    try {
      const plan = JSON.parse(text) as LandingPagePlan;
      plan.metadata = {
        generatedAt: new Date().toISOString(),
        totalSections: plan.sections.length,
      };
      return plan;
    } catch {
      throw new Error('Failed to parse AI response as JSON');
    }
  }

  private buildPlanningPrompt(data: PlanningData): string {
    return `You are an expert landing page copywriter specializing in the Magnetic Sales methodology.
Create a high-converting landing page plan in Korean based on the following business information:

## Business Information
- Business Name: ${data.businessName}
- Industry: ${data.industry}
- Target Audience: ${data.targetAudience}
- Pain Points: ${data.painPoints.join(', ')}
- Solution: ${data.solution}
- Unique Value: ${data.uniqueValue}
- Benefits: ${data.benefits.join(', ')}
- Testimonials: ${data.testimonials.join('; ')}
- Offer: ${data.offer}
- Urgency: ${data.urgency}
- Guarantee: ${data.guarantee}
- CTA Text: ${data.ctaText}

## Required Output (JSON)
Generate a JSON object with the following structure:
{
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "title": "히어로 섹션",
      "content": {
        "headline": "강력한 헤드라인",
        "subheadline": "서브 헤드라인",
        "bodyText": "본문 텍스트",
        "ctaText": "CTA 버튼 텍스트"
      },
      "visualPrompt": "Detailed prompt for AI image generation in English"
    }
  ]
}

## Section Types Required (in order)
1. hero - 히어로 섹션 (첫인상, 핵심 가치)
2. problem - 문제 섹션 (고통점 공감)
3. solution - 솔루션 섹션 (해결책 제시)
4. benefits - 혜택 섹션 (구체적 이점)
5. proof - 증거 섹션 (신뢰 구축)
6. offer - 오퍼 섹션 (제안)
7. cta - CTA 섹션 (행동 유도)
8. faq - FAQ 섹션 (이의 처리)

## Rules
1. All text content must be in Korean
2. visualPrompt must be in English for image generation
3. Use persuasive copywriting techniques
4. Focus on benefits over features
5. Include emotional triggers
6. Create urgency without being pushy`;
  }

  // Generate Section Image using Gemini
  async generateSectionImage(
    section: SectionPlan,
    referenceImage?: string,
    aspectRatio: string = '16:9'
  ): Promise<string> {
    const client = this.getClient();

    // Use gemini-2.0-flash-exp for image generation (latest model with image output)
    const model = client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const imagePrompt = `Create a professional, modern landing page section image.
Section Type: ${section.type}
Visual Style: Clean, minimal, professional, high-end SaaS style
Color Palette: Modern gradient with purple/blue tones
Aspect Ratio: ${aspectRatio}

Specific Requirements:
${section.visualPrompt}

Style Guidelines:
- Use clean typography
- Professional business aesthetic
- Subtle gradients and shadows
- No text in the image (text will be overlaid)
- High contrast for readability
- Modern, 2024+ design trends`;

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
      { text: imagePrompt }
    ];

    // Add reference image if provided
    if (referenceImage && referenceImage.startsWith('data:')) {
      const base64Data = referenceImage.split(',')[1];
      parts.push({
        inlineData: {
          mimeType: 'image/png',
          data: base64Data,
        },
      });
    }

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 8192,
        },
      });

      const response = result.response;

      // Check for image in response
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if ('inlineData' in part && part.inlineData) {
            return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          }
        }
      }

      // Fallback: return placeholder
      return '/images/placeholder-section.png';
    } catch (error) {
      console.error('Image generation error:', error);
      throw new Error('Failed to generate image');
    }
  }

  // Generate complete landing page HTML
  async generateLandingPageHTML(
    plan: LandingPagePlan,
    googleFormUrl?: string
  ): Promise<string> {
    const sectionsHTML = plan.sections.map(section =>
      this.generateSectionHTML(section, googleFormUrl)
    ).join('\n');

    return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plan.sections[0]?.content.headline || 'Landing Page'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap');
    body { font-family: 'Noto Sans KR', sans-serif; }
    .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .glass-card {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
  </style>
</head>
<body class="bg-gray-900 text-white">
${sectionsHTML}
</body>
</html>`;
  }

  private generateSectionHTML(section: SectionPlan, googleFormUrl?: string): string {
    const ctaUrl = googleFormUrl || '#';

    switch (section.type) {
      case 'hero':
        return `
<section class="min-h-screen gradient-bg flex items-center justify-center relative overflow-hidden">
  ${section.imageUrl ? `<div class="absolute inset-0"><img src="${section.imageUrl}" alt="" class="w-full h-full object-cover opacity-30" /></div>` : ''}
  <div class="relative z-10 text-center max-w-4xl mx-auto px-6 py-20">
    <h1 class="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">${section.content.headline}</h1>
    ${section.content.subheadline ? `<p class="text-xl md:text-2xl text-purple-100 mb-8">${section.content.subheadline}</p>` : ''}
    ${section.content.bodyText ? `<p class="text-lg text-purple-200 mb-10 max-w-2xl mx-auto">${section.content.bodyText}</p>` : ''}
    <a href="${ctaUrl}" target="_blank" class="inline-block bg-white text-purple-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-purple-100 transition-all transform hover:scale-105 shadow-2xl">
      ${section.content.ctaText || '지금 시작하기'}
    </a>
  </div>
</section>`;

      case 'problem':
        return `
<section class="py-20 bg-gray-900">
  <div class="max-w-4xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12 text-red-400">${section.content.headline}</h2>
    ${section.content.bodyText ? `<p class="text-lg text-gray-300 text-center mb-10">${section.content.bodyText}</p>` : ''}
    ${section.content.bulletPoints?.length ? `
    <ul class="space-y-4">
      ${section.content.bulletPoints.map(point => `
        <li class="flex items-start gap-3 text-gray-300">
          <span class="text-red-400 mt-1">✗</span>
          <span>${point}</span>
        </li>
      `).join('')}
    </ul>` : ''}
  </div>
</section>`;

      case 'solution':
        return `
<section class="py-20 bg-gradient-to-b from-gray-900 to-purple-900/30">
  ${section.imageUrl ? `<div class="max-w-6xl mx-auto px-6 mb-12"><img src="${section.imageUrl}" alt="" class="rounded-2xl shadow-2xl w-full" /></div>` : ''}
  <div class="max-w-4xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-4xl font-bold mb-8">${section.content.headline}</h2>
    ${section.content.subheadline ? `<p class="text-xl text-purple-300 mb-6">${section.content.subheadline}</p>` : ''}
    ${section.content.bodyText ? `<p class="text-lg text-gray-300">${section.content.bodyText}</p>` : ''}
  </div>
</section>`;

      case 'benefits':
        return `
<section class="py-20 bg-gray-800">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">${section.content.headline}</h2>
    ${section.content.bulletPoints?.length ? `
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${section.content.bulletPoints.map(benefit => `
        <div class="glass-card p-6 rounded-xl">
          <span class="text-green-400 text-2xl mb-4 block">✓</span>
          <p class="text-gray-200">${benefit}</p>
        </div>
      `).join('')}
    </div>` : ''}
  </div>
</section>`;

      case 'proof':
        return `
<section class="py-20 bg-gray-900">
  <div class="max-w-4xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">${section.content.headline}</h2>
    ${section.content.bulletPoints?.length ? `
    <div class="space-y-6">
      ${section.content.bulletPoints.map(testimonial => `
        <div class="glass-card p-6 rounded-xl">
          <p class="text-gray-300 italic">"${testimonial}"</p>
        </div>
      `).join('')}
    </div>` : ''}
  </div>
</section>`;

      case 'offer':
        return `
<section class="py-20 gradient-bg">
  <div class="max-w-4xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-4xl font-bold mb-8">${section.content.headline}</h2>
    ${section.content.bodyText ? `<p class="text-xl text-purple-100 mb-8">${section.content.bodyText}</p>` : ''}
    ${section.content.bulletPoints?.length ? `
    <ul class="text-left max-w-md mx-auto mb-8 space-y-3">
      ${section.content.bulletPoints.map(item => `
        <li class="flex items-center gap-3 text-purple-100">
          <span class="text-green-400">✓</span>
          <span>${item}</span>
        </li>
      `).join('')}
    </ul>` : ''}
  </div>
</section>`;

      case 'cta':
        return `
<section class="py-20 bg-gray-900">
  <div class="max-w-4xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-4xl font-bold mb-6">${section.content.headline}</h2>
    ${section.content.subheadline ? `<p class="text-xl text-gray-300 mb-8">${section.content.subheadline}</p>` : ''}
    <a href="${ctaUrl}" target="_blank" class="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-10 py-5 rounded-full font-bold text-xl hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-105 shadow-2xl">
      ${section.content.ctaText || '지금 신청하기'}
    </a>
    ${section.content.bodyText ? `<p class="text-sm text-gray-500 mt-6">${section.content.bodyText}</p>` : ''}
  </div>
</section>`;

      case 'faq':
        return `
<section class="py-20 bg-gray-800">
  <div class="max-w-3xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">${section.content.headline}</h2>
    ${section.content.bulletPoints?.length ? `
    <div class="space-y-4">
      ${section.content.bulletPoints.map((faq, i) => `
        <details class="glass-card rounded-xl overflow-hidden">
          <summary class="p-4 cursor-pointer font-semibold text-purple-300 hover:text-purple-200">
            Q${i + 1}. ${faq.split('|')[0] || faq}
          </summary>
          <div class="p-4 pt-0 text-gray-300">
            ${faq.split('|')[1] || '답변이 준비중입니다.'}
          </div>
        </details>
      `).join('')}
    </div>` : ''}
  </div>
</section>`;

      default:
        return '';
    }
  }

  // Validate content against regulations
  validateContent(content: string, industry: string): { isValid: boolean; violations: string[] } {
    const regulations = [
      ...(CATEGORY_REGULATIONS[industry] || []),
      ...CATEGORY_REGULATIONS.default,
    ];

    const violations = regulations.filter(term =>
      content.toLowerCase().includes(term.toLowerCase())
    );

    return {
      isValid: violations.length === 0,
      violations,
    };
  }
}

export const geminiService = new GeminiService();
export default geminiService;
