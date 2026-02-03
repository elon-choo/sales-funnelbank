# API 엔드포인트 PRD v2.0

## 문서 정보

| 항목 | 내용 |
|------|------|
| 버전 | PRD v2.0 |
| 작성일 | 2025-12-15 |
| 기반 문서 | PRD v1.0 + RedTeam 리뷰 + BlueTeam 개선안 |
| 주요 변경 | Rate Limiting Fail-Closed, CORS 명시적 화이트리스트, withAuth HOF 통일 |

---

## 1. API 엔드포인트 목록

### 1.1 전체 엔드포인트 개요

```
/api
├── auth/
│   ├── signup      (POST)   # 회원가입
│   ├── login       (POST)   # 로그인
│   ├── logout      (POST)   # 로그아웃
│   ├── refresh     (POST)   # 토큰 갱신
│   └── me          (GET)    # 내 정보 조회
│
├── lp/                      # Landing Pages
│   ├── /           (GET, POST)      # 목록 조회, 생성
│   ├── /[id]       (GET, PUT, DELETE) # 상세, 수정, 삭제
│   ├── /[id]/publish (POST)         # 발행
│   └── /[id]/restore (POST)         # 복구
│
├── qa/                      # Q&A Sessions
│   ├── /           (GET, POST)      # 세션 목록, 생성
│   ├── /[id]       (GET, PUT)       # 세션 상세, 답변 저장
│   └── /[id]/complete (POST)        # 세션 완료
│
├── ai/                      # AI 생성
│   ├── /generate   (POST)   # 랜딩페이지 생성
│   ├── /regenerate (POST)   # 재생성
│   └── /tokens     (GET)    # 토큰 사용량 조회
│
├── admin/                   # 관리자 (ENTERPRISE)
│   ├── /users      (GET)    # 사용자 목록
│   ├── /users/[id]/approve (POST) # 승인
│   ├── /audit-logs (GET)    # 감사 로그
│   └── /stats      (GET)    # 통계
│
└── cron/                    # Cron Jobs
    └── /cleanup    (GET)    # 정리 작업
```

### 1.2 Rate Limit 정책 (v2.0 - Fail-Closed)

| 엔드포인트 | 제한 | 윈도우 | Fail-Closed |
|----------|------|--------|-------------|
| /api/auth/signup | 3회 | 60초 | ✓ DB 에러 시 차단 |
| /api/auth/login | 5회 | 60초 | ✓ DB 에러 시 차단 |
| /api/auth/refresh | 10회 | 60초 | ✓ 메모리 폴백 50% |
| /api/ai/generate | 10회 | 60초 | ✓ 메모리 폴백 50% |
| /api/ai/chat | 30회 | 60초 | ✓ 메모리 폴백 50% |
| /api/lp/* | 60회 | 60초 | ✓ 메모리 폴백 50% |
| default | 100회 | 60초 | ✓ 메모리 폴백 50% |

---

## 2. 공통 사항

### 2.1 표준 응답 형식

#### 성공 응답

```typescript
{
  "success": true,
  "data": {
    // 실제 데이터
  }
}
```

#### 실패 응답

```typescript
{
  "success": false,
  "error": {
    "code": "ERR_CODE",
    "message": "사용자 친화적 메시지",
    "reference": "ERR-20251215120000-A1B2" // 추적용 (선택적)
  }
}
```

### 2.2 에러 코드 정의

| 코드 | HTTP | 설명 |
|------|------|------|
| **인증 관련** |
| AUTH_001 | 401 | 이메일 또는 비밀번호 오류 |
| AUTH_002 | 403 | 관리자 승인 대기 중 |
| AUTH_003 | 401 | 세션 만료 / 토큰 없음 |
| AUTH_004 | 401 | 보안 문제 감지 (토큰 재사용) |
| AUTH_005 | 409 | 이미 가입된 이메일 |
| AUTH_006 | 403 | 탈퇴한 계정 |
| AUTH_007 | 403 | 관리자 권한 필요 |
| **일반 에러** |
| GEN_001 | 500 | 서버 에러 |
| GEN_002 | 400 | 입력값 검증 실패 |
| GEN_003 | 403 | 접근 권한 없음 |
| **토큰 관련** |
| TOK_001 | 402 | 토큰 부족 |
| TOK_002 | 423 | 토큰 예약 실패 |
| **Rate Limit** |
| RATE_001 | 429 | Rate Limit 초과 |

### 2.3 CORS 설정 (v2.0 - 명시적 화이트리스트)

```typescript
// src/lib/security/cors.ts

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_APP_URL!,
  process.env.NEXT_PUBLIC_LP_DOMAIN!,
  // 환경변수에서 추가 도메인 허용 (쉼표로 구분)
  ...(process.env.ADDITIONAL_CORS_ORIGINS?.split(',').map(o => o.trim()).filter(Boolean) || []),
];

/**
 * CORS 검증 및 헤더 설정 (v2.0 - 와일드카드 금지)
 */
