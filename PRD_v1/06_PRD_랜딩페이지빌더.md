# PRD: 랜딩페이지 빌더

## 1. 개요

### 1.1 문서 정보

| 항목 | 내용 |
|------|------|
| 문서명 | 06_PRD_랜딩페이지빌더.md |
| 버전 | 1.0.0 |
| 작성일 | 2025-01-15 |
| 의존 문서 | 03_PRD_프로젝트구조.md, 05_PRD_AI기획도우미.md |
| 참조 문서 | 기획_v2/03_기능_정의_v2.md, 기획_v2/02_UX_플로우_v2.md |

### 1.2 기능 목적

AI 기획 도우미에서 생성된 기획 데이터를 기반으로 마그네틱 세일즈 방법론이 적용된 고전환율 랜딩페이지를 생성, 편집, 미리보기, 배포하는 시스템.

### 1.3 핵심 기능

```yaml
기능_목록:
  LP-001: 템플릿 선택
  LP-002: AI 콘텐츠 생성
  LP-003: 이미지 업로드/처리
  LP-004: 실시간 미리보기
  LP-005: 배포 및 URL 관리
  LP-006: 수정/삭제/복구
```

---

## 2. 데이터 타입 정의

### 2.1 템플릿 관련 타입

```typescript
// src/types/landing-page.ts

// ============================================================
// 1. 템플릿 관련 타입
// ============================================================

export type TemplateId = 'TPL-001' | 'TPL-002' | 'TPL-003';

export interface Template {
  id: TemplateId;
  name: string;
  description: string;
  category: 'coaching' | 'service' | 'lead-gen';
  previewUrl: string;
  sections: TemplateSection[];
  requiredFields: string[];
  estimatedTokens: number;
}

export interface TemplateSection {
  id: string;
  type: SectionType;
  name: string;
  order: number;
  required: boolean;
  config: SectionConfig;
}

export type SectionType =
  | 'hero'
  | 'problem'
  | 'solution'
  | 'benefits'
  | 'process'
  | 'testimonials'
  | 'proof'
  | 'offer'
  | 'faq'
  | 'cta'
  | 'trust';

export interface SectionConfig {
  minHeight?: number;
  maxHeight?: number;
  backgroundColor?: string;
  textColor?: string;
  hasImage: boolean;
  imagePosition?: 'left' | 'right' | 'background' | 'center';
  animationType?: 'fade' | 'slide' | 'none';
}

// ============================================================
// 2. 랜딩페이지 타입
// ============================================================

export type LandingPageStatus = 'draft' | 'generating' | 'published' | 'unpublished';

export interface LandingPage {
  id: string;
  userId: string;
  projectId: string;
  templateId: TemplateId;
  title: string;
  slug: string | null;
  status: LandingPageStatus;
  html: string | null;
  css: string | null;
  sections: LandingPageSection[];
  metadata: LandingPageMetadata;
  seoConfig: SEOConfig;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  deletedAt: string | null;
  version: number;
}

export interface LandingPageSection {
  id: string;
  sectionType: SectionType;
  order: number;
  content: SectionContent;
  styles: SectionStyles;
  isVisible: boolean;
}

export interface SectionContent {
  headline?: string;
  subheadline?: string;
  bodyText?: string;
  bulletPoints?: string[];
  ctaText?: string;
  ctaUrl?: string;
  imageUrl?: string;
  imageAlt?: string;
  items?: ContentItem[];
}

export interface ContentItem {
  id: string;
  title: string;
  description: string;
  icon?: string;
  imageUrl?: string;
}

export interface SectionStyles {
  backgroundColor: string;
  textColor: string;
  padding: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  customCSS?: string;
}

export interface LandingPageMetadata {
  generatedAt: string;
  generationTime: number;
  tokensUsed: number;
  aiModel: string;
  templateVersion: string;
}

export interface SEOConfig {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage: string | null;
  canonicalUrl: string | null;
  noIndex: boolean;
}

// ============================================================
// 3. 생성 작업 관련 타입
// ============================================================

export type GenerationJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'timeout'
  | 'cancelled';

export interface GenerationJob {
  id: string;
  userId: string;
  projectId: string;
  landingPageId: string;
  status: GenerationJobStatus;
  progress: number;
  currentStep: GenerationStep;
  estimatedTimeRemaining: number | null;
  error: GenerationError | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  timeoutAt: string;
}

export type GenerationStep =
  | 'queued'
  | 'analyzing_prompt'
  | 'designing_structure'
  | 'generating_html'
  | 'applying_styles'
  | 'optimizing'
  | 'validating'
  | 'completed';

export interface GenerationError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export interface GenerationProgress {
  jobId: string;
  status: GenerationJobStatus;
  progress: number;
  currentStep: GenerationStep;
  stepDescription: string;
  estimatedTimeRemaining: number | null;
  completedSteps: GenerationStep[];
}

// ============================================================
// 4. 이미지 관련 타입
// ============================================================

export type ImageType = 'hero' | 'profile' | 'product' | 'testimonial' | 'background';

export interface LandingPageImage {
  id: string;
  landingPageId: string;
  type: ImageType;
  originalUrl: string;
  optimizedUrl: string;
  webpUrl: string;
  thumbnailUrl: string;
  alt: string;
  originalSize: number;
  optimizedSize: number;
  dimensions: {
    width: number;
    height: number;
  };
  uploadedAt: string;
}

export interface ImageUploadResult {
  success: boolean;
  image?: LandingPageImage;
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================
// 5. 배포 관련 타입
// ============================================================

export interface DeploymentConfig {
  slug: string;
  customDomain?: string;
  enableAnalytics: boolean;
  analyticsId?: string;
  enableComments: boolean;
  password?: string;
}

export interface DeploymentResult {
  success: boolean;
  url: string;
  deployedAt: string;
  expiresAt?: string;
}

// ============================================================
// 6. 미리보기 관련 타입
// ============================================================

export type ViewMode = 'desktop' | 'tablet' | 'mobile';

export interface PreviewConfig {
  viewMode: ViewMode;
  showGrid: boolean;
  showRuler: boolean;
  zoom: number;
}

export interface PreviewDimensions {
  desktop: { width: 1920; height: 1080 };
  tablet: { width: 768; height: 1024 };
  mobile: { width: 375; height: 812 };
}
```

### 2.2 Zod 스키마

```typescript
// src/lib/validations/landing-page.ts

import { z } from 'zod';

// ============================================================
// 1. 템플릿 선택 스키마
// ============================================================

export const templateSelectSchema = z.object({
  templateId: z.enum(['TPL-001', 'TPL-002', 'TPL-003']),
  projectId: z.string().uuid(),
});

export type TemplateSelectInput = z.infer<typeof templateSelectSchema>;

// ============================================================
// 2. 랜딩페이지 생성 요청 스키마
// ============================================================

export const generateLandingPageSchema = z.object({
  projectId: z.string().uuid(),
  templateId: z.enum(['TPL-001', 'TPL-002', 'TPL-003']),
  planningData: z.object({
    sessionId: z.string().uuid(),
    summaryId: z.string().uuid().optional(),
    answers: z.record(z.string(), z.string()),
  }),
  images: z.array(z.object({
    id: z.string().uuid(),
    type: z.enum(['hero', 'profile', 'product', 'testimonial', 'background']),
    url: z.string().url(),
  })).optional(),
  options: z.object({
    colorScheme: z.string().optional(),
    fontFamily: z.string().optional(),
    includeTestimonials: z.boolean().default(true),
    includeFAQ: z.boolean().default(true),
  }).optional(),
});

export type GenerateLandingPageInput = z.infer<typeof generateLandingPageSchema>;

// ============================================================
// 3. 이미지 업로드 스키마
// ============================================================

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const imageUploadSchema = z.object({
  file: z.custom<File>()
    .refine((file) => file.size <= MAX_FILE_SIZE, {
      message: 'ERR_LP_3004: 파일 크기는 5MB 이하여야 합니다.',
    })
    .refine((file) => ACCEPTED_IMAGE_TYPES.includes(file.type), {
      message: 'ERR_LP_3005: JPG, PNG, WebP 형식만 지원합니다.',
    }),
  imageType: z.enum(['hero', 'profile', 'product', 'testimonial', 'background']),
  landingPageId: z.string().uuid(),
  alt: z.string().max(200).optional(),
});

export type ImageUploadInput = z.infer<typeof imageUploadSchema>;

// ============================================================
// 4. 슬러그 검증 스키마
// ============================================================

const RESERVED_SLUGS = [
  'admin', 'api', 'auth', 'dashboard', 'login', 'signup',
  'help', 'support', 'about', 'contact', 'privacy', 'terms',
  'settings', 'profile', 'account', 'billing', 'new', 'edit',
];

export const slugSchema = z.string()
  .min(3, '슬러그는 최소 3자 이상이어야 합니다.')
  .max(50, '슬러그는 최대 50자까지 가능합니다.')
  .regex(
    /^[a-z0-9]+(-[a-z0-9]+)*$/,
    '영문 소문자, 숫자, 하이픈만 사용 가능합니다. (연속 하이픈 불가)'
  )
  .refine(
    (slug) => !RESERVED_SLUGS.includes(slug),
    'ERR_LP_3009: 사용할 수 없는 URL입니다.'
  );

export const deploymentSchema = z.object({
  landingPageId: z.string().uuid(),
  slug: slugSchema,
  enableAnalytics: z.boolean().default(false),
  analyticsId: z.string().optional(),
  password: z.string().min(4).max(20).optional(),
});

export type DeploymentInput = z.infer<typeof deploymentSchema>;

// ============================================================
// 5. 섹션 편집 스키마
// ============================================================

export const sectionContentSchema = z.object({
  headline: z.string().max(200).optional(),
  subheadline: z.string().max(500).optional(),
  bodyText: z.string().max(5000).optional(),
  bulletPoints: z.array(z.string().max(200)).max(10).optional(),
  ctaText: z.string().max(50).optional(),
  ctaUrl: z.string().url().optional(),
  imageUrl: z.string().url().optional(),
  imageAlt: z.string().max(200).optional(),
  items: z.array(z.object({
    id: z.string(),
    title: z.string().max(100),
    description: z.string().max(500),
    icon: z.string().optional(),
    imageUrl: z.string().url().optional(),
  })).max(20).optional(),
});

export const sectionEditSchema = z.object({
  landingPageId: z.string().uuid(),
  sectionId: z.string().uuid(),
  content: sectionContentSchema,
});

export type SectionEditInput = z.infer<typeof sectionEditSchema>;

// ============================================================
// 6. SEO 설정 스키마
// ============================================================

export const seoConfigSchema = z.object({
  title: z.string().min(10).max(60),
  description: z.string().min(50).max(160),
  keywords: z.array(z.string().max(30)).max(10),
  ogTitle: z.string().max(60).optional(),
  ogDescription: z.string().max(200).optional(),
  ogImage: z.string().url().optional(),
  canonicalUrl: z.string().url().optional(),
  noIndex: z.boolean().default(false),
});

export type SEOConfigInput = z.infer<typeof seoConfigSchema>;
```

