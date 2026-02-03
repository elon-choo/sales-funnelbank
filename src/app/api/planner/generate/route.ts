// src/app/api/planner/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/guards';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { formData } = await request.json();

    // Initialize Claude API (Opus 4.5)
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic API not configured' }, { status: 500 });
    }

    const anthropic = new Anthropic({ apiKey });

    // Build prompt for landing page plan
    const prompt = buildPlanningPrompt(formData);

    // Use Claude Opus 4.5 for high-quality planning
    const message = await anthropic.messages.create({
      model: 'claude-opus-4-5-20251101',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const textContent = message.content.find(block => block.type === 'text');
    const text = textContent && 'text' in textContent ? textContent.text : '';

    // Parse JSON from response (may have markdown code block)
    let plan;
    try {
      // Try to extract JSON from markdown code block if present
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      const jsonString = jsonMatch ? jsonMatch[1].trim() : text.trim();
      plan = JSON.parse(jsonString);
    } catch {
      // If JSON parsing fails, create a default structure
      plan = createDefaultPlan(formData);
    }

    // Add metadata
    plan.metadata = {
      generatedAt: new Date().toISOString(),
      userId: auth.userId,
      formData: formData,
      model: 'claude-opus-4.5',
    };

    return NextResponse.json({ plan });
  } catch (error) {
    console.error('Plan generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate plan' },
      { status: 500 }
    );
  }
}

function buildPlanningPrompt(formData: Record<string, unknown>): string {
  return `You are an expert landing page copywriter specializing in the Magnetic Sales methodology.
Create a high-converting landing page plan in Korean based on the following business information.

## Business Information
- Business Name: ${formData.business_name || '미정'}
- Industry: ${formData.industry || '미정'}
- Business Model: ${formData.business_model || '미정'}

## Target Customer
- Demographics: ${formData.target_demographic || '미정'}
- Psychographics: ${formData.target_psychographic || '미정'}
- Customer Avatar: ${formData.customer_avatar || '미정'}

## Problem & Pain Points
- Main Problem: ${formData.main_problem || '미정'}
- Pain Points: ${Array.isArray(formData.pain_points) ? formData.pain_points.join(', ') : '미정'}
- Failed Solutions: ${formData.failed_solutions || '미정'}
- Cost of Inaction: ${formData.cost_of_inaction || '미정'}

## Solution & Differentiation
- Solution: ${formData.solution || '미정'}
- Unique Mechanism: ${formData.unique_mechanism || '미정'}
- Benefits: ${Array.isArray(formData.benefits) ? formData.benefits.join(', ') : '미정'}
- Transformation: ${formData.transformation || '미정'}

## Trust & Proof
- Credentials: ${formData.credentials || '미정'}
- Testimonials: ${Array.isArray(formData.testimonials) ? formData.testimonials.join('; ') : '미정'}
- Social Proof: ${formData.social_proof || '미정'}

## Offer & CTA
- Main Offer: ${formData.main_offer || '미정'}
- Price/Value: ${formData.price_value || '미정'}
- Bonuses: ${Array.isArray(formData.bonuses) ? formData.bonuses.join(', ') : '미정'}
- Guarantee: ${formData.guarantee || '미정'}
- Urgency: ${formData.urgency || '미정'}
- CTA Text: ${formData.cta_text || '지금 신청하기'}
- Google Form URL: ${formData.google_form_url || ''}

## Required Output (JSON)
Generate a comprehensive landing page plan with the following exact JSON structure:

{
  "businessInfo": {
    "name": "Business name",
    "tagline": "Short tagline"
  },
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "order": 1,
      "content": {
        "headline": "강력한 메인 헤드라인 (고객의 최종 결과물 강조)",
        "subheadline": "서브 헤드라인 (어떻게 달성하는지)",
        "bodyText": "간단한 설명 텍스트",
        "ctaText": "CTA 버튼 텍스트"
      },
      "visualPrompt": "Detailed English prompt for AI image generation. Professional, modern, clean design style. Include specific visual elements, colors, composition details."
    },
    {
      "id": "problem",
      "type": "problem",
      "order": 2,
      "content": {
        "headline": "문제 섹션 헤드라인",
        "bodyText": "문제 설명 및 공감 텍스트",
        "bulletPoints": ["고통점 1", "고통점 2", "고통점 3"]
      },
      "visualPrompt": "English prompt for problem section image"
    },
    {
      "id": "solution",
      "type": "solution",
      "order": 3,
      "content": {
        "headline": "솔루션 헤드라인",
        "subheadline": "솔루션 서브 헤드라인",
        "bodyText": "솔루션 설명",
        "bulletPoints": ["핵심 요소 1", "핵심 요소 2", "핵심 요소 3"]
      },
      "visualPrompt": "English prompt for solution section image"
    },
    {
      "id": "benefits",
      "type": "benefits",
      "order": 4,
      "content": {
        "headline": "혜택 섹션 헤드라인",
        "bulletPoints": ["혜택 1", "혜택 2", "혜택 3", "혜택 4", "혜택 5"]
      },
      "visualPrompt": "English prompt for benefits section image"
    },
    {
      "id": "proof",
      "type": "proof",
      "order": 5,
      "content": {
        "headline": "신뢰/증거 섹션 헤드라인",
        "bulletPoints": ["후기/증거 1", "후기/증거 2", "후기/증거 3"]
      },
      "visualPrompt": "English prompt for proof section image"
    },
    {
      "id": "offer",
      "type": "offer",
      "order": 6,
      "content": {
        "headline": "오퍼 헤드라인",
        "bodyText": "오퍼 설명",
        "bulletPoints": ["포함 항목 1", "포함 항목 2", "보너스 1", "보너스 2"]
      },
      "visualPrompt": "English prompt for offer section image"
    },
    {
      "id": "cta",
      "type": "cta",
      "order": 7,
      "content": {
        "headline": "최종 CTA 헤드라인",
        "subheadline": "긴급성/희소성 메시지",
        "bodyText": "보장/위험제거 메시지",
        "ctaText": "CTA 버튼 텍스트"
      },
      "visualPrompt": "English prompt for CTA section image"
    },
    {
      "id": "faq",
      "type": "faq",
      "order": 8,
      "content": {
        "headline": "자주 묻는 질문",
        "bulletPoints": ["질문1|답변1", "질문2|답변2", "질문3|답변3", "질문4|답변4", "질문5|답변5"]
      },
      "visualPrompt": "English prompt for FAQ section image"
    }
  ],
  "googleFormUrl": "${formData.google_form_url || ''}"
}

## Important Rules
1. All text content MUST be in Korean (except visualPrompt which is in English)
2. Headlines should be benefit-focused and emotionally compelling
3. Use power words and urgency triggers
4. Make the copy specific and concrete, not generic
5. Each visualPrompt should describe a professional, modern image suitable for that section
6. Apply Magnetic Sales principles: Hook → Story → Offer
7. FAQ items should address common objections`;
}

