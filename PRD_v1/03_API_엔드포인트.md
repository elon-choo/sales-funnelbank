# API 엔드포인트 PRD

## 문서 정보

| 항목 | 내용 |
|------|------|
| 버전 | PRD v1.0 |
| 작성일 | 2025-01-15 |
| 관련 기획 | 기획_v2/05_API_설계_v2.md |

---

## 1. 개요

### 1.1 API 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                        클라이언트                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Middleware                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │    CORS     │  │ Rate Limit  │  │  Security   │        │
│  │  Whitelist  │  │   Check     │  │  Headers    │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Routes (/api/*)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  /auth   │ │   /ai    │ │   /lp    │ │  /admin  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       Supabase                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │   Auth   │ │ Database │ │ Storage  │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 엔드포인트 목록

| Method | Endpoint | 설명 | 인증 |
|--------|----------|------|------|
| POST | /api/auth/signup | 회원가입 | - |
| POST | /api/auth/login | 로그인 | - |
| POST | /api/auth/logout | 로그아웃 | O |
| POST | /api/auth/refresh | 토큰 갱신 | Cookie |
| GET | /api/auth/me | 내 정보 | O |
| GET | /api/lp | 랜딩페이지 목록 | O |
| POST | /api/lp | 랜딩페이지 생성 | O |
| GET | /api/lp/:id | 랜딩페이지 상세 | O |
| PATCH | /api/lp/:id | 랜딩페이지 수정 | O |
| DELETE | /api/lp/:id | 랜딩페이지 삭제 | O |
| POST | /api/lp/:id/restore | 랜딩페이지 복구 | O |
| GET | /api/lp/deleted | 삭제된 목록 | O |
| POST | /api/ai/generate | AI 생성 | O |
| GET | /api/ai/tokens | 토큰 조회 | O |
| GET | /api/admin/users | 사용자 목록 | Admin |
| POST | /api/admin/users/:id/approve | 사용자 승인 | Admin |
| GET | /api/admin/audit-logs | 감사 로그 | Admin |

---

## 2. 파일 구조

```
src/
├── app/
│   └── api/
│       ├── auth/
│       │   ├── signup/route.ts
│       │   ├── login/route.ts
│       │   ├── logout/route.ts
│       │   ├── refresh/route.ts
│       │   └── me/route.ts
│       │
│       ├── lp/
│       │   ├── route.ts              # GET (목록), POST (생성)
│       │   ├── [id]/
│       │   │   ├── route.ts          # GET, PATCH, DELETE
│       │   │   └── restore/route.ts  # POST (복구)
│       │   └── deleted/route.ts      # GET (삭제된 목록)
│       │
│       ├── ai/
│       │   ├── generate/route.ts
│       │   └── tokens/route.ts
│       │
│       └── admin/
│           ├── users/
│           │   ├── route.ts
│           │   └── [id]/
│           │       └── approve/route.ts
│           └── audit-logs/route.ts
│
├── lib/
│   ├── security/
│   │   ├── cors.ts
│   │   └── rate-limit.ts
│   │
│   └── utils/
│       ├── errors.ts
│       └── validators.ts
│
└── middleware.ts
```

---

## 3. CORS 미들웨어

### 3.1 CORS 설정

```typescript
// src/lib/security/cors.ts

/**
 * CORS 화이트리스트 (와일드카드 금지!)
 */
export function getAllowedOrigins(): string[] {
  const baseOrigins = [
    'https://magnetic-sales.vercel.app',
    'https://www.magnetic-sales.com',
  ];

  // 환경변수에서 추가 도메인 로드
  const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS?.split(',').filter(Boolean) || [];

  // 개발 환경
  if (process.env.NODE_ENV === 'development') {
    return [...baseOrigins, 'http://localhost:3000', ...additionalOrigins];
  }

  return [...baseOrigins, ...additionalOrigins];
}

/**
 * Origin 검증
 */
export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  return getAllowedOrigins().includes(origin);
}

/**
 * CORS 헤더 생성
 */
export function getCorsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-ID',
    'Access-Control-Max-Age': '86400',
  };
}
```

### 3.2 Next.js 미들웨어

```typescript
// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAllowedOrigin, getCorsHeaders } from '@/lib/security/cors';
import { createAdminClient } from '@/lib/supabase/admin';