---

## 3. 템플릿 시스템

### 3.1 MVP 템플릿 정의

```typescript
// src/config/templates.ts

import { Template, TemplateSection } from '@/types/landing-page';

// ============================================================
// 템플릿 1: 코칭/컨설팅 전용
// ============================================================

export const TEMPLATE_COACHING: Template = {
  id: 'TPL-001',
  name: '코칭/컨설팅',
  description: '코치, 컨설턴트를 위한 전환 최적화 템플릿',
  category: 'coaching',
  previewUrl: '/templates/coaching-preview.png',
  estimatedTokens: 8000,
  requiredFields: ['expertName', 'targetAudience', 'mainProblem', 'solution', 'cta'],
  sections: [
    {
      id: 'hero',
      type: 'hero',
      name: '히어로 섹션',
      order: 1,
      required: true,
      config: {
        minHeight: 600,
        hasImage: true,
        imagePosition: 'right',
        animationType: 'fade',
      },
    },
    {
      id: 'problem',
      type: 'problem',
      name: '문제 인식 섹션',
      order: 2,
      required: true,
      config: {
        hasImage: false,
        backgroundColor: '#f8f9fa',
        animationType: 'slide',
      },
    },
    {
      id: 'solution',
      type: 'solution',
      name: '솔루션 제시 섹션',
      order: 3,
      required: true,
      config: {
        hasImage: true,
        imagePosition: 'left',
        animationType: 'fade',
      },
    },
    {
      id: 'proof',
      type: 'proof',
      name: '사회적 증거 섹션',
      order: 4,
      required: false,
      config: {
        hasImage: true,
        animationType: 'slide',
      },
    },
    {
      id: 'offer',
      type: 'offer',
      name: '오퍼 섹션',
      order: 5,
      required: true,
      config: {
        hasImage: false,
        backgroundColor: '#e8f4fd',
        animationType: 'fade',
      },
    },
    {
      id: 'cta',
      type: 'cta',
      name: 'CTA 섹션',
      order: 6,
      required: true,
      config: {
        minHeight: 300,
        hasImage: false,
        backgroundColor: '#1a365d',
        textColor: '#ffffff',
        animationType: 'fade',
      },
    },
  ],
};

// ============================================================
// 템플릿 2: 서비스 상세
// ============================================================

export const TEMPLATE_SERVICE: Template = {
  id: 'TPL-002',
  name: '서비스 상세',
  description: '보험, 피부샵 등 서비스업을 위한 상세 템플릿',
  category: 'service',
  previewUrl: '/templates/service-preview.png',
  estimatedTokens: 10000,
  requiredFields: ['serviceName', 'benefits', 'process', 'testimonials', 'cta'],
  sections: [
    {
      id: 'hero',
      type: 'hero',
      name: '히어로 섹션',
      order: 1,
      required: true,
      config: {
        minHeight: 600,
        hasImage: true,
        imagePosition: 'background',
        animationType: 'fade',
      },
    },
    {
      id: 'benefits',
      type: 'benefits',
      name: '혜택 섹션',
      order: 2,
      required: true,
      config: {
        hasImage: false,
        animationType: 'slide',
      },
    },
    {
      id: 'process',
      type: 'process',
      name: '프로세스 섹션',
      order: 3,
      required: true,
      config: {
        hasImage: true,
        backgroundColor: '#f8f9fa',
        animationType: 'fade',
      },
    },
    {
      id: 'testimonials',
      type: 'testimonials',
      name: '고객 후기 섹션',
      order: 4,
      required: false,
      config: {
        hasImage: true,
        animationType: 'slide',
      },
    },
    {
      id: 'faq',
      type: 'faq',
      name: 'FAQ 섹션',
      order: 5,
      required: false,
      config: {
        hasImage: false,
        animationType: 'fade',
      },
    },
    {
      id: 'cta',
      type: 'cta',
      name: 'CTA 섹션',
      order: 6,
      required: true,
      config: {
        minHeight: 300,
        hasImage: false,
        backgroundColor: '#2d3748',
        textColor: '#ffffff',
        animationType: 'fade',
      },
    },
  ],
};

// ============================================================
// 템플릿 3: 리드 수집
// ============================================================

export const TEMPLATE_LEAD_GEN: Template = {
  id: 'TPL-003',
  name: '리드 수집',
  description: '이메일/연락처 수집을 위한 심플 템플릿',
  category: 'lead-gen',
  previewUrl: '/templates/lead-gen-preview.png',
  estimatedTokens: 5000,
  requiredFields: ['headline', 'valueProposition', 'formFields', 'cta'],
  sections: [
    {
      id: 'hero',
      type: 'hero',
      name: '히어로 섹션',
      order: 1,
      required: true,
      config: {
        minHeight: 500,
        hasImage: true,
        imagePosition: 'center',
        animationType: 'fade',
      },
    },
    {
      id: 'value',
      type: 'benefits',
      name: '가치 제안 섹션',
      order: 2,
      required: true,
      config: {
        hasImage: false,
        animationType: 'slide',
      },
    },
    {
      id: 'trust',
      type: 'trust',
      name: '신뢰 지표 섹션',
      order: 3,
      required: false,
      config: {
        hasImage: true,
        backgroundColor: '#f8f9fa',
        animationType: 'fade',
      },
    },
    {
      id: 'cta',
      type: 'cta',
      name: 'CTA/폼 섹션',
      order: 4,
      required: true,
      config: {
        minHeight: 400,
        hasImage: false,
        backgroundColor: '#1a365d',
        textColor: '#ffffff',
        animationType: 'fade',
      },
    },
  ],
};

// ============================================================
// 템플릿 레지스트리
// ============================================================

export const TEMPLATES: Record<string, Template> = {
  'TPL-001': TEMPLATE_COACHING,
  'TPL-002': TEMPLATE_SERVICE,
  'TPL-003': TEMPLATE_LEAD_GEN,
};

export function getTemplate(templateId: string): Template | null {
  return TEMPLATES[templateId] ?? null;
}

export function getAllTemplates(): Template[] {
  return Object.values(TEMPLATES);
}
```

### 3.2 템플릿 선택 API

```typescript
// src/app/api/templates/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAllTemplates } from '@/config/templates';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createErrorResponse } from '@/lib/api/error-response';

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'GET') {
    return createErrorResponse('ERR_SYS_9999', 'Method not allowed', 405);
  }

  try {
    const templates = getAllTemplates();

    // 사용자별 사용 통계 조회 (선택사항)
    const supabase = await createClient();
    const { data: userTemplates } = await supabase
      .from('landing_pages')
      .select('template_id')
      .eq('user_id', req.user.id)
      .is('deleted_at', null);

    const templateUsage = (userTemplates || []).reduce((acc, lp) => {
      acc[lp.template_id] = (acc[lp.template_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const templatesWithUsage = templates.map((template) => ({
      ...template,
      userUsageCount: templateUsage[template.id] || 0,
    }));

    return NextResponse.json({
      success: true,
      templates: templatesWithUsage,
    });
  } catch (error) {
    console.error('Template list error:', error);
    return createErrorResponse('ERR_SYS_9999', '템플릿 목록을 불러오는데 실패했습니다.');
  }
}

export const GET = withRateLimit(withAuth(handler), {
  limit: 60,
  windowMs: 60 * 1000,
});
```

---

## 4. AI 콘텐츠 생성 시스템

### 4.1 생성 요청 API