export function verifyCORS(request: NextRequest): {
  allowed: boolean;
  origin: string | null;
} {
  const origin = request.headers.get('origin');

  // Origin 헤더 없으면 허용 (Same-Origin)
  if (!origin) {
    return { allowed: true, origin: null };
  }

  // 명시적 화이트리스트 검증
  const allowed = ALLOWED_ORIGINS.some(allowedOrigin => {
    // 정확히 일치하는 경우만 허용
    return origin === allowedOrigin;
  });

  return { allowed, origin: allowed ? origin : null };
}

/**
 * CORS 헤더 설정
 */
export function setCORSHeaders(
  response: NextResponse,
  allowedOrigin: string | null
): void {
  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
    response.headers.set('Access-Control-Max-Age', '86400'); // 24시간
  }
}

/**
 * CORS Preflight 응답 생성
 */
export function createCORSPreflightResponse(
  allowedOrigin: string | null
): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  setCORSHeaders(response, allowedOrigin);
  return response;
}

/**
 * CORS 차단 응답
 */
export function createCORSBlockedResponse(): NextResponse {
  // 감사 로그 기록은 API Route에서 수행
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'GEN_003',
        message: '허용되지 않은 도메인입니다',
      },
    },
    { status: 403 }
  );
}
```

### 2.4 Rate Limiting 미들웨어 (v2.0 - Fail-Closed)

```typescript
// src/lib/security/rate-limit.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { LRUCache } from 'lru-cache';

// 메모리 기반 폴백 캐시 (DB 장애 시)
const fallbackCache = new LRUCache<string, { count: number; resetAt: number }>({
  max: 10000,
  ttl: 60 * 1000, // 1분
});

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/signup': { limit: 3, windowSeconds: 60 },
  '/api/auth/login': { limit: 5, windowSeconds: 60 },
  '/api/auth/refresh': { limit: 10, windowSeconds: 60 },
  '/api/ai/generate': { limit: 10, windowSeconds: 60 },
  '/api/ai/regenerate': { limit: 5, windowSeconds: 60 },
  '/api/lp': { limit: 60, windowSeconds: 60 },
  default: { limit: 100, windowSeconds: 60 },
};

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  usingFallback?: boolean;
}

/**
 * Rate Limit 체크 (Fail-Closed + 메모리 폴백)
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<RateLimitResult> {
  const supabase = createAdminClient();
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;

  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_endpoint: endpoint,
      p_limit: config.limit,
      p_window_seconds: config.windowSeconds,
    });

    if (error) {
      console.error('Rate limit DB error, using fallback:', error);
      return checkRateLimitFallback(identifier, endpoint, config);
    }

    if (data.error) {
      // DB 에러 발생 - Fail-Closed 정책으로 폴백
      return checkRateLimitFallback(identifier, endpoint, config);
    }

    return {
      allowed: data.allowed,
      current: data.current,
      limit: data.limit,
      remaining: data.remaining || 0,
      resetAt: new Date(data.reset_at || data.retry_after * 1000 + Date.now()),
    };
  } catch (error) {
    console.error('Rate limit check failed:', error);
    // CRITICAL: Fail-Closed 정책 - DB 장애 시 메모리 폴백 사용
    return checkRateLimitFallback(identifier, endpoint, config);
  }
}

/**
 * 메모리 기반 폴백 Rate Limit (DB 장애 시)
 * 보수적으로 50% 제한 적용
 */