export async function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const pathname = request.nextUrl.pathname;

  // API Routes만 처리
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // 1. CORS 검증
  if (origin) {
    if (!isAllowedOrigin(origin)) {
      console.warn(`CORS blocked: ${origin}`);

      // 감사 로그 (비동기)
      logSecurityEvent('cors_blocked', { origin, pathname });

      return new NextResponse(
        JSON.stringify({
          success: false,
          error: {
            code: 'GEN_003',
            message: '접근 권한이 없습니다',
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  } else {
    // origin이 없는 경우 Sec-Fetch-Site 검증
    const fetchSite = request.headers.get('sec-fetch-site');

    if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
      console.warn(`Suspicious request without origin: ${fetchSite}`);
      return new NextResponse(null, { status: 403 });
    }
  }

  // 2. Preflight 요청 처리
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: origin ? getCorsHeaders(origin) : {},
    });
  }

  // 3. 응답 생성
  const response = NextResponse.next();

  // CORS 헤더 추가
  if (origin) {
    const corsHeaders = getCorsHeaders(origin);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }

  // 보안 헤더 추가
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

// 감사 로그 (비동기)
async function logSecurityEvent(action: string, details: Record<string, any>) {
  try {
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      action,
      details,
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}
```

---

## 4. Rate Limiting

### 4.1 Rate Limit 유틸리티

```typescript
// src/lib/security/rate-limit.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': { limit: 5, windowSeconds: 60 },
  '/api/auth/signup': { limit: 3, windowSeconds: 60 },
  '/api/auth/refresh': { limit: 10, windowSeconds: 60 },
  '/api/ai/generate': { limit: 10, windowSeconds: 60 },
  '/api/lp': { limit: 30, windowSeconds: 60 },
  'default': { limit: 60, windowSeconds: 60 },
};

interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}

/**
 * Rate Limit 체크 (Supabase PostgreSQL 기반)
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS['default'];

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    });

    if (error) {
      console.error('Rate limit check failed:', error);
      // 에러 시 허용 (fail-open)
      return {
        allowed: true,
        current: 0,
        limit: config.limit,
        remaining: config.limit,
        resetAt: new Date(),
      };
    }

    return {
      allowed: data.allowed,
      current: data.current,
      limit: data.limit,
      remaining: data.remaining || 0,
      resetAt: new Date(data.reset_at),
    };
  } catch (error) {
    console.error('Rate limit error:', error);
    return {
      allowed: true,
      current: 0,
      limit: config.limit,
      remaining: config.limit,
      resetAt: new Date(),
    };
  }
}

/**
 * Rate Limit 미들웨어 래퍼
 */
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  // IP 추출
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  // 인증된 사용자의 경우 user_id 사용
  const userId = request.headers.get('x-user-id');
  const identifier = userId || ip;

  const endpoint = new URL(request.url).pathname;

  const result = await checkRateLimit(identifier, endpoint);

  if (!result.allowed) {
    const retryAfter = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);

    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'RATE_001',
          message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
        },
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.resetAt.toISOString(),
          'Retry-After': retryAfter.toString(),
        },
      }
    );
  }

  const response = await handler();

  // Rate Limit 헤더 추가
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set('X-RateLimit-Reset', result.resetAt.toISOString());

  return response;
}
```

---

## 5. 공통 유틸리티

### 5.1 에러 코드 정의

```typescript
// src/lib/utils/errors.ts