```typescript
// src/app/api/generate/landing-page/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateLandingPageSchema } from '@/lib/validations/landing-page';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { checkAndReserveTokens } from '@/lib/ai/token-manager';
import { createErrorResponse } from '@/lib/api/error-response';
import { getTemplate } from '@/config/templates';
import { v4 as uuidv4 } from 'uuid';

/**
 * 랜딩페이지 생성 요청 핸들러
 * 비동기 작업 큐에 추가하고 jobId 반환
 */
async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'POST') {
    return createErrorResponse('ERR_SYS_9999', 'Method not allowed', 405);
  }

  const supabase = await createClient();

  try {
    // 1. 요청 검증
    const body = await req.json();
    const validationResult = generateLandingPageSchema.safeParse(body);

    if (!validationResult.success) {
      return createErrorResponse(
        'ERR_LP_3001',
        '입력 데이터가 올바르지 않습니다.',
        400,
        validationResult.error.errors
      );
    }

    const { projectId, templateId, planningData, images, options } = validationResult.data;

    // 2. 프로젝트 소유권 확인
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', req.user.id)
      .single();

    if (projectError || !project) {
      return createErrorResponse('ERR_LP_3001', '프로젝트를 찾을 수 없습니다.', 404);
    }

    // 3. 템플릿 유효성 확인
    const template = getTemplate(templateId);
    if (!template) {
      return createErrorResponse('ERR_LP_3001', '유효하지 않은 템플릿입니다.', 400);
    }

    // 4. 토큰 한도 확인 및 예약
    const estimatedTokens = template.estimatedTokens;
    const tokenCheck = await checkAndReserveTokens(req.user.id, estimatedTokens);

    if (!tokenCheck.allowed) {
      return createErrorResponse(
        'ERR_AI_2001',
        tokenCheck.message || '일일 사용량 한도에 도달했습니다.',
        429
      );
    }

    // 5. 랜딩페이지 레코드 생성
    const landingPageId = uuidv4();
    const { error: lpError } = await supabase
      .from('landing_pages')
      .insert({
        id: landingPageId,
        user_id: req.user.id,
        project_id: projectId,
        template_id: templateId,
        title: `랜딩페이지 - ${new Date().toLocaleDateString('ko-KR')}`,
        status: 'generating',
        version: 1,
      });

    if (lpError) {
      console.error('Landing page creation error:', lpError);
      return createErrorResponse('ERR_LP_3002', '랜딩페이지 생성에 실패했습니다.');
    }

    // 6. 생성 작업 큐에 추가
    const jobId = uuidv4();
    const timeoutAt = new Date(Date.now() + 90 * 1000).toISOString(); // 90초 타임아웃

    const { error: jobError } = await supabase
      .from('generation_jobs')
      .insert({
        id: jobId,
        user_id: req.user.id,
        project_id: projectId,
        landing_page_id: landingPageId,
        status: 'pending',
        progress: 0,
        current_step: 'queued',
        timeout_at: timeoutAt,
        input_data: {
          templateId,
          planningData,
          images: images || [],
          options: options || {},
        },
      });

    if (jobError) {
      console.error('Job creation error:', jobError);
      // 롤백: 랜딩페이지 삭제
      await supabase.from('landing_pages').delete().eq('id', landingPageId);
      return createErrorResponse('ERR_LP_3002', '생성 작업 등록에 실패했습니다.');
    }

    // 7. Edge Function 트리거 (비동기)
    const edgeResponse = await fetch(
      `${process.env.SUPABASE_URL}/functions/v1/generate-landing-page`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ jobId }),
      }
    );

    if (!edgeResponse.ok) {
      console.error('Edge function trigger failed:', await edgeResponse.text());
      // 작업은 큐에 남아있으므로 에러 반환하지 않음
    }

    // 8. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'landing_page.generate_started',
      resource_type: 'landing_page',
      resource_id: landingPageId,
      details: {
        jobId,
        templateId,
        estimatedTokens,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    });

    return NextResponse.json({
      success: true,
      jobId,
      landingPageId,
      estimatedTime: 90,
      message: '랜딩페이지 생성이 시작되었습니다.',
    });

  } catch (error) {
    console.error('Generate landing page error:', error);
    return createErrorResponse('ERR_LP_3002', '랜딩페이지 생성 요청에 실패했습니다.');
  }
}

// Rate Limit: 10회 / 1시간
export const POST = withRateLimit(withAuth(handler), {
  limit: 10,
  windowMs: 60 * 60 * 1000,
  keyGenerator: (req: AuthenticatedRequest) => `generate:${req.user.id}`,
});
```

### 4.2 생성 진행 상태 API (SSE)

```typescript
// src/app/api/generate/[jobId]/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';

/**
 * 생성 진행 상태 SSE 스트림
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { jobId: string } }
) {
  const supabase = await createClient();
  const { jobId } = params;

  // 권한 확인을 위한 사용자 정보 조회
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  // 작업 소유권 확인
  const { data: job, error: jobError } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (jobError || !job) {
    return new NextResponse('Job not found', { status: 404 });
  }

  // SSE 스트림 생성
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // 초기 상태 전송
      sendEvent({
        type: 'status',
        jobId,
        status: job.status,
        progress: job.progress,
        currentStep: job.current_step,
        stepDescription: getStepDescription(job.current_step),
        completedSteps: getCompletedSteps(job.current_step),
        estimatedTimeRemaining: calculateEstimatedTime(job),
      });

      // 이미 완료/실패된 작업이면 종료
      if (['completed', 'failed', 'timeout', 'cancelled'].includes(job.status)) {
        sendEvent({
          type: 'final',
          status: job.status,
          landingPageId: job.landing_page_id,
          error: job.error,
        });
        controller.close();
        return;
      }

      // Realtime 구독으로 상태 변경 감지
      const channel = supabase
        .channel(`job-${jobId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'generation_jobs',
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const updatedJob = payload.new;

            sendEvent({
              type: 'status',
              jobId,
              status: updatedJob.status,
              progress: updatedJob.progress,
              currentStep: updatedJob.current_step,
              stepDescription: getStepDescription(updatedJob.current_step),
              completedSteps: getCompletedSteps(updatedJob.current_step),
              estimatedTimeRemaining: calculateEstimatedTime(updatedJob),
            });

            // 완료/실패 시 스트림 종료
            if (['completed', 'failed', 'timeout', 'cancelled'].includes(updatedJob.status)) {
              sendEvent({
                type: 'final',
                status: updatedJob.status,
                landingPageId: updatedJob.landing_page_id,
                error: updatedJob.error,
              });
              channel.unsubscribe();
              controller.close();
            }
          }
        )
        .subscribe();

      // 타임아웃 처리 (90초)
      setTimeout(() => {
        channel.unsubscribe();
        sendEvent({
          type: 'timeout',
          message: '생성 시간이 초과되었습니다.',
        });
        controller.close();
      }, 90 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// ============================================================
// 헬퍼 함수
// ============================================================

const STEP_DESCRIPTIONS: Record<string, string> = {
  queued: '대기 중...',
  analyzing_prompt: '기획 데이터 분석 중...',
  designing_structure: '페이지 구조 설계 중...',
  generating_html: 'HTML 콘텐츠 생성 중...',
  applying_styles: '스타일 적용 중...',
  optimizing: '최적화 진행 중...',
  validating: '최종 검증 중...',
  completed: '완료!',
};

const STEP_ORDER = [
  'queued',
  'analyzing_prompt',
  'designing_structure',
  'generating_html',
  'applying_styles',
  'optimizing',
  'validating',
  'completed',
];

function getStepDescription(step: string): string {
  return STEP_DESCRIPTIONS[step] || '처리 중...';
}

function getCompletedSteps(currentStep: string): string[] {
  const currentIndex = STEP_ORDER.indexOf(currentStep);
  return STEP_ORDER.slice(0, currentIndex);
}

function calculateEstimatedTime(job: Record<string, unknown>): number | null {
  if (!job.started_at) return 90;

  const elapsed = Date.now() - new Date(job.started_at as string).getTime();
  const progress = (job.progress as number) || 1;
  const estimatedTotal = (elapsed / progress) * 100;
  const remaining = Math.max(0, estimatedTotal - elapsed);

  return Math.ceil(remaining / 1000);
}
```

### 4.3 Supabase Edge Function - 생성 워커

```typescript
// supabase/functions/generate-landing-page/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY')!,
});