function checkRateLimitFallback(
  identifier: string,
  endpoint: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();
  const conservativeLimit = Math.ceil(config.limit * 0.5); // 50% 보수적 제한

  let cached = fallbackCache.get(key);

  if (!cached || cached.resetAt < now) {
    // 새 윈도우 시작
    cached = {
      count: 1,
      resetAt: now + config.windowSeconds * 1000,
    };
    fallbackCache.set(key, cached);

    return {
      allowed: true,
      current: 1,
      limit: conservativeLimit,
      remaining: conservativeLimit - 1,
      resetAt: new Date(cached.resetAt),
      usingFallback: true,
    };
  }

  // 기존 윈도우 내 카운트 증가
  cached.count += 1;
  fallbackCache.set(key, cached);

  const allowed = cached.count <= conservativeLimit;

  return {
    allowed,
    current: cached.count,
    limit: conservativeLimit,
    remaining: Math.max(0, conservativeLimit - cached.count),
    resetAt: new Date(cached.resetAt),
    usingFallback: true,
  };
}

/**
 * IP 추출 (보안 강화)
 */
export function extractClientIP(request: NextRequest): string {
  // Vercel 환경에서는 x-vercel-forwarded-for가 신뢰할 수 있음
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  // CF-Connecting-IP (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }

  // 일반적인 x-forwarded-for (프록시 뒤)
  // 주의: 스푸핑 가능하므로 신뢰할 수 있는 프록시 뒤에서만 사용
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // x-real-ip
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 알 수 없는 경우 - 보수적으로 unknown 반환
  return 'unknown';
}

/**
 * Rate Limit 응답 생성
 */
export function createRateLimitResponse(
  rateLimit: RateLimitResult
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: {
        code: 'RATE_001',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      },
    },
    {
      status: 429,
      headers: {
        'X-RateLimit-Limit': String(rateLimit.limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': rateLimit.resetAt.toISOString(),
        'Retry-After': String(Math.ceil((rateLimit.resetAt.getTime() - Date.now()) / 1000)),
        ...(rateLimit.usingFallback && { 'X-RateLimit-Fallback': 'true' }),
      },
    }
  );
}
```

---

## 3. 인증 API (상세 명세)

### 3.1 POST /api/auth/signup

**설명**: 새 사용자 회원가입

**Rate Limit**: 3회/60초

**요청 본문**:

```typescript
{
  email: string;           // 이메일 (유효성 검증)
  password: string;        // 비밀번호 (8자 이상, 영문+숫자)
  fullName: string;        // 이름 (2~50자)
  agreeTerms: true;        // 이용약관 동의 (필수)
  agreePrivacy: true;      // 개인정보처리방침 동의 (필수)
  agreeMarketing?: boolean; // 마케팅 동의 (선택)
}
```

**성공 응답** (201):

```typescript
{
  "success": true,
  "data": {
    "message": "회원가입이 완료되었습니다. 관리자 승인 후 이용 가능합니다."
  }
}
```

**실패 응답**:
- 400: 입력값 검증 실패 (GEN_002)
- 409: 이미 가입된 이메일 (AUTH_005)
- 409: 탈퇴한 계정 (AUTH_006)
- 500: 서버 에러 (GEN_001)

**구현 위치**: `src/app/api/auth/signup/route.ts` (이미 문서화됨)

---

### 3.2 POST /api/auth/login

**설명**: 로그인 (Access Token + Refresh Token 발급)

**Rate Limit**: 5회/60초

**요청 본문**:

```typescript
{
  email: string;
  password: string;
}
```

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,  // 15분 (초)
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "홍길동",
      "tier": "FREE",
      "isApproved": true
    }
  }
}
```

**쿠키 설정**:
- `refresh_token`: HttpOnly, Secure, SameSite=Strict, 7일

**실패 응답**:
- 401: 이메일/비밀번호 오류 (AUTH_001)
- 403: 미승인 계정 (AUTH_002)
- 403: 탈퇴한 계정 (AUTH_006)
- 500: 서버 에러 (GEN_001)

**구현 위치**: `src/app/api/auth/login/route.ts` (이미 문서화됨)

---

### 3.3 POST /api/auth/refresh

**설명**: Access Token 갱신 (Refresh Token Rotation)

**Rate Limit**: 10회/60초