function createDefaultPlan(formData: Record<string, unknown>) {
  return {
    businessInfo: {
      name: formData.business_name || '비즈니스명',
      tagline: '당신의 성공을 위한 파트너',
    },
    sections: [
      {
        id: 'hero',
        type: 'hero',
        order: 1,
        content: {
          headline: formData.solution ? `${formData.solution}으로 성공하세요` : '당신의 비즈니스를 혁신하세요',
          subheadline: '검증된 시스템으로 빠른 결과를 경험하세요',
          bodyText: '지금 바로 시작하세요',
          ctaText: formData.cta_text || '무료 상담 신청하기',
        },
        visualPrompt: 'Professional hero section with modern gradient background, abstract shapes, confident business person, clean typography space, purple and blue color scheme, 16:9 aspect ratio',
      },
      {
        id: 'problem',
        type: 'problem',
        order: 2,
        content: {
          headline: '이런 고민, 있으신가요?',
          bodyText: formData.main_problem || '많은 분들이 같은 어려움을 겪고 있습니다.',
          bulletPoints: Array.isArray(formData.pain_points) ? formData.pain_points : ['문제점 1', '문제점 2', '문제점 3'],
        },
        visualPrompt: 'Frustrated business person at desk, overwhelmed with papers, dark moody lighting, stress visualization, professional photography style',
      },
      {
        id: 'solution',
        type: 'solution',
        order: 3,
        content: {
          headline: formData.unique_mechanism ? `${formData.unique_mechanism}` : '해결책을 찾았습니다',
          subheadline: '다른 방법과는 다릅니다',
          bodyText: formData.solution || '검증된 시스템으로 문제를 해결합니다.',
          bulletPoints: ['단계 1', '단계 2', '단계 3'],
        },
        visualPrompt: 'Clean modern solution diagram, step by step process visualization, bright colors, professional infographic style, minimalist design',
      },
      {
        id: 'benefits',
        type: 'benefits',
        order: 4,
        content: {
          headline: '이런 결과를 얻게 됩니다',
          bulletPoints: Array.isArray(formData.benefits) ? formData.benefits : ['혜택 1', '혜택 2', '혜택 3', '혜택 4', '혜택 5'],
        },
        visualPrompt: 'Benefits icons grid, modern flat design, checkmark symbols, growth charts, success visualization, green and blue accent colors',
      },
      {
        id: 'proof',
        type: 'proof',
        order: 5,
        content: {
          headline: '실제 결과를 확인하세요',
          bulletPoints: Array.isArray(formData.testimonials) ? formData.testimonials : ['고객 후기 1', '고객 후기 2', '고객 후기 3'],
        },
        visualPrompt: 'Testimonial section with professional headshots, quote marks, trust badges, clean white background, social proof elements',
      },
      {
        id: 'offer',
        type: 'offer',
        order: 6,
        content: {
          headline: formData.main_offer || '특별한 제안',
          bodyText: formData.price_value || '지금 시작하시면 특별 혜택을 드립니다.',
          bulletPoints: Array.isArray(formData.bonuses) ? [...formData.bonuses] : ['포함 항목 1', '포함 항목 2', '보너스 1'],
        },
        visualPrompt: 'Premium offer box, gift package visualization, value stack, pricing table, luxury feeling, gold accents on purple background',
      },
      {
        id: 'cta',
        type: 'cta',
        order: 7,
        content: {
          headline: '지금 바로 시작하세요',
          subheadline: formData.urgency || '한정된 기회입니다',
          bodyText: formData.guarantee || '만족하지 않으시면 전액 환불해 드립니다.',
          ctaText: formData.cta_text || '지금 신청하기',
        },
        visualPrompt: 'Call to action section, prominent button, urgency elements, countdown timer visualization, bright gradient background, arrow pointing to CTA',
      },
      {
        id: 'faq',
        type: 'faq',
        order: 8,
        content: {
          headline: '자주 묻는 질문',
          bulletPoints: [
            '얼마나 걸리나요?|개인차가 있지만 보통 2-4주 내에 첫 결과를 경험하십니다.',
            '환불이 가능한가요?|네, 30일 이내 무조건 환불을 보장합니다.',
            '초보자도 가능한가요?|물론입니다. 단계별 가이드로 누구나 따라하실 수 있습니다.',
          ],
        },
        visualPrompt: 'FAQ accordion section, question mark icons, clean expandable design, helpful customer service imagery',
      },
    ],
    googleFormUrl: formData.google_form_url || '',
  };
}