serve(async (req: Request) => {
  try {
    const { jobId } = await req.json();

    // 1. 작업 조회
    const { data: job, error: jobError } = await supabase
      .from('generation_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      throw new Error('Job not found');
    }

    // 이미 처리 중이거나 완료된 작업 스킵
    if (job.status !== 'pending') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    // 2. 작업 시작 상태로 업데이트
    await updateJobStatus(jobId, 'processing', 5, 'analyzing_prompt');

    const { templateId, planningData, images, options } = job.input_data;

    // 3. 기획 데이터 분석
    await updateJobStatus(jobId, 'processing', 15, 'analyzing_prompt');
    const analysisPrompt = buildAnalysisPrompt(planningData);

    // 4. 구조 설계
    await updateJobStatus(jobId, 'processing', 25, 'designing_structure');

    // 5. AI로 HTML 생성
    await updateJobStatus(jobId, 'processing', 40, 'generating_html');

    const generationPrompt = buildGenerationPrompt(templateId, planningData, images, options);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16384,
      messages: [
        {
          role: 'user',
          content: generationPrompt,
        },
      ],
      system: LANDING_PAGE_SYSTEM_PROMPT,
    });

    const generatedContent = response.content[0].type === 'text'
      ? response.content[0].text
      : '';

    // 6. HTML/CSS 파싱
    await updateJobStatus(jobId, 'processing', 70, 'applying_styles');
    const { html, css, sections } = parseGeneratedContent(generatedContent);

    // 7. 최적화
    await updateJobStatus(jobId, 'processing', 85, 'optimizing');
    const optimizedHtml = optimizeHtml(html);
    const optimizedCss = optimizeCss(css);

    // 8. 검증
    await updateJobStatus(jobId, 'processing', 95, 'validating');
    const validationResult = validateGeneratedContent(optimizedHtml, optimizedCss);

    if (!validationResult.valid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    // 9. 랜딩페이지 업데이트
    const { error: updateError } = await supabase
      .from('landing_pages')
      .update({
        html: optimizedHtml,
        css: optimizedCss,
        sections,
        status: 'draft',
        metadata: {
          generated_at: new Date().toISOString(),
          generation_time: Date.now() - new Date(job.created_at).getTime(),
          tokens_used: response.usage.input_tokens + response.usage.output_tokens,
          ai_model: 'claude-sonnet-4-20250514',
          template_version: '1.0',
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.landing_page_id);

    if (updateError) {
      throw updateError;
    }

    // 10. 토큰 사용량 기록
    await supabase.from('ai_usage_logs').insert({
      user_id: job.user_id,
      feature: 'landing_page_generator',
      model: 'claude-sonnet-4-20250514',
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      cost_usd: calculateCost(response.usage),
    });

    // 11. 작업 완료
    await updateJobStatus(jobId, 'completed', 100, 'completed');

    // 12. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: job.user_id,
      action: 'landing_page.generate_completed',
      resource_type: 'landing_page',
      resource_id: job.landing_page_id,
      details: {
        jobId,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        generationTime: Date.now() - new Date(job.created_at).getTime(),
      },
    });

    return new Response(JSON.stringify({ success: true }), { status: 200 });

  } catch (error) {
    console.error('Generation error:', error);

    // 작업 실패 처리
    const { jobId } = await req.json().catch(() => ({}));
    if (jobId) {
      await supabase
        .from('generation_jobs')
        .update({
          status: 'failed',
          error: {
            code: 'ERR_LP_3002',
            message: error.message || '생성에 실패했습니다.',
            retryable: true,
          },
        })
        .eq('id', jobId);

      // 랜딩페이지 상태 롤백
      const { data: job } = await supabase
        .from('generation_jobs')
        .select('landing_page_id')
        .eq('id', jobId)
        .single();

      if (job) {
        await supabase
          .from('landing_pages')
          .update({ status: 'draft' })
          .eq('id', job.landing_page_id);
      }
    }

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});

// ============================================================
// 헬퍼 함수
// ============================================================

async function updateJobStatus(
  jobId: string,
  status: string,
  progress: number,
  currentStep: string
) {
  await supabase
    .from('generation_jobs')
    .update({
      status,
      progress,
      current_step: currentStep,
      started_at: status === 'processing' ? new Date().toISOString() : undefined,
    })
    .eq('id', jobId);
}

function calculateCost(usage: { input_tokens: number; output_tokens: number }): number {
  // Claude Sonnet 4 가격: $3/1M input, $15/1M output
  const inputCost = (usage.input_tokens / 1_000_000) * 3;
  const outputCost = (usage.output_tokens / 1_000_000) * 15;
  return inputCost + outputCost;
}

// 시스템 프롬프트 및 생성 프롬프트는 보안상 별도 관리
const LANDING_PAGE_SYSTEM_PROMPT = `
[SYSTEM] 당신은 마그네틱 세일즈 방법론을 적용한 고전환율 랜딩페이지 HTML/CSS 생성 전문가입니다.

## 역할
- 제공된 기획 데이터를 기반으로 반응형 랜딩페이지 HTML/CSS를 생성합니다.
- DESIRE-MAGNETIC 공식을 적용하여 전환 최적화된 카피를 작성합니다.
- 모바일 퍼스트 디자인을 적용합니다.

## 출력 형식
반드시 다음 형식으로 출력하세요:

\`\`\`html
<!-- HTML 코드 -->
\`\`\`

\`\`\`css
/* CSS 코드 */
\`\`\`

\`\`\`json
{
  "sections": [/* 섹션 메타데이터 */]
}
\`\`\`

## 제약 조건
- 외부 라이브러리 사용 금지 (순수 HTML/CSS만)
- 인라인 스크립트 금지
- 모든 이미지는 placeholder URL 사용
- 반응형 브레이크포인트: 375px, 768px, 1024px
`;

function buildGenerationPrompt(
  templateId: string,
  planningData: Record<string, unknown>,
  images: Array<{ id: string; type: string; url: string }>,
  options: Record<string, unknown>
): string {
  return `
## 템플릿
${templateId}

## 기획 데이터
${JSON.stringify(planningData, null, 2)}

## 이미지
${JSON.stringify(images, null, 2)}

## 옵션
${JSON.stringify(options, null, 2)}

위 정보를 기반으로 마그네틱 세일즈 방법론이 적용된 랜딩페이지 HTML/CSS를 생성하세요.
`;
}

function buildAnalysisPrompt(planningData: Record<string, unknown>): string {
  return `기획 데이터를 분석하여 핵심 메시지를 추출하세요:\n${JSON.stringify(planningData)}`;
}

function parseGeneratedContent(content: string): {
  html: string;
  css: string;
  sections: unknown[];
} {
  const htmlMatch = content.match(/```html\n([\s\S]*?)```/);
  const cssMatch = content.match(/```css\n([\s\S]*?)```/);
  const jsonMatch = content.match(/```json\n([\s\S]*?)```/);

  return {
    html: htmlMatch?.[1] || '',
    css: cssMatch?.[1] || '',
    sections: jsonMatch ? JSON.parse(jsonMatch[1]).sections : [],
  };
}

function optimizeHtml(html: string): string {
  // HTML 최적화 로직
  return html
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim();
}

function optimizeCss(css: string): string {
  // CSS 최적화 로직
  return css
    .replace(/\s+/g, ' ')
    .replace(/;\s*}/g, '}')
    .trim();
}