**요청 본문**: 없음 (HttpOnly Cookie 사용)

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900  // 15분
  }
}
```

**쿠키 설정**:
- 새 `refresh_token`: HttpOnly, Secure, SameSite=Strict, 7일

**실패 응답**:
- 401: Refresh Token 없음/만료 (AUTH_003)
- 401: 토큰 재사용 감지 (AUTH_004) - **모든 세션 무효화**
- 500: 서버 에러 (GEN_001)

**구현 위치**: `src/app/api/auth/refresh/route.ts` (이미 문서화됨)

---

### 3.4 POST /api/auth/logout

**설명**: 로그아웃 (Refresh Token 폐기)

**인증**: Bearer Token (선택적)

**요청 본문**: 없음

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "message": "로그아웃되었습니다"
  }
}
```

**쿠키 설정**:
- `refresh_token`: 삭제 (maxAge=0)

**구현 위치**: `src/app/api/auth/logout/route.ts` (이미 문서화됨)

---

### 3.5 GET /api/auth/me

**설명**: 내 정보 조회

**인증**: Bearer Token (필수)

**요청 본문**: 없음

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "홍길동",
      "tier": "FREE",
      "isApproved": true,
      "agreeMarketing": false,
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**실패 응답**:
- 401: 인증 필요 (AUTH_003)
- 404: 사용자 없음 (GEN_001)

**구현 위치**: `src/app/api/auth/me/route.ts` (이미 문서화됨)

---

## 4. 랜딩페이지 API

### 4.1 GET /api/lp

**설명**: 내 랜딩페이지 목록 조회

**인증**: Bearer Token (필수)

**쿼리 파라미터**:
- `status`: draft | published | archived (선택)
- `page`: 페이지 번호 (기본 1)
- `limit`: 페이지 크기 (기본 20, 최대 100)
- `includeDeleted`: 삭제된 항목 포함 (기본 false)

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "title": "샘플 랜딩페이지",
        "status": "published",
        "publishedUrl": "https://lp.magnetic-sales.com/sample-page",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-02T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  }
}
```

**구현**:

```typescript
// src/app/api/lp/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/guards';
import { createAdminClient } from '@/lib/supabase/admin';
import { z } from 'zod';

const querySchema = z.object({
  status: z.enum(['draft', 'published', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeDeleted: z.coerce.boolean().default(false),
});

export const GET = withAuth(async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const query = querySchema.parse(Object.fromEntries(searchParams));

  const supabase = createAdminClient();

  let queryBuilder = supabase
    .from('landing_pages')
    .select('*', { count: 'exact' })
    .eq('user_id', auth.userId);

  // 필터링
  if (query.status) {
    queryBuilder = queryBuilder.eq('status', query.status);
  }

  if (!query.includeDeleted) {
    queryBuilder = queryBuilder.is('deleted_at', null);
  }

  // 페이지네이션
  const offset = (query.page - 1) * query.limit;
  queryBuilder = queryBuilder
    .order('created_at', { ascending: false })
    .range(offset, offset + query.limit - 1);

  const { data, error, count } = await queryBuilder;

  if (error) {
    console.error('Failed to fetch landing pages:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'GEN_001', message: '랜딩페이지 목록 조회 실패' },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      items: data,
      pagination: {
        page: query.page,
        limit: query.limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / query.limit),
      },
    },
  });
});
```

---

### 4.2 POST /api/lp

**설명**: 새 랜딩페이지 생성

**인증**: Bearer Token (필수)

**요청 본문**:

```typescript
{
  title: string;               // 제목 (1~100자)
  content: {                   // JSONB 형식
    sections: Array<{
      type: string;
      content: string;
    }>;
  };
  qaSessionId?: string;        // 연결된 Q&A 세션 (선택)
}
```

**성공 응답** (201):

```typescript
{
  "success": true,
  "data": {
    "landingPage": {
      "id": "uuid",
      "title": "샘플 랜딩페이지",
      "status": "draft",
      "createdAt": "2025-01-01T00:00:00.000Z"
    }
  }
}
```

**실패 응답**:
- 400: 입력값 검증 실패 (GEN_002)
- 403: 랜딩페이지 수 제한 초과 (GEN_003)
- 500: 서버 에러 (GEN_001)

**구현**:

```typescript
// src/app/api/lp/route.ts