export const ERROR_CODES = {
  // 인증 에러 (AUTH)
  AUTH_001: { status: 401, message: '이메일 또는 비밀번호를 확인해주세요' },
  AUTH_002: { status: 403, message: '관리자 승인 대기 중입니다' },
  AUTH_003: { status: 401, message: '세션이 만료되었습니다' },
  AUTH_004: { status: 401, message: '보안 문제가 감지되었습니다. 다시 로그인해주세요' },
  AUTH_005: { status: 409, message: '이미 가입된 이메일입니다' },
  AUTH_006: { status: 403, message: '탈퇴한 계정입니다' },

  // 토큰 에러 (TOKEN)
  TOKEN_001: { status: 429, message: '토큰이 부족합니다' },
  TOKEN_002: { status: 429, message: '오늘의 사용량을 모두 소진했습니다' },

  // 랜딩페이지 에러 (LP)
  LP_001: { status: 404, message: '랜딩페이지를 찾을 수 없습니다' },
  LP_002: { status: 410, message: '복구 기간(30일)이 만료되었습니다' },
  LP_003: { status: 429, message: '랜딩페이지 수 제한을 초과했습니다' },

  // AI 에러 (AI)
  AI_001: { status: 500, message: '생성에 실패했습니다' },
  AI_002: { status: 408, message: '요청 시간이 초과되었습니다' },

  // Rate Limit 에러 (RATE)
  RATE_001: { status: 429, message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' },

  // 일반 에러 (GEN)
  GEN_001: { status: 500, message: '서비스 연결에 문제가 있습니다' },
  GEN_002: { status: 400, message: '잘못된 요청입니다' },
  GEN_003: { status: 403, message: '접근 권한이 없습니다' },
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * API 에러 응답 생성
 */
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  reference?: string
) {
  const errorInfo = ERROR_CODES[code];

  return {
    success: false,
    error: {
      code,
      message: customMessage || errorInfo.message,
      ...(reference && { reference }),
    },
  };
}

/**
 * 에러 참조 ID 생성
 */
export function generateErrorReference(): string {
  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ERR-${timestamp}-${random}`;
}
```

### 5.2 공통 검증 스키마

```typescript
// src/lib/utils/validators.ts

import { z } from 'zod';

// 페이지네이션
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// UUID
export const uuidSchema = z.string().uuid();

// 랜딩페이지 상태
export const lpStatusSchema = z.enum(['draft', 'published', 'archived']);

// 랜딩페이지 생성
export const createLPSchema = z.object({
  title: z.string().min(1).max(200),
  qaSessionId: z.string().uuid().optional(),
});

// 랜딩페이지 수정
export const updateLPSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.record(z.any()).optional(),
  status: lpStatusSchema.optional(),
});

// 토큰 사용량 조회 쿼리
export const tokenUsageQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});
```

---

## 6. 랜딩페이지 API 구현

### 6.1 목록 조회 & 생성

```typescript
// src/app/api/lp/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth, type AuthResult } from '@/lib/auth/middleware';
import { withRateLimit } from '@/lib/security/rate-limit';
import { createErrorResponse, generateErrorReference } from '@/lib/utils/errors';
import { paginationSchema, createLPSchema } from '@/lib/utils/validators';

/**
 * GET /api/lp - 랜딩페이지 목록 조회
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  return withRateLimit(request, async () => {
    try {
      const { searchParams } = new URL(request.url);

      const { page, limit } = paginationSchema.parse({
        page: searchParams.get('page'),
        limit: searchParams.get('limit'),
      });

      const status = searchParams.get('status') || 'all';
      const offset = (page - 1) * limit;

      const supabase = createAdminClient();

      // 기본 쿼리
      let query = supabase
        .from('landing_pages')
        .select('id, title, status, slug, published_url, created_at, updated_at', { count: 'exact' })
        .eq('user_id', auth.userId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // 상태 필터
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, count, error } = await query;

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: data.map((lp) => ({
          id: lp.id,
          title: lp.title,
          status: lp.status,
          slug: lp.slug,
          publishedUrl: lp.published_url,
          createdAt: lp.created_at,
          updatedAt: lp.updated_at,
        })),
        meta: {
          page,
          limit,
          total: count || 0,
        },
      });
    } catch (error) {
      console.error('GET /api/lp error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', undefined, generateErrorReference()),
        { status: 500 }
      );
    }
  });
});

/**
 * POST /api/lp - 랜딩페이지 생성
 */
export const POST = withAuth(async (request: NextRequest, auth: AuthResult) => {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json();
      const validationResult = createLPSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          createErrorResponse('GEN_002', validationResult.error.errors[0].message),
          { status: 400 }
        );
      }

      const { title, qaSessionId } = validationResult.data;
      const supabase = createAdminClient();

      // 랜딩페이지 수 제한 확인 (FREE: 3개)
      const { count } = await supabase
        .from('landing_pages')
        .select('id', { count: 'exact' })
        .eq('user_id', auth.userId)
        .is('deleted_at', null);

      const maxPages = auth.tier === 'FREE' ? 3 : Infinity;

      if ((count || 0) >= maxPages) {
        return NextResponse.json(
          createErrorResponse('LP_003'),
          { status: 429 }
        );
      }

      // 랜딩페이지 생성
      const { data, error } = await supabase
        .from('landing_pages')
        .insert({
          user_id: auth.userId,
          title,
          qa_session_id: qaSessionId || null,
          content: {},
          status: 'draft',
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // 감사 로그
      await supabase.from('audit_logs').insert({
        user_id: auth.userId,
        action: 'landing_page_created',
        details: { landing_page_id: data.id, title },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            id: data.id,
            title: data.title,
            status: data.status,
            createdAt: data.created_at,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('POST /api/lp error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', undefined, generateErrorReference()),
        { status: 500 }
      );
    }
  });
});
```

### 6.2 상세 조회 & 수정 & 삭제

```typescript
// src/app/api/lp/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth, type AuthResult } from '@/lib/auth/middleware';
import { withRateLimit } from '@/lib/security/rate-limit';
import { createErrorResponse, generateErrorReference } from '@/lib/utils/errors';
import { uuidSchema, updateLPSchema } from '@/lib/utils/validators';

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/lp/:id - 랜딩페이지 상세 조회
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthResult, { params }: RouteParams) => {
  return withRateLimit(request, async () => {
    try {
      const idValidation = uuidSchema.safeParse(params.id);
      if (!idValidation.success) {
        return NextResponse.json(createErrorResponse('LP_001'), { status: 404 });
      }

      const supabase = createAdminClient();

      const { data, error } = await supabase
        .from('landing_pages')
        .select('*, qa_sessions(answers, current_step, status)')
        .eq('id', params.id)
        .eq('user_id', auth.userId)
        .is('deleted_at', null)
        .single();

      if (error || !data) {
        return NextResponse.json(createErrorResponse('LP_001'), { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: {
          id: data.id,
          title: data.title,
          content: data.content,
          status: data.status,
          slug: data.slug,
          publishedUrl: data.published_url,
          qaSession: data.qa_sessions,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      });
    } catch (error) {
      console.error('GET /api/lp/:id error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', undefined, generateErrorReference()),
        { status: 500 }
      );
    }
  });
});

/**
 * PATCH /api/lp/:id - 랜딩페이지 수정
 */
export const PATCH = withAuth(async (request: NextRequest, auth: AuthResult, { params }: RouteParams) => {
  return withRateLimit(request, async () => {
    try {
      const idValidation = uuidSchema.safeParse(params.id);
      if (!idValidation.success) {
        return NextResponse.json(createErrorResponse('LP_001'), { status: 404 });
      }

      const body = await request.json();
      const validationResult = updateLPSchema.safeParse(body);

      if (!validationResult.success) {
        return NextResponse.json(
          createErrorResponse('GEN_002', validationResult.error.errors[0].message),
          { status: 400 }
        );
      }

      const supabase = createAdminClient();

      // 소유권 확인
      const { data: existing } = await supabase
        .from('landing_pages')
        .select('id, user_id, status')
        .eq('id', params.id)
        .is('deleted_at', null)
        .single();

      if (!existing || existing.user_id !== auth.userId) {
        return NextResponse.json(createErrorResponse('LP_001'), { status: 404 });
      }

      // 업데이트
      const updateData: Record<string, any> = {};
      if (validationResult.data.title) updateData.title = validationResult.data.title;
      if (validationResult.data.content) updateData.content = validationResult.data.content;
      if (validationResult.data.status) updateData.status = validationResult.data.status;

      const { data, error } = await supabase
        .from('landing_pages')
        .update(updateData)
        .eq('id', params.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // 감사 로그
      await supabase.from('audit_logs').insert({
        user_id: auth.userId,
        action: 'landing_page_updated',
        details: { landing_page_id: params.id, changes: Object.keys(updateData) },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
      });

      return NextResponse.json({
        success: true,
        data: {
          id: data.id,
          title: data.title,
          status: data.status,
          updatedAt: data.updated_at,
        },
      });
    } catch (error) {
      console.error('PATCH /api/lp/:id error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', undefined, generateErrorReference()),
        { status: 500 }
      );
    }
  });
});

/**
 * DELETE /api/lp/:id - 랜딩페이지 삭제 (Soft Delete)
 */
export const DELETE = withAuth(async (request: NextRequest, auth: AuthResult, { params }: RouteParams) => {
  return withRateLimit(request, async () => {
    try {
      const idValidation = uuidSchema.safeParse(params.id);
      if (!idValidation.success) {
        return NextResponse.json(createErrorResponse('LP_001'), { status: 404 });
      }

      const supabase = createAdminClient();

      // 소유권 확인
      const { data: existing } = await supabase
        .from('landing_pages')
        .select('id, user_id, status')
        .eq('id', params.id)
        .is('deleted_at', null)
        .single();

      if (!existing || existing.user_id !== auth.userId) {
        return NextResponse.json(createErrorResponse('LP_001'), { status: 404 });
      }

      // Soft Delete
      const deletedAt = new Date().toISOString();
      await supabase
        .from('landing_pages')
        .update({ deleted_at: deletedAt })
        .eq('id', params.id);

      // 감사 로그
      await supabase.from('audit_logs').insert({
        user_id: auth.userId,
        action: 'landing_page_deleted',
        details: { landing_page_id: params.id },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
      });

      const recoveryDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      return NextResponse.json({
        success: true,
        data: {
          message: '삭제되었습니다. 30일 이내 복구 가능합니다.',
          deletedAt,
          recoveryDeadline: recoveryDeadline.toISOString(),
        },
      });
    } catch (error) {
      console.error('DELETE /api/lp/:id error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', undefined, generateErrorReference()),
        { status: 500 }
      );
    }
  });
});
```

### 6.3 복구 API

```typescript
// src/app/api/lp/[id]/restore/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth, type AuthResult } from '@/lib/auth/middleware';
import { withRateLimit } from '@/lib/security/rate-limit';
import { createErrorResponse, generateErrorReference } from '@/lib/utils/errors';
import { uuidSchema } from '@/lib/utils/validators';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/lp/:id/restore - 삭제된 랜딩페이지 복구
 */
export const POST = withAuth(async (request: NextRequest, auth: AuthResult, { params }: RouteParams) => {
  return withRateLimit(request, async () => {
    try {
      const idValidation = uuidSchema.safeParse(params.id);
      if (!idValidation.success) {
        return NextResponse.json(createErrorResponse('LP_001'), { status: 404 });
      }

      const supabase = createAdminClient();

      // 삭제된 항목 조회
      const { data: deleted } = await supabase
        .from('landing_pages')
        .select('id, user_id, deleted_at')
        .eq('id', params.id)
        .not('deleted_at', 'is', null)
        .single();

      if (!deleted || deleted.user_id !== auth.userId) {
        return NextResponse.json(
          createErrorResponse('LP_001', '복구할 항목을 찾을 수 없습니다'),
          { status: 404 }
        );
      }

      // 30일 초과 확인
      const deletedAt = new Date(deleted.deleted_at);
      const daysElapsed = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);

      if (daysElapsed > 30) {
        return NextResponse.json(createErrorResponse('LP_002'), { status: 410 });
      }

      // 랜딩페이지 수 제한 확인
      const { count } = await supabase
        .from('landing_pages')
        .select('id', { count: 'exact' })
        .eq('user_id', auth.userId)
        .is('deleted_at', null);

      const maxPages = auth.tier === 'FREE' ? 3 : Infinity;

      if ((count || 0) >= maxPages) {
        return NextResponse.json(createErrorResponse('LP_003'), { status: 429 });
      }

      // 복구 실행
      await supabase
        .from('landing_pages')
        .update({ deleted_at: null })
        .eq('id', params.id);

      // 감사 로그
      await supabase.from('audit_logs').insert({
        user_id: auth.userId,
        action: 'landing_page_restored',
        details: { landing_page_id: params.id },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
      });

      return NextResponse.json({
        success: true,
        data: {
          message: '복구되었습니다',
          id: params.id,
        },
      });
    } catch (error) {
      console.error('POST /api/lp/:id/restore error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', undefined, generateErrorReference()),
        { status: 500 }
      );
    }
  });
});
```

### 6.4 삭제된 항목 목록

```typescript
// src/app/api/lp/deleted/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAuth, type AuthResult } from '@/lib/auth/middleware';
import { withRateLimit } from '@/lib/security/rate-limit';
import { createErrorResponse, generateErrorReference } from '@/lib/utils/errors';

/**
 * GET /api/lp/deleted - 삭제된 랜딩페이지 목록
 */
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {
  return withRateLimit(request, async () => {
    try {
      const supabase = createAdminClient();

      // 30일 이내 삭제된 항목만 조회
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from('landing_pages')
        .select('id, title, deleted_at')
        .eq('user_id', auth.userId)
        .not('deleted_at', 'is', null)
        .gte('deleted_at', thirtyDaysAgo.toISOString())
        .order('deleted_at', { ascending: false });

      if (error) {
        throw error;
      }

      return NextResponse.json({
        success: true,
        data: data.map((lp) => {
          const deletedAt = new Date(lp.deleted_at);
          const daysRemaining = Math.ceil(
            30 - (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24)
          );

          return {
            id: lp.id,
            title: lp.title,
            deletedAt: lp.deleted_at,
            daysRemaining: Math.max(0, daysRemaining),
            canRestore: daysRemaining > 0,
          };
        }),
      });
    } catch (error) {
      console.error('GET /api/lp/deleted error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', undefined, generateErrorReference()),
        { status: 500 }
      );
    }
  });
});
```

---

## 7. 관리자 API

### 7.1 관리자 권한 검증

```typescript
// src/lib/auth/admin-middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest, type AuthResult } from './middleware';
import { createErrorResponse } from '@/lib/utils/errors';

/**
 * 관리자 권한 검증 미들웨어
 */
export function withAdmin(
  handler: (request: NextRequest, auth: AuthResult) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const auth = await authenticateRequest(request);

    if (!auth) {
      return NextResponse.json(createErrorResponse('AUTH_003'), { status: 401 });
    }

    // ENTERPRISE 티어만 관리자 권한
    if (auth.tier !== 'ENTERPRISE') {
      return NextResponse.json(createErrorResponse('GEN_003'), { status: 403 });
    }

    return handler(request, auth);
  };
}
```

### 7.2 사용자 승인 API

```typescript
// src/app/api/admin/users/[id]/approve/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { withAdmin } from '@/lib/auth/admin-middleware';
import { createErrorResponse, generateErrorReference } from '@/lib/utils/errors';
import { uuidSchema } from '@/lib/utils/validators';

interface RouteParams {
  params: { id: string };
}

/**
 * POST /api/admin/users/:id/approve - 사용자 승인
 */
export const POST = withAdmin(async (request: NextRequest, auth, { params }: RouteParams) => {
  try {
    const idValidation = uuidSchema.safeParse(params.id);
    if (!idValidation.success) {
      return NextResponse.json(
        createErrorResponse('GEN_002', '유효하지 않은 사용자 ID입니다'),
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 사용자 확인
    const { data: user } = await supabase
      .from('profiles')
      .select('id, email, is_approved, deleted_at')
      .eq('id', params.id)
      .single();

    if (!user || user.deleted_at) {
      return NextResponse.json(
        createErrorResponse('GEN_002', '사용자를 찾을 수 없습니다'),
        { status: 404 }
      );
    }

    if (user.is_approved) {
      return NextResponse.json(
        createErrorResponse('GEN_002', '이미 승인된 사용자입니다'),
        { status: 400 }
      );
    }

    // 승인 처리 (트리거로 세션 무효화 자동 실행)
    await supabase
      .from('profiles')
      .update({ is_approved: true })
      .eq('id', params.id);

    // 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: auth.userId,
      action: 'approval_change',
      details: {
        target_user_id: params.id,
        target_email: user.email,
        approved: true,
      },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
    });

    return NextResponse.json({
      success: true,
      data: {
        message: '사용자가 승인되었습니다',
        userId: params.id,
        sessionsInvalidated: true, // 트리거로 자동 실행됨
      },
    });
  } catch (error) {
    console.error('POST /api/admin/users/:id/approve error:', error);
    return NextResponse.json(
      createErrorResponse('GEN_001', undefined, generateErrorReference()),
      { status: 500 }
    );
  }
});
```

---

## 8. 구현 체크리스트

### 8.1 미들웨어

- [ ] CORS 화이트리스트 (와일드카드 제거)
- [ ] Sec-Fetch-Site 검증
- [ ] Rate Limiting (PostgreSQL 기반)
- [ ] 보안 헤더

### 8.2 인증 API

- [ ] POST /api/auth/signup
- [ ] POST /api/auth/login
- [ ] POST /api/auth/logout
- [ ] POST /api/auth/refresh
- [ ] GET /api/auth/me

### 8.3 랜딩페이지 API

- [ ] GET /api/lp (목록)
- [ ] POST /api/lp (생성)
- [ ] GET /api/lp/:id (상세)
- [ ] PATCH /api/lp/:id (수정)
- [ ] DELETE /api/lp/:id (Soft Delete)
- [ ] POST /api/lp/:id/restore (복구)
- [ ] GET /api/lp/deleted (삭제된 목록)

### 8.4 AI API

- [ ] POST /api/ai/generate
- [ ] GET /api/ai/tokens

### 8.5 관리자 API

- [ ] GET /api/admin/users
- [ ] POST /api/admin/users/:id/approve
- [ ] GET /api/admin/audit-logs

---

**이전 문서**: [02_데이터베이스.md](./02_데이터베이스.md)
**다음 문서**: [04_AI_통합.md](./04_AI_통합.md)