function validateGeneratedContent(
  html: string,
  css: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!html || html.length < 100) {
    errors.push('HTML content is too short');
  }

  if (!css || css.length < 50) {
    errors.push('CSS content is too short');
  }

  // XSS 패턴 검사
  const xssPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /data:\s*text\/html/i,
  ];

  for (const pattern of xssPatterns) {
    if (pattern.test(html)) {
      errors.push('Potentially dangerous content detected');
      break;
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
```

---

## 5. 이미지 업로드 시스템

### 5.1 이미지 업로드 API

```typescript
// src/app/api/images/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createErrorResponse } from '@/lib/api/error-response';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';

// 이미지 타입별 크기 설정
const IMAGE_SIZES: Record<string, { width: number; height: number; fit: 'cover' | 'contain' }> = {
  hero: { width: 1920, height: 1080, fit: 'cover' },
  profile: { width: 400, height: 400, fit: 'cover' },
  product: { width: 800, height: 800, fit: 'cover' },
  testimonial: { width: 200, height: 200, fit: 'cover' },
  background: { width: 1920, height: 1080, fit: 'cover' },
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// Magic bytes for file type verification
const MAGIC_BYTES: Record<string, number[]> = {
  'image/jpeg': [0xFF, 0xD8, 0xFF],
  'image/png': [0x89, 0x50, 0x4E, 0x47],
  'image/webp': [0x52, 0x49, 0x46, 0x46],
};

async function handler(req: AuthenticatedRequest) {
  if (req.method !== 'POST') {
    return createErrorResponse('ERR_SYS_9999', 'Method not allowed', 405);
  }

  const supabase = await createClient();

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const imageType = formData.get('imageType') as string;
    const landingPageId = formData.get('landingPageId') as string;
    const alt = formData.get('alt') as string | null;

    // 1. 기본 검증
    if (!file) {
      return createErrorResponse('ERR_LP_3005', '파일이 필요합니다.', 400);
    }

    if (!imageType || !IMAGE_SIZES[imageType]) {
      return createErrorResponse('ERR_LP_3005', '유효하지 않은 이미지 타입입니다.', 400);
    }

    if (!landingPageId) {
      return createErrorResponse('ERR_LP_3001', '랜딩페이지 ID가 필요합니다.', 400);
    }

    // 2. 파일 크기 검증
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse('ERR_LP_3004', '파일 크기는 5MB 이하여야 합니다.', 400);
    }

    // 3. MIME 타입 검증
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return createErrorResponse('ERR_LP_3005', 'JPG, PNG, WebP 형식만 지원합니다.', 400);
    }

    // 4. Magic bytes 검증
    const buffer = Buffer.from(await file.arrayBuffer());
    const isValidMagicBytes = verifyMagicBytes(buffer, file.type);

    if (!isValidMagicBytes) {
      return createErrorResponse('ERR_LP_3007', '유효하지 않은 파일 형식입니다.', 400);
    }

    // 5. 랜딩페이지 소유권 확인
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('id, user_id')
      .eq('id', landingPageId)
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .single();

    if (lpError || !landingPage) {
      return createErrorResponse('ERR_LP_3001', '랜딩페이지를 찾을 수 없습니다.', 404);
    }

    // 6. 스토리지 한도 확인 (프로젝트당 50MB)
    const { data: existingImages } = await supabase
      .from('landing_page_images')
      .select('optimized_size')
      .eq('landing_page_id', landingPageId);

    const totalSize = (existingImages || []).reduce(
      (sum, img) => sum + (img.optimized_size || 0), 0
    );

    if (totalSize + file.size > 50 * 1024 * 1024) {
      return createErrorResponse(
        'ERR_LP_3006',
        '스토리지 한도(50MB)에 도달했습니다. 기존 이미지를 삭제해주세요.',
        400
      );
    }

    // 7. 이미지 처리
    const imageId = uuidv4();
    const sizeConfig = IMAGE_SIZES[imageType];

    // EXIF 메타데이터 제거 + 리사이징
    const processedBuffer = await sharp(buffer)
      .rotate() // EXIF 방향 정보 적용 후 제거
      .resize(sizeConfig.width, sizeConfig.height, { fit: sizeConfig.fit })
      .toBuffer();

    // WebP 변환
    const webpBuffer = await sharp(processedBuffer)
      .webp({ quality: 85 })
      .toBuffer();

    // 썸네일 생성
    const thumbnailBuffer = await sharp(processedBuffer)
      .resize(200, 200, { fit: 'cover' })
      .webp({ quality: 70 })
      .toBuffer();

    // 8. Supabase Storage 업로드
    const basePath = `landing-pages/${landingPageId}`;

    // 원본 (처리됨)
    const { error: originalError } = await supabase.storage
      .from('images')
      .upload(`${basePath}/original/${imageId}.jpg`, processedBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1년
      });

    if (originalError) throw originalError;

    // WebP
    const { error: webpError } = await supabase.storage
      .from('images')
      .upload(`${basePath}/webp/${imageId}.webp`, webpBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
      });

    if (webpError) throw webpError;

    // 썸네일
    const { error: thumbError } = await supabase.storage
      .from('images')
      .upload(`${basePath}/thumbnails/${imageId}.webp`, thumbnailBuffer, {
        contentType: 'image/webp',
        cacheControl: '31536000',
      });

    if (thumbError) throw thumbError;

    // 9. 공개 URL 생성
    const { data: { publicUrl: originalUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(`${basePath}/original/${imageId}.jpg`);

    const { data: { publicUrl: webpUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(`${basePath}/webp/${imageId}.webp`);

    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(`${basePath}/thumbnails/${imageId}.webp`);

    // 10. 이미지 메타데이터 저장
    const imageMetadata = await sharp(processedBuffer).metadata();

    const { data: imageRecord, error: dbError } = await supabase
      .from('landing_page_images')
      .insert({
        id: imageId,
        landing_page_id: landingPageId,
        type: imageType,
        original_url: originalUrl,
        optimized_url: webpUrl,
        webp_url: webpUrl,
        thumbnail_url: thumbnailUrl,
        alt: alt || `${imageType} image`,
        original_size: file.size,
        optimized_size: webpBuffer.length,
        width: imageMetadata.width,
        height: imageMetadata.height,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 11. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'image.upload',
      resource_type: 'landing_page_image',
      resource_id: imageId,
      details: {
        landingPageId,
        imageType,
        originalSize: file.size,
        optimizedSize: webpBuffer.length,
        compressionRatio: ((1 - webpBuffer.length / file.size) * 100).toFixed(1),
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    });

    return NextResponse.json({
      success: true,
      image: {
        id: imageRecord.id,
        type: imageRecord.type,
        originalUrl: imageRecord.original_url,
        optimizedUrl: imageRecord.optimized_url,
        thumbnailUrl: imageRecord.thumbnail_url,
        alt: imageRecord.alt,
        originalSize: imageRecord.original_size,
        optimizedSize: imageRecord.optimized_size,
        compressionRatio: ((1 - imageRecord.optimized_size / imageRecord.original_size) * 100).toFixed(1),
        dimensions: {
          width: imageRecord.width,
          height: imageRecord.height,
        },
      },
    });

  } catch (error) {
    console.error('Image upload error:', error);
    return createErrorResponse('ERR_LP_3002', '이미지 업로드에 실패했습니다.');
  }
}

function verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const expectedBytes = MAGIC_BYTES[mimeType];
  if (!expectedBytes) return false;

  for (let i = 0; i < expectedBytes.length; i++) {
    if (buffer[i] !== expectedBytes[i]) return false;
  }
  return true;
}

export const POST = withRateLimit(withAuth(handler), {
  limit: 30,
  windowMs: 60 * 1000,
});
```

---

## 6. 미리보기 시스템

### 6.1 미리보기 API

```typescript
// src/app/api/landing-pages/[id]/preview/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { createErrorResponse } from '@/lib/api/error-response';
import { v4 as uuidv4 } from 'uuid';

async function handler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const landingPageId = params.id;

  try {
    // 1. 랜딩페이지 조회 및 권한 확인
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landingPageId)
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .single();

    if (lpError || !landingPage) {
      return createErrorResponse('ERR_LP_3001', '랜딩페이지를 찾을 수 없습니다.', 404);
    }

    if (!landingPage.html) {
      return createErrorResponse('ERR_LP_3001', '아직 생성되지 않은 랜딩페이지입니다.', 400);
    }

    // 2. 미리보기 토큰 생성 (24시간 유효)
    const previewToken = uuidv4();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('preview_tokens')
      .insert({
        token: previewToken,
        landing_page_id: landingPageId,
        user_id: req.user.id,
        expires_at: expiresAt,
      });

    // 3. 미리보기 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const previewUrl = `${baseUrl}/preview/${previewToken}`;

    return NextResponse.json({
      success: true,
      previewUrl,
      expiresAt,
      html: landingPage.html,
      css: landingPage.css,
    });

  } catch (error) {
    console.error('Preview generation error:', error);
    return createErrorResponse('ERR_LP_3001', '미리보기 생성에 실패했습니다.');
  }
}

export const GET = withAuth(handler);
```

### 6.2 미리보기 렌더링 컴포넌트

```typescript
// src/components/landing-page/PreviewFrame.tsx

'use client';

import React, { useRef, useEffect, useState } from 'react';
import { ViewMode, PreviewDimensions } from '@/types/landing-page';

interface PreviewFrameProps {
  html: string;
  css: string;
  viewMode: ViewMode;
  zoom: number;
  showGrid?: boolean;
}