export const POST = withAuth(async (request, auth) => {
  const body = await request.json();
  const supabase = createAdminClient();

  // 티어별 제한 확인
  if (auth.tier === 'FREE') {
    const { count } = await supabase
      .from('landing_pages')
      .select('id', { count: 'exact' })
      .eq('user_id', auth.userId)
      .is('deleted_at', null);

    if ((count || 0) >= 3) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'GEN_003',
            message: 'FREE 플랜은 최대 3개까지 생성 가능합니다',
          },
        },
        { status: 403 }
      );
    }
  }

  // 랜딩페이지 생성
  const { data, error } = await supabase
    .from('landing_pages')
    .insert({
      user_id: auth.userId,
      title: body.title,
      content: body.content,
      qa_session_id: body.qaSessionId || null,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create landing page:', error);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'GEN_001', message: '랜딩페이지 생성 실패' },
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: { landingPage: data },
    },
    { status: 201 }
  );
});
```

---

### 4.3 PUT /api/lp/[id]

**설명**: 랜딩페이지 수정

**인증**: Bearer Token (필수)

**요청 본문**:

```typescript
{
  title?: string;
  content?: Json;
  status?: 'draft' | 'published' | 'archived';
}
```

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "landingPage": {
      "id": "uuid",
      "title": "수정된 제목",
      "updatedAt": "2025-01-02T00:00:00.000Z"
    }
  }
}
```

**실패 응답**:
- 404: 랜딩페이지 없음
- 403: 본인 소유 아님

---

### 4.4 DELETE /api/lp/[id]

**설명**: 랜딩페이지 Soft Delete

**인증**: Bearer Token (필수)

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "message": "랜딩페이지가 삭제되었습니다. 30일 이내 복구 가능합니다."
  }
}
```

**구현**:

```typescript
// src/app/api/lp/[id]/route.ts

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(async (req, auth) => {
    const supabase = createAdminClient();

    const { error } = await supabase
      .from('landing_pages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', params.id)
      .eq('user_id', auth.userId)
      .is('deleted_at', null);

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'GEN_001', message: '랜딩페이지 삭제 실패' },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { message: '랜딩페이지가 삭제되었습니다. 30일 이내 복구 가능합니다.' },
    });
  })(request, { params });
}
```

---

### 4.5 POST /api/lp/[id]/restore

**설명**: 삭제된 랜딩페이지 복구

**인증**: Bearer Token (필수)

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "landingPage": {
      "id": "uuid",
      "title": "복구된 랜딩페이지",
      "deletedAt": null
    }
  }
}
```

**구현**:

```typescript
// src/app/api/lp/[id]/restore/route.ts

export const POST = withAuth(async (request, auth, { params }) => {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('landing_pages')
    .update({ deleted_at: null })
    .eq('id', params.id)
    .eq('user_id', auth.userId)
    .not('deleted_at', 'is', null)
    .gte('deleted_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'GEN_001', message: '복구 실패 (30일 초과 또는 권한 없음)' },
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { landingPage: data },
  });
});
```

---

## 5. AI 생성 API

### 5.1 POST /api/ai/generate

**설명**: 랜딩페이지 AI 생성

**인증**: Bearer Token (필수)

**Rate Limit**: 10회/60초

**요청 본문**:

```typescript
{
  qaSessionId: string;       // Q&A 세션 ID
  estimatedTokens?: number;  // 예상 토큰 (선택, 자동 계산)
}
```

**성공 응답** (200, SSE):

```typescript
// Event Stream
data: {"type":"token_reserved","reservationId":"uuid","estimated":5000}
data: {"type":"progress","current":1000,"total":5000}
data: {"type":"section","name":"hero","content":"..."}
data: {"type":"complete","landingPageId":"uuid","actualTokens":4800}
```

**실패 응답**:
- 402: 토큰 부족 (TOK_001)
- 423: 토큰 예약 실패 (TOK_002)
- 500: 생성 실패 (GEN_001)

**구현 위치**: `04_AI_통합_v2.md`에 상세 구현

---

### 5.2 GET /api/ai/tokens

**설명**: 내 토큰 사용량 조회

**인증**: Bearer Token (필수)

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "tier": "FREE",
    "dailyLimit": 100000,
    "usedToday": 15000,
    "reserved": 5000,
    "available": 80000,
    "usagePercentage": 15,
    "resetAt": "2025-01-02T00:00:00+09:00"
  }
}
```

**구현**:

```typescript
// src/app/api/ai/tokens/route.ts

export const GET = withAuth(async (request, auth) => {
  const supabase = createAdminClient();

  const { data, error } = await supabase.rpc('get_user_token_usage', {
    p_user_id: auth.userId,
  });

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'GEN_001', message: '토큰 사용량 조회 실패' },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data,
  });
});
```

---

## 6. 관리자 API (ENTERPRISE Only)

### 6.1 GET /api/admin/users

**설명**: 사용자 목록 조회

**인증**: Bearer Token (ENTERPRISE 필수)

**쿼리 파라미터**:
- `isApproved`: true | false (선택)
- `page`: 페이지 번호
- `limit`: 페이지 크기

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "fullName": "홍길동",
        "tier": "FREE",
        "isApproved": false,
        "createdAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "pagination": { ... }
  }
}
```

**구현**:

```typescript
// src/app/api/admin/users/route.ts

import { withAdminAuth } from '@/lib/auth/guards';

export const GET = withAdminAuth(async (request, auth) => {
  const { searchParams } = new URL(request.url);
  const isApproved = searchParams.get('isApproved');

  const supabase = createAdminClient();

  let query = supabase
    .from('profiles')
    .select('*', { count: 'exact' })
    .is('deleted_at', null);

  if (isApproved !== null) {
    query = query.eq('is_approved', isApproved === 'true');
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'GEN_001', message: '사용자 목록 조회 실패' },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      items: data,
      pagination: { total: count || 0 },
    },
  });
});
```

---

### 6.2 POST /api/admin/users/[id]/approve

**설명**: 사용자 승인

**인증**: Bearer Token (ENTERPRISE 필수)

**요청 본문**:

```typescript
{
  isApproved: boolean;
}
```

**성공 응답** (200):

```typescript
{
  "success": true,
  "data": {
    "message": "사용자 승인 상태가 변경되었습니다"
  }
}
```

**구현**:

```typescript
// src/app/api/admin/users/[id]/approve/route.ts

export const POST = withAdminAuth(async (request, auth, { params }) => {
  const body = await request.json();
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('profiles')
    .update({ is_approved: body.isApproved })
    .eq('id', params.id);

  if (error) {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'GEN_001', message: '승인 상태 변경 실패' },
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    data: { message: '사용자 승인 상태가 변경되었습니다' },
  });
});
```

---

## 7. 구현 체크리스트

### 7.1 공통 설정

- [ ] CORS 명시적 화이트리스트 적용
- [ ] Rate Limiting Fail-Closed 구현
- [ ] withAuth HOF 통일
- [ ] 모든 API에 Rate Limit 적용
- [ ] 에러 코드 일관성 확인

### 7.2 인증 API

- [ ] POST /api/auth/signup 구현
- [ ] POST /api/auth/login 구현
- [ ] POST /api/auth/logout 구현
- [ ] POST /api/auth/refresh 구현
- [ ] GET /api/auth/me 구현

### 7.3 랜딩페이지 API

- [ ] GET /api/lp 구현
- [ ] POST /api/lp 구현
- [ ] GET /api/lp/[id] 구현
- [ ] PUT /api/lp/[id] 구현
- [ ] DELETE /api/lp/[id] 구현 (Soft Delete)
- [ ] POST /api/lp/[id]/restore 구현

### 7.4 AI API

- [ ] POST /api/ai/generate 구현
- [ ] POST /api/ai/regenerate 구현
- [ ] GET /api/ai/tokens 구현

### 7.5 관리자 API

- [ ] GET /api/admin/users 구현
- [ ] POST /api/admin/users/[id]/approve 구현
- [ ] GET /api/admin/audit-logs 구현
- [ ] GET /api/admin/stats 구현

---

**이전 문서**: [02_데이터베이스_v2.md](./02_데이터베이스_v2.md)
**다음 문서**: [04_AI_통합_v2.md](./04_AI_통합_v2.md)