const DIMENSIONS: PreviewDimensions = {
  desktop: { width: 1920, height: 1080 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

export function PreviewFrame({
  html,
  css,
  viewMode,
  zoom,
  showGrid = false,
}: PreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const dimensions = DIMENSIONS[viewMode];
  const scaledWidth = dimensions.width * (zoom / 100);
  const scaledHeight = dimensions.height * (zoom / 100);

  useEffect(() => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc) return;

    // DOMPurify로 HTML 정제 (보안)
    const sanitizedHtml = sanitizeHtml(html);
    const sanitizedCss = sanitizeCss(css);

    // 그리드 오버레이 CSS
    const gridCss = showGrid ? `
      body::before {
        content: '';
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-image:
          linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px);
        background-size: 20px 20px;
        pointer-events: none;
        z-index: 9999;
      }
    ` : '';

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          ${sanitizedCss}
          ${gridCss}
        </style>
      </head>
      <body>
        ${sanitizedHtml}
      </body>
      </html>
    `;

    doc.open();
    doc.write(fullHtml);
    doc.close();

    setIsLoaded(true);
  }, [html, css, showGrid]);

  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
      {/* 뷰모드 인디케이터 */}
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-white/90 px-3 py-1 rounded-full shadow-sm">
        <span className="text-xs font-medium text-gray-600">
          {viewMode === 'desktop' && '데스크톱'}
          {viewMode === 'tablet' && '태블릿'}
          {viewMode === 'mobile' && '모바일'}
        </span>
        <span className="text-xs text-gray-400">
          {dimensions.width} x {dimensions.height}
        </span>
      </div>

      {/* 디바이스 프레임 */}
      <div
        className="mx-auto transition-all duration-300 ease-in-out"
        style={{
          width: scaledWidth,
          height: scaledHeight,
          maxWidth: '100%',
          maxHeight: 'calc(100vh - 200px)',
        }}
      >
        {viewMode === 'mobile' && (
          <div className="relative bg-black rounded-[40px] p-3 shadow-2xl">
            {/* 노치 */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-10" />
            <iframe
              ref={iframeRef}
              className="w-full h-full bg-white rounded-[32px]"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
              }}
              sandbox="allow-same-origin"
              title="Landing Page Preview"
            />
          </div>
        )}

        {viewMode === 'tablet' && (
          <div className="relative bg-gray-800 rounded-[20px] p-4 shadow-2xl">
            <iframe
              ref={iframeRef}
              className="w-full h-full bg-white rounded-lg"
              style={{
                width: dimensions.width,
                height: dimensions.height,
                transform: `scale(${zoom / 100})`,
                transformOrigin: 'top left',
              }}
              sandbox="allow-same-origin"
              title="Landing Page Preview"
            />
          </div>
        )}

        {viewMode === 'desktop' && (
          <iframe
            ref={iframeRef}
            className="w-full h-full bg-white shadow-2xl rounded-lg"
            style={{
              width: dimensions.width,
              height: dimensions.height,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top left',
            }}
            sandbox="allow-same-origin"
            title="Landing Page Preview"
          />
        )}
      </div>

      {/* 로딩 오버레이 */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}
    </div>
  );
}

// HTML 정제 함수 (DOMPurify 대체)
function sanitizeHtml(html: string): string {
  // 위험한 태그/속성 제거
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data:\s*text\/html/gi, '');
}

function sanitizeCss(css: string): string {
  // CSS에서 위험한 패턴 제거
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/behavior\s*:/gi, '');
}
```

### 6.3 미리보기 컨트롤 컴포넌트

```typescript
// src/components/landing-page/PreviewControls.tsx

'use client';

import React from 'react';
import { ViewMode } from '@/types/landing-page';
import {
  Monitor,
  Tablet,
  Smartphone,
  Grid3X3,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Share2,
  Download,
} from 'lucide-react';

interface PreviewControlsProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  onShare: () => void;
  onFullscreen: () => void;
  onDownload: () => void;
}

export function PreviewControls({
  viewMode,
  onViewModeChange,
  zoom,
  onZoomChange,
  showGrid,
  onShowGridChange,
  onShare,
  onFullscreen,
  onDownload,
}: PreviewControlsProps) {
  const zoomLevels = [25, 50, 75, 100, 125, 150];

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
      {/* 뷰모드 선택 */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        <button
          onClick={() => onViewModeChange('desktop')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'desktop'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="데스크톱"
        >
          <Monitor className="w-5 h-5" />
        </button>
        <button
          onClick={() => onViewModeChange('tablet')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'tablet'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="태블릿"
        >
          <Tablet className="w-5 h-5" />
        </button>
        <button
          onClick={() => onViewModeChange('mobile')}
          className={`p-2 rounded-md transition-colors ${
            viewMode === 'mobile'
              ? 'bg-white shadow-sm text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="모바일"
        >
          <Smartphone className="w-5 h-5" />
        </button>
      </div>

      {/* 줌 컨트롤 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onZoomChange(Math.max(25, zoom - 25))}
          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          disabled={zoom <= 25}
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <select
          value={zoom}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="px-2 py-1 text-sm border border-gray-200 rounded-md"
        >
          {zoomLevels.map((level) => (
            <option key={level} value={level}>
              {level}%
            </option>
          ))}
        </select>

        <button
          onClick={() => onZoomChange(Math.min(150, zoom + 25))}
          className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50"
          disabled={zoom >= 150}
        >
          <ZoomIn className="w-4 h-4" />
        </button>
      </div>

      {/* 추가 컨트롤 */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onShowGridChange(!showGrid)}
          className={`p-2 rounded-md transition-colors ${
            showGrid
              ? 'bg-blue-100 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          title="그리드 표시"
        >
          <Grid3X3 className="w-5 h-5" />
        </button>

        <div className="w-px h-6 bg-gray-200" />

        <button
          onClick={onShare}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="공유"
        >
          <Share2 className="w-5 h-5" />
        </button>

        <button
          onClick={onDownload}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="다운로드"
        >
          <Download className="w-5 h-5" />
        </button>

        <button
          onClick={onFullscreen}
          className="p-2 text-gray-500 hover:text-gray-700"
          title="전체화면"
        >
          <Maximize2 className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
```

---

## 7. 배포 시스템

### 7.1 배포 API

```typescript
// src/app/api/landing-pages/[id]/deploy/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { deploymentSchema } from '@/lib/validations/landing-page';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { withRateLimit } from '@/lib/middleware/rate-limit';
import { createErrorResponse } from '@/lib/api/error-response';

async function handler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  if (req.method !== 'POST') {
    return createErrorResponse('ERR_SYS_9999', 'Method not allowed', 405);
  }

  const supabase = await createClient();
  const landingPageId = params.id;

  try {
    // 1. 요청 검증
    const body = await req.json();
    const validationResult = deploymentSchema.safeParse({
      ...body,
      landingPageId,
    });

    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      return createErrorResponse(
        'ERR_LP_3009',
        firstError.message,
        400
      );
    }

    const { slug, enableAnalytics, analyticsId, password } = validationResult.data;

    // 2. 랜딩페이지 조회 및 권한 확인
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landingPageId)
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .single();

    if (lpError || !landingPage) {
      return createErrorResponse('ERR_LP_3001', '랜딩페이지를 찾을 수 없습니다.', 404);
    }

    if (!landingPage.html) {
      return createErrorResponse('ERR_LP_3001', '아직 생성되지 않은 랜딩페이지입니다.', 400);
    }

    // 3. 슬러그 중복 확인 (전역)
    const { data: existingSlug, error: slugError } = await supabase
      .from('landing_pages')
      .select('id')
      .eq('slug', slug)
      .neq('id', landingPageId)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingSlug) {
      return createErrorResponse('ERR_LP_3008', '이미 사용 중인 URL입니다.', 400);
    }

    // 4. 삭제된 슬러그 예약 확인 (30일 이내)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: reservedSlug } = await supabase
      .from('landing_pages')
      .select('id')
      .eq('slug', slug)
      .not('deleted_at', 'is', null)
      .gte('deleted_at', thirtyDaysAgo)
      .maybeSingle();

    if (reservedSlug) {
      return createErrorResponse(
        'ERR_LP_3009',
        '이 URL은 최근 삭제된 페이지에서 사용되어 30일간 예약되어 있습니다.',
        400
      );
    }

    // 5. SEO 메타태그 자동 생성
    const seoConfig = generateSEOConfig(landingPage);

    // 6. 랜딩페이지 업데이트
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('landing_pages')
      .update({
        slug,
        status: 'published',
        published_at: now,
        seo_config: seoConfig,
        deployment_config: {
          enable_analytics: enableAnalytics,
          analytics_id: analyticsId,
          password_protected: !!password,
          password_hash: password ? await hashPassword(password) : null,
        },
        updated_at: now,
      })
      .eq('id', landingPageId);

    if (updateError) {
      console.error('Deployment update error:', updateError);
      return createErrorResponse('ERR_LP_3010', '배포에 실패했습니다.');
    }

    // 7. 배포 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const deployedUrl = `${baseUrl}/p/${slug}`;

    // 8. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'landing_page.deploy',
      resource_type: 'landing_page',
      resource_id: landingPageId,
      details: {
        slug,
        url: deployedUrl,
        enableAnalytics,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    });

    return NextResponse.json({
      success: true,
      deployedUrl,
      deployedAt: now,
      slug,
    });

  } catch (error) {
    console.error('Deploy error:', error);
    return createErrorResponse('ERR_LP_3010', '배포에 실패했습니다.');
  }
}

// ============================================================
// 헬퍼 함수
// ============================================================

function generateSEOConfig(landingPage: Record<string, unknown>) {
  // 랜딩페이지 콘텐츠에서 SEO 정보 추출
  const title = landingPage.title || '랜딩페이지';
  const html = landingPage.html as string || '';

  // 첫 번째 h1 태그에서 헤드라인 추출
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const headline = h1Match?.[1] || title;

  // 첫 번째 p 태그에서 설명 추출
  const pMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
  const description = pMatch?.[1]?.slice(0, 160) || `${title} - 마그네틱 세일즈 랜딩페이지`;

  return {
    title: headline.slice(0, 60),
    description: description.slice(0, 160),
    keywords: [],
    og_title: headline.slice(0, 60),
    og_description: description.slice(0, 200),
    og_image: null,
    canonical_url: null,
    no_index: false,
  };
}

async function hashPassword(password: string): Promise<string> {
  // bcrypt 사용 권장
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.PASSWORD_SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export const POST = withRateLimit(withAuth(handler), {
  limit: 20,
  windowMs: 60 * 1000,
});
```

### 7.2 공개 페이지 렌더링

```typescript
// src/app/p/[slug]/page.tsx

import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { PublishedLandingPage } from '@/components/landing-page/PublishedLandingPage';
import { PasswordGate } from '@/components/landing-page/PasswordGate';

interface PageProps {
  params: { slug: string };
}

// 동적 메타데이터
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient();

  const { data: landingPage } = await supabase
    .from('landing_pages')
    .select('title, seo_config')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (!landingPage) {
    return { title: 'Not Found' };
  }

  const seo = landingPage.seo_config || {};

  return {
    title: seo.title || landingPage.title,
    description: seo.description,
    keywords: seo.keywords?.join(', '),
    openGraph: {
      title: seo.og_title || seo.title,
      description: seo.og_description || seo.description,
      images: seo.og_image ? [seo.og_image] : [],
    },
    robots: seo.no_index ? 'noindex, nofollow' : 'index, follow',
  };
}

export default async function PublishedPage({ params }: PageProps) {
  const supabase = await createClient();

  // 랜딩페이지 조회
  const { data: landingPage, error } = await supabase
    .from('landing_pages')
    .select('*')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .is('deleted_at', null)
    .single();

  if (error || !landingPage) {
    notFound();
  }

  // 조회수 증가 (비동기)
  incrementPageView(landingPage.id).catch(console.error);

  // 비밀번호 보호 확인
  const deploymentConfig = landingPage.deployment_config || {};
  if (deploymentConfig.password_protected) {
    return (
      <PasswordGate
        landingPageId={landingPage.id}
        expectedHash={deploymentConfig.password_hash}
      >
        <PublishedLandingPage
          html={landingPage.html}
          css={landingPage.css}
          analyticsEnabled={deploymentConfig.enable_analytics}
          analyticsId={deploymentConfig.analytics_id}
        />
      </PasswordGate>
    );
  }

  return (
    <PublishedLandingPage
      html={landingPage.html}
      css={landingPage.css}
      analyticsEnabled={deploymentConfig.enable_analytics}
      analyticsId={deploymentConfig.analytics_id}
    />
  );
}

async function incrementPageView(landingPageId: string) {
  const supabase = await createClient();

  await supabase.rpc('increment_page_view', {
    p_landing_page_id: landingPageId,
  });
}
```

---

## 8. 섹션 편집 시스템

### 8.1 섹션 편집 API

```typescript
// src/app/api/landing-pages/[id]/sections/[sectionId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sectionEditSchema } from '@/lib/validations/landing-page';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { createErrorResponse } from '@/lib/api/error-response';
import DOMPurify from 'isomorphic-dompurify';

async function handler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string; sectionId: string } }
) {
  if (req.method !== 'PATCH') {
    return createErrorResponse('ERR_SYS_9999', 'Method not allowed', 405);
  }

  const supabase = await createClient();
  const { id: landingPageId, sectionId } = params;

  try {
    // 1. 요청 검증
    const body = await req.json();
    const validationResult = sectionEditSchema.safeParse({
      landingPageId,
      sectionId,
      content: body.content,
    });

    if (!validationResult.success) {
      return createErrorResponse(
        'ERR_LP_3001',
        '입력 데이터가 올바르지 않습니다.',
        400,
        validationResult.error.errors
      );
    }

    const { content } = validationResult.data;

    // 2. 랜딩페이지 조회 및 권한 확인
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landingPageId)
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .single();

    if (lpError || !landingPage) {
      return createErrorResponse('ERR_LP_3001', '랜딩페이지를 찾을 수 없습니다.', 404);
    }

    // 3. 섹션 존재 확인
    const sections = landingPage.sections as Array<{ id: string; content: unknown }>;
    const sectionIndex = sections.findIndex((s) => s.id === sectionId);

    if (sectionIndex === -1) {
      return createErrorResponse('ERR_LP_3001', '섹션을 찾을 수 없습니다.', 404);
    }

    // 4. 콘텐츠 정제 (XSS 방지)
    const sanitizedContent = sanitizeContent(content);

    // 5. 섹션 업데이트
    const updatedSections = [...sections];
    updatedSections[sectionIndex] = {
      ...updatedSections[sectionIndex],
      content: sanitizedContent,
    };

    // 6. HTML 재생성 (섹션 기반)
    const updatedHtml = regenerateHtml(updatedSections, landingPage.template_id);

    // 7. 데이터베이스 업데이트
    const { error: updateError } = await supabase
      .from('landing_pages')
      .update({
        sections: updatedSections,
        html: updatedHtml,
        version: landingPage.version + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', landingPageId);

    if (updateError) {
      console.error('Section update error:', updateError);
      return createErrorResponse('ERR_LP_3002', '섹션 수정에 실패했습니다.');
    }

    // 8. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'landing_page.section_edit',
      resource_type: 'landing_page',
      resource_id: landingPageId,
      details: {
        sectionId,
        version: landingPage.version + 1,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    });

    return NextResponse.json({
      success: true,
      section: updatedSections[sectionIndex],
      version: landingPage.version + 1,
    });

  } catch (error) {
    console.error('Section edit error:', error);
    return createErrorResponse('ERR_LP_3002', '섹션 수정에 실패했습니다.');
  }
}

// ============================================================
// 헬퍼 함수
// ============================================================

function sanitizeContent(content: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(content)) {
    if (typeof value === 'string') {
      // HTML 콘텐츠 정제
      sanitized[key] = DOMPurify.sanitize(value, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'br', 'p', 'span'],
        ALLOWED_ATTR: ['class'],
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
      });
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string'
          ? DOMPurify.sanitize(item, { ALLOWED_TAGS: ['b', 'i', 'em', 'strong'] })
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContent(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function regenerateHtml(
  sections: Array<{ id: string; sectionType: string; content: Record<string, unknown> }>,
  templateId: string
): string {
  // 섹션별 HTML 템플릿 적용
  const htmlParts = sections.map((section) => {
    return generateSectionHtml(section);
  });

  return `
    <main class="landing-page">
      ${htmlParts.join('\n')}
    </main>
  `;
}

function generateSectionHtml(section: {
  id: string;
  sectionType: string;
  content: Record<string, unknown>;
}): string {
  const { id, sectionType, content } = section;

  // 섹션 타입별 HTML 템플릿
  switch (sectionType) {
    case 'hero':
      return `
        <section id="${id}" class="section section-hero">
          <div class="container">
            ${content.headline ? `<h1 class="headline">${content.headline}</h1>` : ''}
            ${content.subheadline ? `<p class="subheadline">${content.subheadline}</p>` : ''}
            ${content.ctaText ? `<a href="${content.ctaUrl || '#'}" class="btn btn-primary">${content.ctaText}</a>` : ''}
          </div>
        </section>
      `;

    case 'problem':
      return `
        <section id="${id}" class="section section-problem">
          <div class="container">
            ${content.headline ? `<h2 class="headline">${content.headline}</h2>` : ''}
            ${content.bodyText ? `<p class="body-text">${content.bodyText}</p>` : ''}
            ${content.bulletPoints ? `
              <ul class="bullet-points">
                ${(content.bulletPoints as string[]).map(point => `<li>${point}</li>`).join('')}
              </ul>
            ` : ''}
          </div>
        </section>
      `;

    // 다른 섹션 타입들...
    default:
      return `
        <section id="${id}" class="section section-${sectionType}">
          <div class="container">
            ${Object.entries(content)
              .map(([key, value]) => `<div class="${key}">${value}</div>`)
              .join('\n')}
          </div>
        </section>
      `;
  }
}

export const PATCH = withAuth(handler);
```

---

## 9. 삭제 및 복구 시스템

### 9.1 Soft Delete API

```typescript
// src/app/api/landing-pages/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { createErrorResponse } from '@/lib/api/error-response';

// DELETE: Soft Delete
async function deleteHandler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const landingPageId = params.id;

  try {
    // 1. 랜딩페이지 조회 및 권한 확인
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('id, user_id, slug, status')
      .eq('id', landingPageId)
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .single();

    if (lpError || !landingPage) {
      return createErrorResponse('ERR_LP_3001', '랜딩페이지를 찾을 수 없습니다.', 404);
    }

    // 2. Soft Delete 수행
    const { error: deleteError } = await supabase
      .from('landing_pages')
      .update({
        deleted_at: new Date().toISOString(),
        status: 'unpublished',
        // 슬러그는 30일간 예약 상태 유지를 위해 보존
      })
      .eq('id', landingPageId);

    if (deleteError) {
      console.error('Soft delete error:', deleteError);
      return createErrorResponse('ERR_LP_3010', '삭제에 실패했습니다.');
    }

    // 3. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'landing_page.soft_delete',
      resource_type: 'landing_page',
      resource_id: landingPageId,
      details: {
        previousStatus: landingPage.status,
        slug: landingPage.slug,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    });

    return NextResponse.json({
      success: true,
      message: '랜딩페이지가 삭제되었습니다. 30일 내에 복구할 수 있습니다.',
      recoveryDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

  } catch (error) {
    console.error('Delete error:', error);
    return createErrorResponse('ERR_LP_3010', '삭제에 실패했습니다.');
  }
}

export const DELETE = withAuth(deleteHandler);
```

### 9.2 복구 API

```typescript
// src/app/api/landing-pages/[id]/restore/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware/auth';
import { createErrorResponse } from '@/lib/api/error-response';

async function handler(
  req: AuthenticatedRequest,
  { params }: { params: { id: string } }
) {
  if (req.method !== 'POST') {
    return createErrorResponse('ERR_SYS_9999', 'Method not allowed', 405);
  }

  const supabase = await createClient();
  const landingPageId = params.id;

  try {
    // 1. 삭제된 랜딩페이지 조회
    const { data: landingPage, error: lpError } = await supabase
      .from('landing_pages')
      .select('*')
      .eq('id', landingPageId)
      .eq('user_id', req.user.id)
      .not('deleted_at', 'is', null)
      .single();

    if (lpError || !landingPage) {
      return createErrorResponse('ERR_LP_3001', '삭제된 랜딩페이지를 찾을 수 없습니다.', 404);
    }

    // 2. 30일 이내인지 확인
    const deletedAt = new Date(landingPage.deleted_at);
    const thirtyDaysLater = new Date(deletedAt.getTime() + 30 * 24 * 60 * 60 * 1000);

    if (new Date() > thirtyDaysLater) {
      return createErrorResponse(
        'ERR_LP_3001',
        '복구 기간(30일)이 지났습니다.',
        400
      );
    }

    // 3. 슬러그 충돌 확인 (복구 시점에 다른 페이지가 사용 중일 수 있음)
    if (landingPage.slug) {
      const { data: conflictingPage } = await supabase
        .from('landing_pages')
        .select('id')
        .eq('slug', landingPage.slug)
        .neq('id', landingPageId)
        .is('deleted_at', null)
        .maybeSingle();

      if (conflictingPage) {
        // 슬러그 충돌 시 슬러그 제거 후 복구
        landingPage.slug = null;
      }
    }

    // 4. 복구 수행
    const { error: restoreError } = await supabase
      .from('landing_pages')
      .update({
        deleted_at: null,
        status: 'draft', // 복구 후 초안 상태
        slug: landingPage.slug, // 충돌 시 null
        updated_at: new Date().toISOString(),
      })
      .eq('id', landingPageId);

    if (restoreError) {
      console.error('Restore error:', restoreError);
      return createErrorResponse('ERR_LP_3010', '복구에 실패했습니다.');
    }

    // 5. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: req.user.id,
      action: 'landing_page.restore',
      resource_type: 'landing_page',
      resource_id: landingPageId,
      details: {
        slugRestored: !!landingPage.slug,
      },
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
    });

    return NextResponse.json({
      success: true,
      message: '랜딩페이지가 복구되었습니다.',
      slugConflict: landingPage.slug === null,
    });

  } catch (error) {
    console.error('Restore error:', error);
    return createErrorResponse('ERR_LP_3010', '복구에 실패했습니다.');
  }
}

export const POST = withAuth(handler);
```

---

## 10. 클라이언트 상태 관리

### 10.1 Zustand 스토어

```typescript
// src/stores/landing-page-store.ts

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  LandingPage,
  ViewMode,
  GenerationProgress,
  LandingPageSection,
} from '@/types/landing-page';

interface LandingPageState {
  // 현재 작업 중인 랜딩페이지
  currentLandingPage: LandingPage | null;

  // 미리보기 설정
  viewMode: ViewMode;
  zoom: number;
  showGrid: boolean;

  // 생성 상태
  isGenerating: boolean;
  generationProgress: GenerationProgress | null;

  // 편집 상태
  editingSection: string | null;
  hasUnsavedChanges: boolean;

  // 에러
  error: { code: string; message: string } | null;
}

interface LandingPageActions {
  // 랜딩페이지 관리
  setCurrentLandingPage: (lp: LandingPage | null) => void;
  updateLandingPage: (updates: Partial<LandingPage>) => void;

  // 미리보기 설정
  setViewMode: (mode: ViewMode) => void;
  setZoom: (zoom: number) => void;
  toggleGrid: () => void;

  // 생성 관리
  startGeneration: (jobId: string) => void;
  updateGenerationProgress: (progress: GenerationProgress) => void;
  finishGeneration: (landingPage: LandingPage) => void;
  cancelGeneration: () => void;

  // 섹션 편집
  startEditingSection: (sectionId: string) => void;
  cancelEditingSection: () => void;
  updateSection: (sectionId: string, content: Record<string, unknown>) => void;

  // 에러 관리
  setError: (error: { code: string; message: string } | null) => void;
  clearError: () => void;

  // 상태 초기화
  reset: () => void;
}

const initialState: LandingPageState = {
  currentLandingPage: null,
  viewMode: 'desktop',
  zoom: 100,
  showGrid: false,
  isGenerating: false,
  generationProgress: null,
  editingSection: null,
  hasUnsavedChanges: false,
  error: null,
};

export const useLandingPageStore = create<LandingPageState & LandingPageActions>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        setCurrentLandingPage: (lp) =>
          set((state) => {
            state.currentLandingPage = lp;
            state.hasUnsavedChanges = false;
            state.editingSection = null;
          }),

        updateLandingPage: (updates) =>
          set((state) => {
            if (state.currentLandingPage) {
              Object.assign(state.currentLandingPage, updates);
              state.hasUnsavedChanges = true;
            }
          }),

        setViewMode: (mode) =>
          set((state) => {
            state.viewMode = mode;
          }),

        setZoom: (zoom) =>
          set((state) => {
            state.zoom = Math.min(150, Math.max(25, zoom));
          }),

        toggleGrid: () =>
          set((state) => {
            state.showGrid = !state.showGrid;
          }),

        startGeneration: (jobId) =>
          set((state) => {
            state.isGenerating = true;
            state.generationProgress = {
              jobId,
              status: 'pending',
              progress: 0,
              currentStep: 'queued',
              stepDescription: '대기 중...',
              estimatedTimeRemaining: 90,
              completedSteps: [],
            };
            state.error = null;
          }),

        updateGenerationProgress: (progress) =>
          set((state) => {
            state.generationProgress = progress;
          }),

        finishGeneration: (landingPage) =>
          set((state) => {
            state.isGenerating = false;
            state.generationProgress = null;
            state.currentLandingPage = landingPage;
          }),

        cancelGeneration: () =>
          set((state) => {
            state.isGenerating = false;
            state.generationProgress = null;
          }),

        startEditingSection: (sectionId) =>
          set((state) => {
            state.editingSection = sectionId;
          }),

        cancelEditingSection: () =>
          set((state) => {
            state.editingSection = null;
          }),

        updateSection: (sectionId, content) =>
          set((state) => {
            if (state.currentLandingPage) {
              const sectionIndex = state.currentLandingPage.sections.findIndex(
                (s) => s.id === sectionId
              );
              if (sectionIndex !== -1) {
                state.currentLandingPage.sections[sectionIndex].content = content;
                state.hasUnsavedChanges = true;
              }
            }
          }),

        setError: (error) =>
          set((state) => {
            state.error = error;
          }),

        clearError: () =>
          set((state) => {
            state.error = null;
          }),

        reset: () => set(initialState),
      })),
      {
        name: 'landing-page-store',
        partialize: (state) => ({
          viewMode: state.viewMode,
          zoom: state.zoom,
          showGrid: state.showGrid,
        }),
      }
    ),
    { name: 'LandingPageStore' }
  )
);
```

### 10.2 생성 프로그레스 훅

```typescript
// src/hooks/useGenerationProgress.ts

import { useEffect, useCallback, useRef } from 'react';
import { useLandingPageStore } from '@/stores/landing-page-store';
import { GenerationProgress } from '@/types/landing-page';

interface UseGenerationProgressOptions {
  onComplete?: (landingPageId: string) => void;
  onError?: (error: { code: string; message: string }) => void;
  onTimeout?: () => void;
}

export function useGenerationProgress(
  jobId: string | null,
  options: UseGenerationProgressOptions = {}
) {
  const { onComplete, onError, onTimeout } = options;
  const eventSourceRef = useRef<EventSource | null>(null);

  const {
    isGenerating,
    generationProgress,
    updateGenerationProgress,
    finishGeneration,
    cancelGeneration,
    setError,
  } = useLandingPageStore();

  const connect = useCallback(() => {
    if (!jobId || eventSourceRef.current) return;

    const eventSource = new EventSource(`/api/generate/${jobId}/status`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'status') {
          updateGenerationProgress(data as GenerationProgress);
        } else if (data.type === 'final') {
          if (data.status === 'completed') {
            // 완료된 랜딩페이지 데이터 가져오기
            const response = await fetch(`/api/landing-pages/${data.landingPageId}`);
            if (response.ok) {
              const { landingPage } = await response.json();
              finishGeneration(landingPage);
              onComplete?.(data.landingPageId);
            }
          } else if (data.status === 'failed') {
            setError(data.error || { code: 'ERR_LP_3002', message: '생성에 실패했습니다.' });
            cancelGeneration();
            onError?.(data.error);
          }
          disconnect();
        } else if (data.type === 'timeout') {
          cancelGeneration();
          onTimeout?.();
          disconnect();
        }
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      disconnect();
      // 재연결 시도
      setTimeout(() => {
        if (isGenerating) connect();
      }, 3000);
    };
  }, [jobId, isGenerating, updateGenerationProgress, finishGeneration, cancelGeneration, setError, onComplete, onError, onTimeout]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (jobId && isGenerating) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [jobId, isGenerating, connect, disconnect]);

  return {
    isGenerating,
    progress: generationProgress,
    disconnect,
  };
}
```

---

## 11. 의존성 및 연동

### 11.1 문서 의존성

```yaml
의존_문서:
  필수:
    - 03_PRD_프로젝트구조.md: 폴더/파일 구조
    - 05_PRD_AI기획도우미.md: 기획 데이터 입력
    - 08_PRD_데이터베이스.md: landing_pages, generation_jobs 테이블
    - 09_PRD_API명세.md: API 엔드포인트 정의

  참조:
    - 10_PRD_보안구현.md: XSS 방지, 이미지 검증
    - 11_PRD_에러처리.md: 에러 코드 체계
```

### 11.2 외부 의존성

```yaml
NPM_패키지:
  sharp: "0.33.x"  # 이미지 처리
  isomorphic-dompurify: "2.x"  # HTML 정제
  uuid: "9.x"  # UUID 생성
  zod: "3.x"  # 스키마 검증

Supabase:
  Storage: 이미지 저장
  Realtime: 생성 진행 상태 구독
  Edge_Functions: 비동기 생성 워커

Claude_API:
  Model: claude-sonnet-4-20250514
  max_tokens: 16384
```

---

## 12. 에러 코드 정의

```typescript
// src/lib/errors/landing-page-errors.ts

export const LANDING_PAGE_ERRORS = {
  // 입력 관련 (3001-3009)
  ERR_LP_3001: '입력 데이터가 올바르지 않습니다.',
  ERR_LP_3002: '랜딩페이지 생성에 실패했습니다.',
  ERR_LP_3003: '생성 시간이 초과되었습니다.',
  ERR_LP_3004: '파일 크기는 5MB 이하여야 합니다.',
  ERR_LP_3005: 'JPG, PNG, WebP 형식만 지원합니다.',
  ERR_LP_3006: '스토리지 한도에 도달했습니다.',
  ERR_LP_3007: '유효하지 않은 파일 형식입니다.',
  ERR_LP_3008: '이미 사용 중인 URL입니다.',
  ERR_LP_3009: '사용할 수 없는 URL입니다.',
  ERR_LP_3010: '배포에 실패했습니다.',
} as const;

export type LandingPageErrorCode = keyof typeof LANDING_PAGE_ERRORS;
```

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-01-15 | 초기 작성 | CTO |
