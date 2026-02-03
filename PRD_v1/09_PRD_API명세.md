# PRD: API 명세

## 1. 개요

이 문서는 마그네틱 세일즈 웹앱의 전체 API 명세를 정의합니다. 모든 엔드포인트의 요청/응답 형식, 에러 코드, 미들웨어 구현을 포함합니다.

## 2. 의존성

- 이 문서 작성 전 필요: `08_PRD_데이터베이스.md`, `04_PRD_인증시스템.md`
- 이 문서 작성 후 진행: `10_PRD_보안구현.md`
- 관련 문서: `05_PRD_AI기획도우미.md`, `06_PRD_랜딩페이지빌더.md`, `07_PRD_DB수집페이지.md`

---

## 3. API 아키텍처

### 3.1 전체 구조

```mermaid
graph TB
    subgraph "클라이언트"
        Web[웹 브라우저]
    end

    subgraph "Edge Layer"
        MW[Next.js Middleware]
        CORS[CORS 미들웨어]
        Rate[Rate Limit 미들웨어]
    end

    subgraph "Next.js API Routes"
        Auth[/api/auth/*]
        QA[/api/qa/*]
        LP[/api/lp/*]
        AI[/api/ai/*]
        Admin[/api/admin/*]
        Storage[/api/storage/*]
    end

    subgraph "Supabase"
        AuthS[Supabase Auth]
        DB[(PostgreSQL)]
        Store[Supabase Storage]
    end

    subgraph "External"
        Claude[Claude API]
    end

    Web --> MW
    MW --> CORS
    CORS --> Rate
    Rate --> Auth
    Rate --> QA
    Rate --> LP
    Rate --> AI
    Rate --> Admin
    Rate --> Storage

    Auth --> AuthS
    Auth --> DB
    QA --> DB
    LP --> DB
    LP --> Store
    AI --> DB
    AI --> Claude
    Admin --> DB
```

### 3.2 API 버전 정책

```yaml
버전_정책:
  현재_버전: v1
  기본_경로: /api
  버전_명시: 향후 필요 시 /api/v2로 확장
  하위_호환성: 최소 6개월 유지
```

---

## 4. 공통 규격

### 4.1 요청 헤더

```typescript
// 필수 헤더
interface RequiredHeaders {
  'Content-Type': 'application/json';
  'Accept': 'application/json';
}

// 인증 헤더 (보호된 엔드포인트)
interface AuthHeaders extends RequiredHeaders {
  'Authorization': `Bearer ${accessToken}`;
}

// 선택적 헤더
interface OptionalHeaders {
  'X-Request-ID'?: string;  // 요청 추적용
  'X-Client-Version'?: string;  // 클라이언트 버전
}
```

### 4.2 응답 형식

```typescript
// src/types/api/response.ts

/**
 * 성공 응답 형식
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    hasMore?: boolean;
  };
}

/**
 * 에러 응답 형식
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;           // 에러 코드 (예: AUTH_001)
    message: string;        // 사용자 친화적 메시지
    reference?: string;     // 추적용 참조 ID
    details?: Record<string, string[]>;  // 필드별 검증 에러
  };
}

/**
 * API 응답 타입 유니온
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;

/**
 * 응답 생성 헬퍼
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: SuccessResponse<T>['meta']
): SuccessResponse<T> {
  return {
    success: true,
    data,
    ...(meta && { meta }),
  };
}

export function createErrorResponse(
  code: string,
  message: string,
  options?: {
    reference?: string;
    details?: Record<string, string[]>;
  }
): ErrorResponse {
  return {
    success: false,
    error: {
      code,
      message,
      ...options,
    },
  };
}
```

### 4.3 페이지네이션

```typescript
// src/types/api/pagination.ts

/**
 * 페이지네이션 요청 파라미터
 */
export interface PaginationParams {
  page?: number;    // 기본값: 1
  limit?: number;   // 기본값: 10, 최대: 100
  sort?: string;    // 예: 'createdAt:desc'
}

/**
 * 페이지네이션 메타 정보
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Zod 스키마
 */
import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sort: z.string().regex(/^[a-zA-Z]+:(asc|desc)$/).optional(),
});

/**
 * 페이지네이션 헬퍼
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

export function getPaginationOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}
```

### 4.4 HTTP 상태 코드

```typescript
// src/constants/http-status.ts

export const HTTP_STATUS = {
  // 성공
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 클라이언트 에러
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 서버 에러
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export type HttpStatus = typeof HTTP_STATUS[keyof typeof HTTP_STATUS];
```

---

## 5. CORS 미들웨어

### 5.1 CORS 설정

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 허용된 오리진 (v2 - 명시적 화이트리스트)
const ALLOWED_ORIGINS = new Set([
  'https://magnetic-sales.vercel.app',
  'https://www.magnetic-sales.com',
  'https://staging.magnetic-sales.vercel.app',
]);

// 개발 환경에서 localhost 허용
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.add('http://localhost:3000');
  ALLOWED_ORIGINS.add('http://127.0.0.1:3000');
}

// 환경변수에서 추가 오리진 로드
const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS?.split(',') || [];
additionalOrigins.forEach(origin => ALLOWED_ORIGINS.add(origin.trim()));

export function middleware(request: NextRequest) {
  // API 라우트만 처리
  if (!request.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  // Origin이 없는 경우 (same-origin 또는 서버 간 통신)
  if (!origin) {
    const fetchSite = request.headers.get('sec-fetch-site');

    // same-origin 또는 none만 허용
    if (fetchSite === 'same-origin' || fetchSite === 'none' || !fetchSite) {
      return response;
    }

    // cross-origin인데 origin이 없으면 거부
    console.warn('CORS: cross-origin request without origin header');
    return new NextResponse(null, { status: 403 });
  }

  // 화이트리스트 확인
  if (!ALLOWED_ORIGINS.has(origin)) {
    console.warn(`CORS blocked: ${origin}`);

    // 비동기로 감사 로그 기록
    logSecurityEvent('cors_blocked', { origin, path: request.nextUrl.pathname });

    return new NextResponse(
      JSON.stringify({
        success: false,
        error: {
          code: 'CORS_001',
          message: '허용되지 않은 요청입니다',
        },
      }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // CORS 헤더 설정
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS'
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Request-ID, X-Client-Version'
  );
  response.headers.set('Access-Control-Max-Age', '86400');

  // Preflight 요청 처리
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};

// 보안 이벤트 로깅 (비동기)
async function logSecurityEvent(
  action: string,
  details: Record<string, unknown>
): Promise<void> {
  try {
    // Supabase 직접 호출 또는 내부 API 호출
    await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/internal/audit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, details }),
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}
```

---

## 6. Rate Limiting 미들웨어

### 6.1 Rate Limit 설정

```typescript
// lib/security/rate-limit.ts
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * Rate Limit 설정
 */
interface RateLimitConfig {
  limit: number;        // 최대 요청 수
  windowSeconds: number; // 윈도우 크기 (초)
}

/**
 * 엔드포인트별 Rate Limit
 */
export const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // 인증 API (보안 민감)
  '/api/auth/login': { limit: 5, windowSeconds: 60 },
  '/api/auth/signup': { limit: 3, windowSeconds: 60 },
  '/api/auth/refresh': { limit: 10, windowSeconds: 60 },
  '/api/auth/forgot-password': { limit: 3, windowSeconds: 300 },

  // AI API (리소스 집약)
  '/api/ai/generate': { limit: 5, windowSeconds: 60 },
  '/api/ai/regenerate': { limit: 3, windowSeconds: 60 },

  // 일반 API
  '/api/lp': { limit: 60, windowSeconds: 60 },
  '/api/qa': { limit: 60, windowSeconds: 60 },
  '/api/admin': { limit: 30, windowSeconds: 60 },

  // 기본값
  'default': { limit: 100, windowSeconds: 60 },
};

/**
 * Rate Limit 결과
 */
interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

/**
 * Rate Limit 확인 (PostgreSQL 기반)
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<RateLimitResult> {
  // 엔드포인트 매칭 (prefix 기반)
  const config = Object.entries(RATE_LIMITS).find(
    ([pattern]) => endpoint.startsWith(pattern)
  )?.[1] || RATE_LIMITS['default'];

  try {
    const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
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
        remaining: config.limit,
        resetAt: new Date(Date.now() + config.windowSeconds * 1000),
        limit: config.limit,
      };
    }

    return {
      allowed: data.allowed,
      remaining: data.remaining,
      resetAt: new Date(data.reset_at),
      limit: config.limit,
    };
  } catch (error) {
    console.error('Rate limit check exception:', error);
    return {
      allowed: true,
      remaining: config.limit,
      resetAt: new Date(Date.now() + config.windowSeconds * 1000),
      limit: config.limit,
    };
  }
}

/**
 * Rate Limit 헤더 설정
 */
export function setRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set('X-RateLimit-Limit', result.limit.toString());
  headers.set('X-RateLimit-Remaining', result.remaining.toString());
  headers.set('X-RateLimit-Reset', result.resetAt.toISOString());
}
```

### 6.2 Rate Limit 래퍼

```typescript
// lib/security/with-rate-limit.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, setRateLimitHeaders } from './rate-limit';
import { createErrorResponse } from '@/types/api/response';

type RouteHandler = (request: NextRequest) => Promise<NextResponse>;

/**
 * Rate Limit 적용 래퍼
 */
export function withRateLimit(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest): Promise<NextResponse> => {
    // 식별자 결정 (인증된 사용자 > IP)
    const userId = request.headers.get('x-user-id');
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const identifier = userId || ip;

    // 엔드포인트 추출
    const endpoint = new URL(request.url).pathname;

    // Rate Limit 확인
    const result = await checkRateLimit(identifier, endpoint);

    if (!result.allowed) {
      const response = NextResponse.json(
        createErrorResponse(
          'RATE_001',
          '요청이 너무 많습니다. 잠시 후 다시 시도해주세요'
        ),
        { status: 429 }
      );

      setRateLimitHeaders(response.headers, result);
      response.headers.set(
        'Retry-After',
        Math.ceil((result.resetAt.getTime() - Date.now()) / 1000).toString()
      );

      return response;
    }

    // 핸들러 실행
    const response = await handler(request);

    // Rate Limit 헤더 추가
    setRateLimitHeaders(response.headers, result);

    return response;
  };
}
```

---

## 7. 인증 API

### 7.1 회원가입

```yaml
POST /api/auth/signup
Rate Limit: 3회/분
인증: 불필요
```

#### 요청

```typescript
// 요청 Body
interface SignupRequest {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeMarketing?: boolean;
}

// Zod 스키마
import { z } from 'zod';

export const signupSchema = z.object({
  email: z
    .string()
    .email('유효한 이메일을 입력해주세요')
    .max(255)
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(128, '비밀번호가 너무 깁니다')
    .regex(/[a-zA-Z]/, '영문을 포함해야 합니다')
    .regex(/[0-9]/, '숫자를 포함해야 합니다'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, '이름은 2자 이상이어야 합니다').max(50).trim(),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: '서비스 이용약관에 동의해주세요' }),
  }),
  agreePrivacy: z.literal(true, {
    errorMap: () => ({ message: '개인정보 처리방침에 동의해주세요' }),
  }),
  agreeMarketing: z.boolean().optional().default(false),
}).refine(data => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다',
  path: ['confirmPassword'],
});
```

#### 응답

```typescript
// 성공 (201 Created)
{
  "success": true,
  "data": {
    "message": "이메일 인증 후 관리자 승인을 기다려주세요"
  }
}

// 실패 - 이미 가입된 이메일 (409 Conflict)
{
  "success": false,
  "error": {
    "code": "AUTH_005",
    "message": "이미 가입된 이메일입니다"
  }
}

// 실패 - 탈퇴한 계정 (403 Forbidden)
{
  "success": false,
  "error": {
    "code": "AUTH_006",
    "message": "탈퇴한 계정입니다. 고객센터에 문의해주세요"
  }
}

// 실패 - 검증 오류 (400 Bad Request)
{
  "success": false,
  "error": {
    "code": "GEN_002",
    "message": "잘못된 요청입니다",
    "details": {
      "email": ["유효한 이메일을 입력해주세요"],
      "password": ["비밀번호는 8자 이상이어야 합니다"]
    }
  }
}
```

#### 구현

```typescript
// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { signupSchema } from '@/lib/validation/auth';
import { withRateLimit } from '@/lib/security/with-rate-limit';
import { createSuccessResponse, createErrorResponse } from '@/types/api/response';
import { generateErrorReference } from '@/lib/utils/error';
import { logAudit, createAuditContext } from '@/lib/audit/logger';
import { HTTP_STATUS } from '@/constants/http-status';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = withRateLimit(async (request: NextRequest) => {
  const auditContext = createAuditContext(request);

  try {
    // 1. 요청 파싱
    const body = await request.json();

    // 2. 검증
    const validation = signupSchema.safeParse(body);
    if (!validation.success) {
      const details: Record<string, string[]> = {};
      validation.error.errors.forEach(err => {
        const path = err.path.join('.');
        if (!details[path]) details[path] = [];
        details[path].push(err.message);
      });

      return NextResponse.json(
        createErrorResponse('GEN_002', '잘못된 요청입니다', { details }),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { email, password, fullName, agreeMarketing } = validation.data;

    // 3. 이메일 중복 확인
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id, deleted_at')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      if (existingUser.deleted_at) {
        return NextResponse.json(
          createErrorResponse('AUTH_006', '탈퇴한 계정입니다. 고객센터에 문의해주세요'),
          { status: HTTP_STATUS.FORBIDDEN }
        );
      }

      return NextResponse.json(
        createErrorResponse('AUTH_005', '이미 가입된 이메일입니다'),
        { status: HTTP_STATUS.CONFLICT }
      );
    }

    // 4. Supabase Auth 사용자 생성
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
    });

    if (authError) {
      console.error('Supabase Auth Error:', authError);
      return NextResponse.json(
        createErrorResponse('GEN_001', '회원가입에 실패했습니다', {
          reference: generateErrorReference(),
        }),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    // 5. Profile 생성
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: authData.user.id,
        email,
        full_name: fullName,
        tier: 'FREE',
        is_approved: false,
        agree_marketing: agreeMarketing,
      });

    if (profileError) {
      // 롤백
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);

      console.error('Profile Creation Error:', profileError);
      return NextResponse.json(
        createErrorResponse('GEN_001', '회원가입에 실패했습니다', {
          reference: generateErrorReference(),
        }),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }

    // 6. 감사 로그
    await logAudit({
      userId: authData.user.id,
      action: 'signup',
      details: { email, agreeMarketing },
      ...auditContext,
    });

    return NextResponse.json(
      createSuccessResponse({
        message: '이메일 인증 후 관리자 승인을 기다려주세요',
      }),
      { status: HTTP_STATUS.CREATED }
    );
  } catch (error) {
    console.error('Signup Error:', error);
    return NextResponse.json(
      createErrorResponse('GEN_001', '서비스 연결에 문제가 있습니다', {
        reference: generateErrorReference(),
      }),
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
});
```

---

### 7.2 로그인

```yaml
POST /api/auth/login
Rate Limit: 5회/분
인증: 불필요
```

#### 요청

```typescript
interface LoginRequest {
  email: string;
  password: string;
}

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});
```

#### 응답

```typescript
// 성공 (200 OK)
// Body
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "홍길동",
      "tier": "FREE"
    }
  }
}

// Set-Cookie 헤더
// refresh_token=abc123...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800

// 실패 - 잘못된 자격 증명 (401 Unauthorized)
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "이메일 또는 비밀번호를 확인해주세요"
  }
}

// 실패 - 승인 대기 (403 Forbidden)
{
  "success": false,
  "error": {
    "code": "AUTH_002",
    "message": "관리자 승인 대기 중입니다"
  }
}

// 실패 - 탈퇴한 계정 (403 Forbidden)
{
  "success": false,
  "error": {
    "code": "AUTH_006",
    "message": "탈퇴한 계정입니다"
  }
}
```

#### 구현

```typescript
// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { loginSchema } from '@/lib/validation/auth';
import { withRateLimit } from '@/lib/security/with-rate-limit';
import { generateSecureToken, hashToken } from '@/lib/crypto';
import { createSuccessResponse, createErrorResponse } from '@/types/api/response';
import { generateErrorReference } from '@/lib/utils/error';
import { logAudit, createAuditContext } from '@/lib/audit/logger';
import { HTTP_STATUS } from '@/constants/http-status';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cookie 설정
const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60, // 7일
};

export const POST = withRateLimit(async (request: NextRequest) => {
  const auditContext = createAuditContext(request);

  try {
    // 1. 요청 검증
    const body = await request.json();
    const validation = loginSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        createErrorResponse('AUTH_001', '이메일 또는 비밀번호를 확인해주세요'),
        { status: HTTP_STATUS.BAD_REQUEST }
      );
    }

    const { email, password } = validation.data;

    // 2. Supabase Auth 로그인
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      await logAudit({
        action: 'login_failed',
        details: { email, reason: 'invalid_credentials' },
        ...auditContext,
      });

      return NextResponse.json(
        createErrorResponse('AUTH_001', '이메일 또는 비밀번호를 확인해주세요'),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    // 3. 프로필 확인
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, tier, is_approved, deleted_at')
      .eq('id', authData.user.id)
      .single();

    // 탈퇴한 계정
    if (profile?.deleted_at) {
      return NextResponse.json(
        createErrorResponse('AUTH_006', '탈퇴한 계정입니다'),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    // 승인 대기
    if (!profile?.is_approved) {
      return NextResponse.json(
        createErrorResponse('AUTH_002', '관리자 승인 대기 중입니다'),
        { status: HTTP_STATUS.FORBIDDEN }
      );
    }

    // 4. Refresh Token 생성 및 저장
    const refreshToken = generateSecureToken(64);
    const tokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await supabaseAdmin.from('refresh_tokens').insert({
      user_id: authData.user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      revoked: false,
    });

    // 5. 세션 기록
    await supabaseAdmin.from('user_sessions').insert({
      user_id: authData.user.id,
      ip_address: auditContext.ipAddress,
      user_agent: auditContext.userAgent,
    });

    // 6. 감사 로그
    await logAudit({
      userId: authData.user.id,
      action: 'login',
      details: {},
      ...auditContext,
    });

    // 7. 응답
    const response = NextResponse.json(
      createSuccessResponse({
        accessToken: authData.session.access_token,
        expiresIn: 900,
        user: {
          id: authData.user.id,
          email: authData.user.email!,
          fullName: profile.full_name,
          tier: profile.tier,
        },
      }),
      { status: HTTP_STATUS.OK }
    );

    // 8. HttpOnly Cookie 설정
    response.cookies.set('refresh_token', refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);

    return response;
  } catch (error) {
    console.error('Login Error:', error);
    return NextResponse.json(
      createErrorResponse('GEN_001', '서비스 연결에 문제가 있습니다', {
        reference: generateErrorReference(),
      }),
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
});
```

---

### 7.3 토큰 갱신

```yaml
POST /api/auth/refresh
Rate Limit: 10회/분
인증: Refresh Token (Cookie)
```

#### 요청

```typescript
// 요청 Body 없음
// Cookie: refresh_token=abc123...
```

#### 응답

```typescript
// 성공 (200 OK)
// Body
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}

// Set-Cookie (새 Refresh Token - Rotation)
// refresh_token=xyz789...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800

// 실패 - 세션 만료 (401 Unauthorized)
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "세션이 만료되었습니다"
  }
}

// 실패 - 토큰 재사용 감지 (401 Unauthorized)
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "보안 문제가 감지되었습니다. 다시 로그인해주세요"
  }
}
```

#### 구현

```typescript
// app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { validateAndRotateRefreshToken } from '@/lib/auth/refresh-token';
import { withRateLimit } from '@/lib/security/with-rate-limit';
import { createSuccessResponse, createErrorResponse } from '@/types/api/response';
import { generateErrorReference } from '@/lib/utils/error';
import { createAuditContext } from '@/lib/audit/logger';
import { HTTP_STATUS } from '@/constants/http-status';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const REFRESH_TOKEN_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/api/auth',
  maxAge: 7 * 24 * 60 * 60,
};

export const POST = withRateLimit(async (request: NextRequest) => {
  const auditContext = createAuditContext(request);

  try {
    // 1. Cookie에서 Refresh Token 추출
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        createErrorResponse('AUTH_003', '세션이 만료되었습니다'),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    // 2. 토큰 검증 및 Rotation
    const result = await validateAndRotateRefreshToken(
      refreshToken,
      auditContext.ipAddress,
      auditContext.userAgent
    );

    if (!result.success) {
      const response = NextResponse.json(
        createErrorResponse(result.error!.code, result.error!.message),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );

      // 보안 위협 시 Cookie 삭제
      if (result.error?.isSecurityThreat) {
        response.cookies.delete('refresh_token');
      }

      return response;
    }

    // 3. 새 Access Token 발급
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(
      result.userId!
    );

    if (!userData.user) {
      return NextResponse.json(
        createErrorResponse('AUTH_003', '세션이 만료되었습니다'),
        { status: HTTP_STATUS.UNAUTHORIZED }
      );
    }

    // Supabase 세션 생성
    const { data: sessionData } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: userData.user.email!,
    });

    // 4. 응답
    const response = NextResponse.json(
      createSuccessResponse({
        accessToken: sessionData.properties?.access_token || '',
        expiresIn: 900,
      }),
      { status: HTTP_STATUS.OK }
    );

    // 5. 새 Refresh Token Cookie 설정
    response.cookies.set(
      'refresh_token',
      result.newRefreshToken!,
      REFRESH_TOKEN_COOKIE_OPTIONS
    );

    return response;
  } catch (error) {
    console.error('Token Refresh Error:', error);
    return NextResponse.json(
      createErrorResponse('GEN_001', '서비스 연결에 문제가 있습니다', {
        reference: generateErrorReference(),
      }),
      { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
    );
  }
});
```

---

### 7.4 로그아웃

```yaml
POST /api/auth/logout
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "로그아웃되었습니다"
  }
}

// Set-Cookie (삭제)
// refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0
```

---

### 7.5 비밀번호 변경

```yaml
POST /api/auth/change-password
Rate Limit: 3회/분
인증: Access Token
```

#### 요청

```typescript
interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}
```

#### 응답

```typescript
// 성공 (200 OK) - 모든 세션 무효화됨
{
  "success": true,
  "data": {
    "message": "비밀번호가 변경되었습니다. 다시 로그인해주세요"
  }
}

// 실패 - 현재 비밀번호 불일치 (401 Unauthorized)
{
  "success": false,
  "error": {
    "code": "AUTH_001",
    "message": "현재 비밀번호가 일치하지 않습니다"
  }
}
```

---

### 7.6 비밀번호 재설정 요청

```yaml
POST /api/auth/forgot-password
Rate Limit: 3회/5분
인증: 불필요
```

#### 요청

```typescript
interface ForgotPasswordRequest {
  email: string;
}
```

#### 응답

```typescript
// 성공 (200 OK) - 이메일 존재 여부 노출하지 않음
{
  "success": true,
  "data": {
    "message": "등록된 이메일이라면 비밀번호 재설정 링크가 발송됩니다"
  }
}
```

---

## 8. Q&A 세션 API

### 8.1 Q&A 세션 생성

```yaml
POST /api/qa
Rate Limit: 기본
인증: Access Token
```

#### 요청

```typescript
interface CreateQASessionRequest {
  title?: string;  // 선택적, 기본값 "새 프로젝트"
}

export const createQASessionSchema = z.object({
  title: z.string().max(100).optional().default('새 프로젝트'),
});
```

#### 응답

```typescript
// 성공 (201 Created)
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "새 프로젝트",
    "currentStep": 1,
    "status": "in_progress",
    "answers": {},
    "createdAt": "2025-01-15T10:00:00Z"
  }
}

// 실패 - 프로젝트 수 제한 초과 (429 Too Many Requests)
{
  "success": false,
  "error": {
    "code": "QA_001",
    "message": "프로젝트 수 제한(3개)을 초과했습니다. 업그레이드하거나 기존 프로젝트를 삭제해주세요"
  }
}
```

#### 구현

```typescript
// app/api/qa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/verify';
import { withRateLimit } from '@/lib/security/with-rate-limit';
import { createQASessionSchema } from '@/lib/validation/qa';
import { createSuccessResponse, createErrorResponse } from '@/types/api/response';
import { TIER_LIMITS } from '@/types/database/profiles';
import { HTTP_STATUS } from '@/constants/http-status';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = withRateLimit(
  withAuth(async (request: NextRequest, userId: string) => {
    try {
      // 1. 요청 검증
      const body = await request.json().catch(() => ({}));
      const validation = createQASessionSchema.safeParse(body);
      const title = validation.success ? validation.data.title : '새 프로젝트';

      // 2. 사용자 티어 및 프로젝트 수 확인
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      const maxProjects = TIER_LIMITS[profile?.tier || 'FREE'].maxProjects;

      if (maxProjects !== -1) {
        const { count } = await supabaseAdmin
          .from('qa_sessions')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .is('deleted_at', null);

        if (count !== null && count >= maxProjects) {
          return NextResponse.json(
            createErrorResponse(
              'QA_001',
              `프로젝트 수 제한(${maxProjects}개)을 초과했습니다. 업그레이드하거나 기존 프로젝트를 삭제해주세요`
            ),
            { status: HTTP_STATUS.TOO_MANY_REQUESTS }
          );
        }
      }

      // 3. Q&A 세션 생성
      const { data: session, error } = await supabaseAdmin
        .from('qa_sessions')
        .insert({
          user_id: userId,
          title,
          current_step: 1,
          status: 'in_progress',
          answers: {},
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return NextResponse.json(
        createSuccessResponse({
          id: session.id,
          title: session.title,
          currentStep: session.current_step,
          status: session.status,
          answers: session.answers,
          createdAt: session.created_at,
        }),
        { status: HTTP_STATUS.CREATED }
      );
    } catch (error) {
      console.error('Create QA Session Error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', '세션 생성에 실패했습니다'),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }
  })
);
```

---

### 8.2 Q&A 세션 목록 조회

```yaml
GET /api/qa
Rate Limit: 기본
인증: Access Token
Query: ?page=1&limit=10&status=all
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "1인 코칭 비즈니스",
      "currentStep": 25,
      "totalSteps": 40,
      "progress": 62,
      "status": "in_progress",
      "createdAt": "2025-01-10T09:00:00Z",
      "updatedAt": "2025-01-14T15:30:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

### 8.3 Q&A 세션 상세 조회

```yaml
GET /api/qa/:id
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "1인 코칭 비즈니스",
    "currentStep": 25,
    "status": "in_progress",
    "answers": {
      "1": "1인 코칭 비즈니스",
      "2": "직장인들의 커리어 전환을 돕는 코칭",
      // ... 24개 답변
    },
    "createdAt": "2025-01-10T09:00:00Z",
    "updatedAt": "2025-01-14T15:30:00Z"
  }
}

// 실패 - 찾을 수 없음 (404 Not Found)
{
  "success": false,
  "error": {
    "code": "QA_002",
    "message": "세션을 찾을 수 없습니다"
  }
}
```

---

### 8.4 답변 저장 (자동 저장)

```yaml
PATCH /api/qa/:id/answer
Rate Limit: 기본
인증: Access Token
```

#### 요청

```typescript
interface SaveAnswerRequest {
  questionId: number;
  answer: string;
}

export const saveAnswerSchema = z.object({
  questionId: z.number().int().min(1).max(40),
  answer: z.string().max(5000),
});
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "questionId": 5,
    "currentStep": 6,
    "progress": 12,
    "savedAt": "2025-01-15T10:30:00Z"
  }
}
```

#### 구현

```typescript
// app/api/qa/[id]/answer/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/verify';
import { saveAnswerSchema } from '@/lib/validation/qa';
import { createSuccessResponse, createErrorResponse } from '@/types/api/response';
import { HTTP_STATUS } from '@/constants/http-status';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TOTAL_QUESTIONS = 40;

export const PATCH = withAuth(
  async (request: NextRequest, userId: string, { params }: { params: { id: string } }) => {
    try {
      const sessionId = params.id;

      // 1. 요청 검증
      const body = await request.json();
      const validation = saveAnswerSchema.safeParse(body);

      if (!validation.success) {
        return NextResponse.json(
          createErrorResponse('GEN_002', '잘못된 요청입니다'),
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }

      const { questionId, answer } = validation.data;

      // 2. 세션 소유권 확인
      const { data: session, error: fetchError } = await supabaseAdmin
        .from('qa_sessions')
        .select('id, user_id, answers, status')
        .eq('id', sessionId)
        .is('deleted_at', null)
        .single();

      if (fetchError || !session) {
        return NextResponse.json(
          createErrorResponse('QA_002', '세션을 찾을 수 없습니다'),
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }

      if (session.user_id !== userId) {
        return NextResponse.json(
          createErrorResponse('GEN_003', '접근 권한이 없습니다'),
          { status: HTTP_STATUS.FORBIDDEN }
        );
      }

      if (session.status === 'completed') {
        return NextResponse.json(
          createErrorResponse('QA_003', '이미 완료된 세션입니다'),
          { status: HTTP_STATUS.BAD_REQUEST }
        );
      }

      // 3. 답변 업데이트
      const updatedAnswers = {
        ...session.answers,
        [questionId.toString()]: answer,
      };

      // 현재 스텝 계산 (가장 높은 답변 번호 + 1, 최대 40)
      const answeredQuestions = Object.keys(updatedAnswers).map(Number);
      const maxAnswered = Math.max(...answeredQuestions, 0);
      const newCurrentStep = Math.min(maxAnswered + 1, TOTAL_QUESTIONS);

      // 상태 업데이트 (모든 질문 완료 시)
      const newStatus = answeredQuestions.length >= TOTAL_QUESTIONS ? 'completed' : 'in_progress';

      const { error: updateError } = await supabaseAdmin
        .from('qa_sessions')
        .update({
          answers: updatedAnswers,
          current_step: newCurrentStep,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      if (updateError) {
        throw updateError;
      }

      const progress = Math.round((answeredQuestions.length / TOTAL_QUESTIONS) * 100);

      return NextResponse.json(
        createSuccessResponse({
          questionId,
          currentStep: newCurrentStep,
          progress,
          savedAt: new Date().toISOString(),
        }),
        { status: HTTP_STATUS.OK }
      );
    } catch (error) {
      console.error('Save Answer Error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', '답변 저장에 실패했습니다'),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }
  }
);
```

---

### 8.5 Q&A 세션 삭제 (Soft Delete)

```yaml
DELETE /api/qa/:id
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "삭제되었습니다. 30일 이내 복구 가능합니다.",
    "deletedAt": "2025-01-15T10:30:00Z",
    "recoveryDeadline": "2025-02-14T10:30:00Z"
  }
}
```

---

## 9. 랜딩페이지 API

### 9.1 랜딩페이지 목록 조회

```yaml
GET /api/lp
Rate Limit: 기본
인증: Access Token
Query: ?page=1&limit=10&status=all&includeDeleted=false
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "1인 코칭 비즈니스 런칭 가이드",
      "status": "published",
      "slug": "coaching-business-guide",
      "publishedUrl": "https://magnetic-sales.com/p/coaching-business-guide",
      "qaSessionId": "uuid",
      "createdAt": "2025-01-10T09:00:00Z",
      "updatedAt": "2025-01-14T15:30:00Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2,
    "totalPages": 1,
    "hasMore": false
  }
}
```

---

### 9.2 랜딩페이지 상세 조회

```yaml
GET /api/lp/:id
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "1인 코칭 비즈니스 런칭 가이드",
    "status": "draft",
    "slug": null,
    "content": {
      "desire": {
        "headline": "당신도 1인 코칭 비즈니스로 월 1000만원 달성할 수 있습니다",
        "subHeadline": "직장인에서 자유로운 코치로의 전환, 지금 시작하세요",
        "heroImage": "https://...",
        "cta": {
          "text": "무료 상담 신청하기",
          "action": "scroll_to_form"
        }
      },
      "problem": {
        "title": "이런 고민, 혹시 당신도?",
        "painPoints": [
          "매일 반복되는 회사 생활에 지쳐있다",
          "내 전문성으로 더 많은 수입을 올리고 싶다",
          "시간과 장소에 구애받지 않고 일하고 싶다"
        ],
        "emotionalHook": "더 이상 남의 시간표대로 살고 싶지 않으시죠?"
      },
      // ... 나머지 섹션
    },
    "qaSessionId": "uuid",
    "createdAt": "2025-01-10T09:00:00Z",
    "updatedAt": "2025-01-14T15:30:00Z"
  }
}
```

---

### 9.3 랜딩페이지 콘텐츠 수정

```yaml
PATCH /api/lp/:id
Rate Limit: 기본
인증: Access Token
```

#### 요청

```typescript
interface UpdateLandingPageRequest {
  title?: string;
  content?: Partial<LandingPageContent>;
}

export const updateLandingPageSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.record(z.unknown()).optional(),
});
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "수정된 제목",
    "updatedAt": "2025-01-15T11:00:00Z"
  }
}
```

---

### 9.4 랜딩페이지 배포

```yaml
POST /api/lp/:id/publish
Rate Limit: 기본
인증: Access Token
```

#### 요청

```typescript
interface PublishRequest {
  slug?: string;  // 선택적, 미입력 시 자동 생성
}

export const publishSchema = z.object({
  slug: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z0-9-]+$/, '영문 소문자, 숫자, 하이픈만 사용 가능합니다')
    .optional(),
});
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "published",
    "slug": "my-landing-page",
    "publishedUrl": "https://magnetic-sales.com/p/my-landing-page",
    "publishedAt": "2025-01-15T11:00:00Z"
  }
}

// 실패 - 슬러그 중복 (409 Conflict)
{
  "success": false,
  "error": {
    "code": "LP_004",
    "message": "이미 사용 중인 URL입니다"
  }
}

// 실패 - 랜딩페이지 수 제한 초과 (429)
{
  "success": false,
  "error": {
    "code": "LP_003",
    "message": "배포된 랜딩페이지 수 제한(5개)을 초과했습니다"
  }
}
```

#### 구현

```typescript
// app/api/lp/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/verify';
import { publishSchema } from '@/lib/validation/lp';
import { createSuccessResponse, createErrorResponse } from '@/types/api/response';
import { TIER_LIMITS } from '@/types/database/profiles';
import { generateSlug } from '@/lib/utils/slug';
import { HTTP_STATUS } from '@/constants/http-status';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const POST = withAuth(
  async (request: NextRequest, userId: string, { params }: { params: { id: string } }) => {
    try {
      const lpId = params.id;

      // 1. 요청 검증
      const body = await request.json().catch(() => ({}));
      const validation = publishSchema.safeParse(body);
      let slug = validation.success ? validation.data.slug : undefined;

      // 2. 랜딩페이지 조회 및 소유권 확인
      const { data: lp, error: fetchError } = await supabaseAdmin
        .from('landing_pages')
        .select('id, user_id, title, status')
        .eq('id', lpId)
        .is('deleted_at', null)
        .single();

      if (fetchError || !lp) {
        return NextResponse.json(
          createErrorResponse('LP_001', '랜딩페이지를 찾을 수 없습니다'),
          { status: HTTP_STATUS.NOT_FOUND }
        );
      }

      if (lp.user_id !== userId) {
        return NextResponse.json(
          createErrorResponse('GEN_003', '접근 권한이 없습니다'),
          { status: HTTP_STATUS.FORBIDDEN }
        );
      }

      // 3. 배포 수 제한 확인
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      const maxPages = TIER_LIMITS[profile?.tier || 'FREE'].maxLandingPages;

      if (maxPages !== -1) {
        const { count } = await supabaseAdmin
          .from('landing_pages')
          .select('id', { count: 'exact' })
          .eq('user_id', userId)
          .eq('status', 'published')
          .is('deleted_at', null);

        if (count !== null && count >= maxPages) {
          return NextResponse.json(
            createErrorResponse(
              'LP_003',
              `배포된 랜딩페이지 수 제한(${maxPages}개)을 초과했습니다`
            ),
            { status: HTTP_STATUS.TOO_MANY_REQUESTS }
          );
        }
      }

      // 4. 슬러그 생성/검증
      if (!slug) {
        slug = generateSlug(lp.title);
      }

      // 슬러그 중복 확인
      const { data: existingSlug } = await supabaseAdmin
        .from('landing_pages')
        .select('id')
        .eq('slug', slug)
        .neq('id', lpId)
        .maybeSingle();

      if (existingSlug) {
        return NextResponse.json(
          createErrorResponse('LP_004', '이미 사용 중인 URL입니다'),
          { status: HTTP_STATUS.CONFLICT }
        );
      }

      // 5. 배포 처리
      const publishedUrl = `${process.env.NEXT_PUBLIC_APP_URL}/p/${slug}`;

      const { error: updateError } = await supabaseAdmin
        .from('landing_pages')
        .update({
          status: 'published',
          slug,
          published_url: publishedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lpId);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json(
        createSuccessResponse({
          id: lpId,
          status: 'published',
          slug,
          publishedUrl,
          publishedAt: new Date().toISOString(),
        }),
        { status: HTTP_STATUS.OK }
      );
    } catch (error) {
      console.error('Publish LP Error:', error);
      return NextResponse.json(
        createErrorResponse('GEN_001', '배포에 실패했습니다'),
        { status: HTTP_STATUS.INTERNAL_SERVER_ERROR }
      );
    }
  }
);
```

---

### 9.5 랜딩페이지 배포 취소

```yaml
POST /api/lp/:id/unpublish
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "draft",
    "message": "배포가 취소되었습니다"
  }
}
```

---

### 9.6 랜딩페이지 삭제 (Soft Delete)

```yaml
DELETE /api/lp/:id
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "삭제되었습니다. 30일 이내 복구 가능합니다.",
    "deletedAt": "2025-01-15T10:30:00Z",
    "recoveryDeadline": "2025-02-14T10:30:00Z"
  }
}
```

---

### 9.7 랜딩페이지 복구

```yaml
POST /api/lp/:id/restore
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "복구되었습니다",
    "id": "uuid"
  }
}

// 실패 - 복구 기간 만료 (410 Gone)
{
  "success": false,
  "error": {
    "code": "LP_002",
    "message": "복구 기간(30일)이 만료되었습니다"
  }
}
```

---

### 9.8 삭제된 랜딩페이지 목록

```yaml
GET /api/lp/deleted
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "테스트 랜딩페이지",
      "deletedAt": "2025-01-12T08:00:00Z",
      "daysRemaining": 28,
      "canRestore": true
    }
  ]
}
```

---

### 9.9 공개 랜딩페이지 조회

```yaml
GET /api/lp/public/:slug
Rate Limit: 기본
인증: 불필요
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "title": "1인 코칭 비즈니스 런칭 가이드",
    "content": {
      // DESIRE-MAGNETIC 콘텐츠 전체
    },
    "googleForm": {
      "embedUrl": "https://docs.google.com/forms/d/e/.../viewform?embedded=true",
      "embedMode": "popup"
    },
    "ctaButtons": [
      {
        "id": "uuid",
        "sectionId": "hero",
        "type": "primary",
        "text": "무료 상담 신청하기",
        "action": { "type": "scroll_to_form" },
        "style": { "backgroundColor": "#3B82F6" }
      }
    ],
    "meta": {
      "title": "1인 코칭 비즈니스 런칭 가이드",
      "description": "직장인에서 자유로운 코치로...",
      "ogImage": "https://..."
    }
  }
}

// 실패 - 찾을 수 없음 (404 Not Found)
{
  "success": false,
  "error": {
    "code": "LP_001",
    "message": "페이지를 찾을 수 없습니다"
  }
}
```

---

## 10. AI 생성 API

### 10.1 랜딩페이지 생성

```yaml
POST /api/ai/generate
Rate Limit: 5회/분
인증: Access Token
Content-Type: application/json
응답: SSE (Server-Sent Events)
```

#### 요청

```typescript
interface GenerateRequest {
  qaSessionId: string;
  options?: {
    tone?: 'professional' | 'casual' | 'friendly';
    length?: 'short' | 'medium' | 'long';
    emphasis?: string[];
  };
}

export const generateSchema = z.object({
  qaSessionId: z.string().uuid(),
  options: z.object({
    tone: z.enum(['professional', 'casual', 'friendly']).optional(),
    length: z.enum(['short', 'medium', 'long']).optional(),
    emphasis: z.array(z.string()).max(5).optional(),
  }).optional(),
});
```

#### 응답 (SSE)

```typescript
// 이벤트 스트림
event: progress
data: {"step": "reserving", "progress": 5, "message": "토큰 예약 중..."}

event: progress
data: {"step": "analyzing", "progress": 20, "message": "고객 페르소나 분석 중..."}

event: progress
data: {"step": "generating_desire", "progress": 30, "message": "마그네틱 헤드라인 생성 중..."}

event: progress
data: {"step": "generating_problem", "progress": 40, "message": "문제점 섹션 생성 중..."}

event: progress
data: {"step": "generating_solution", "progress": 50, "message": "솔루션 섹션 생성 중..."}

event: progress
data: {"step": "generating_proof", "progress": 60, "message": "소셜 프루프 생성 중..."}

event: progress
data: {"step": "generating_offer", "progress": 70, "message": "오퍼 섹션 생성 중..."}

event: progress
data: {"step": "generating_urgency", "progress": 80, "message": "긴급성 요소 생성 중..."}

event: progress
data: {"step": "finalizing", "progress": 90, "message": "최종 검증 중..."}

event: complete
data: {"id": "uuid", "title": "생성된 제목", "previewUrl": "/preview/uuid", "tokensUsed": 45000}

// 에러 시
event: error
data: {"code": "AI_001", "message": "생성에 실패했습니다"}
```

#### 구현

```typescript
// app/api/ai/generate/route.ts
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserIdFromToken } from '@/lib/auth/verify';
import { generateSchema } from '@/lib/validation/ai';
import { checkAndReserveTokens, confirmTokenUsage, cancelTokenReservation } from '@/lib/ai/token-manager';
import { generateLandingPage } from '@/lib/ai/generator';
import { logAudit, createAuditContext } from '@/lib/audit/logger';
import { checkRateLimit } from '@/lib/security/rate-limit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // SSE 스트림 생성
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const auditContext = createAuditContext(request);

      try {
        // 1. 인증 확인
        const userId = await getUserIdFromToken(request);
        if (!userId) {
          sendEvent('error', { code: 'AUTH_003', message: '세션이 만료되었습니다' });
          controller.close();
          return;
        }

        // 2. Rate Limit 확인
        const rateLimitResult = await checkRateLimit(userId, '/api/ai/generate');
        if (!rateLimitResult.allowed) {
          sendEvent('error', { code: 'RATE_001', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' });
          controller.close();
          return;
        }

        // 3. 요청 검증
        const body = await request.json();
        const validation = generateSchema.safeParse(body);
        if (!validation.success) {
          sendEvent('error', { code: 'GEN_002', message: '잘못된 요청입니다' });
          controller.close();
          return;
        }

        const { qaSessionId, options } = validation.data;

        // 4. Q&A 세션 확인
        const { data: qaSession } = await supabaseAdmin
          .from('qa_sessions')
          .select('id, user_id, answers, status')
          .eq('id', qaSessionId)
          .is('deleted_at', null)
          .single();

        if (!qaSession || qaSession.user_id !== userId) {
          sendEvent('error', { code: 'QA_002', message: '세션을 찾을 수 없습니다' });
          controller.close();
          return;
        }

        if (qaSession.status !== 'completed') {
          sendEvent('error', { code: 'QA_004', message: '모든 질문에 답변해야 생성할 수 있습니다' });
          controller.close();
          return;
        }

        // 5. 토큰 예약
        sendEvent('progress', { step: 'reserving', progress: 5, message: '토큰 예약 중...' });

        const estimatedTokens = 50000; // 예상 토큰
        const reservation = await checkAndReserveTokens(userId, estimatedTokens);

        if (!reservation.success) {
          sendEvent('error', { code: 'TOKEN_001', message: reservation.message });
          controller.close();
          return;
        }

        const reservationId = reservation.reservationId;

        try {
          // 6. AI 생성 (진행률 콜백)
          const result = await generateLandingPage(
            qaSession.answers,
            options,
            (step, progress, message) => {
              sendEvent('progress', { step, progress, message });
            }
          );

          // 7. 랜딩페이지 저장
          const { data: landingPage, error: lpError } = await supabaseAdmin
            .from('landing_pages')
            .insert({
              user_id: userId,
              qa_session_id: qaSessionId,
              title: result.title,
              content: result.content,
              status: 'draft',
            })
            .select()
            .single();

          if (lpError) {
            throw lpError;
          }

          // 8. 토큰 사용 확정
          await confirmTokenUsage(reservationId, result.tokensUsed, 'landing_page_generation', {
            landing_page_id: landingPage.id,
          });

          // 9. 감사 로그
          await logAudit({
            userId,
            action: 'landing_page_generated',
            details: {
              landing_page_id: landingPage.id,
              qa_session_id: qaSessionId,
              tokens_used: result.tokensUsed,
            },
            ...auditContext,
          });

          // 10. 완료
          sendEvent('complete', {
            id: landingPage.id,
            title: result.title,
            previewUrl: `/preview/${landingPage.id}`,
            tokensUsed: result.tokensUsed,
          });

        } catch (error) {
          // 토큰 예약 취소
          await cancelTokenReservation(reservationId);
          throw error;
        }

      } catch (error) {
        console.error('AI Generate Error:', error);
        sendEvent('error', { code: 'AI_001', message: '생성에 실패했습니다. 다시 시도해주세요' });
      } finally {
        controller.close();
      }
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
```

---

### 10.2 토큰 사용량 조회

```yaml
GET /api/ai/tokens
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "tier": "FREE",
    "dailyLimit": 100000,
    "usedToday": 45230,
    "reserved": 5000,
    "available": 49770,
    "resetAt": "2025-01-16T00:00:00Z",
    "history": [
      {
        "date": "2025-01-15",
        "used": 45230,
        "actions": [
          { "action": "landing_page_generation", "tokens": 42000 },
          { "action": "regeneration", "tokens": 3230 }
        ]
      }
    ]
  }
}
```

---

### 10.3 섹션 재생성

```yaml
POST /api/ai/regenerate
Rate Limit: 3회/분
인증: Access Token
```

#### 요청

```typescript
interface RegenerateRequest {
  landingPageId: string;
  section: 'desire' | 'problem' | 'solution' | 'socialProof' | 'offer' | 'urgency' | 'faq';
  instructions?: string;
}

export const regenerateSchema = z.object({
  landingPageId: z.string().uuid(),
  section: z.enum(['desire', 'problem', 'solution', 'socialProof', 'offer', 'urgency', 'faq']),
  instructions: z.string().max(500).optional(),
});
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "section": "desire",
    "content": {
      "headline": "새로운 헤드라인...",
      "subHeadline": "새로운 서브헤드라인...",
      // ...
    },
    "tokensUsed": 3500
  }
}
```

---

## 11. Google Form API

### 11.1 폼 설정 저장

```yaml
POST /api/lp/:id/form
Rate Limit: 기본
인증: Access Token
```

#### 요청

```typescript
interface GoogleFormConfigRequest {
  formUrl: string;
  embedMode: 'inline' | 'popup' | 'new_tab';
}

export const googleFormConfigSchema = z.object({
  formUrl: z
    .string()
    .url()
    .refine(url => url.includes('docs.google.com/forms'), {
      message: 'Google Forms URL이 아닙니다',
    }),
  embedMode: z.enum(['inline', 'popup', 'new_tab']).default('popup'),
});
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "id": "uuid",
    "formUrl": "https://docs.google.com/forms/d/e/.../viewform",
    "formId": "extracted-form-id",
    "embedUrl": "https://docs.google.com/forms/d/e/.../viewform?embedded=true",
    "embedMode": "popup",
    "status": "active"
  }
}

// 실패 - 잘못된 URL (400)
{
  "success": false,
  "error": {
    "code": "FORM_001",
    "message": "유효한 Google Forms URL을 입력해주세요"
  }
}
```

---

### 11.2 폼 설정 조회

```yaml
GET /api/lp/:id/form
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "id": "uuid",
    "formUrl": "https://docs.google.com/forms/d/e/.../viewform",
    "formId": "extracted-form-id",
    "embedUrl": "https://docs.google.com/forms/d/e/.../viewform?embedded=true",
    "embedMode": "popup",
    "status": "active",
    "verifiedAt": "2025-01-15T10:00:00Z"
  }
}

// 폼이 없는 경우 (200 OK)
{
  "success": true,
  "data": null
}
```

---

### 11.3 폼 설정 삭제

```yaml
DELETE /api/lp/:id/form
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "Google Form 설정이 삭제되었습니다"
  }
}
```

---

## 12. CTA 버튼 API

### 12.1 CTA 버튼 목록 조회

```yaml
GET /api/lp/:id/cta
Rate Limit: 기본
인증: Access Token
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "sectionId": "hero",
      "type": "primary",
      "text": "무료 상담 신청하기",
      "action": {
        "type": "scroll_to_form"
      },
      "style": {
        "backgroundColor": "#3B82F6",
        "textColor": "#FFFFFF",
        "borderRadius": "8px"
      },
      "position": {
        "alignment": "center"
      },
      "isVisible": true,
      "clickCount": 150
    }
  ]
}
```

---

### 12.2 CTA 버튼 생성

```yaml
POST /api/lp/:id/cta
Rate Limit: 기본
인증: Access Token
```

#### 요청

```typescript
interface CreateCTAButtonRequest {
  sectionId: string;
  type: 'primary' | 'secondary' | 'text';
  text: string;
  action: {
    type: 'scroll_to_form' | 'open_form_popup' | 'external_link' | 'custom';
    url?: string;
  };
  style?: {
    backgroundColor?: string;
    textColor?: string;
    borderRadius?: string;
  };
  position?: {
    alignment?: 'left' | 'center' | 'right';
  };
}

export const createCTAButtonSchema = z.object({
  sectionId: z.string().min(1).max(50),
  type: z.enum(['primary', 'secondary', 'text']),
  text: z.string().min(1).max(100),
  action: z.object({
    type: z.enum(['scroll_to_form', 'open_form_popup', 'external_link', 'custom']),
    url: z.string().url().optional(),
  }),
  style: z.object({
    backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    borderRadius: z.string().optional(),
  }).optional(),
  position: z.object({
    alignment: z.enum(['left', 'center', 'right']).optional(),
  }).optional(),
});
```

#### 응답

```typescript
// 성공 (201 Created)
{
  "success": true,
  "data": {
    "id": "uuid",
    "sectionId": "hero",
    "type": "primary",
    "text": "무료 상담 신청하기",
    "createdAt": "2025-01-15T10:00:00Z"
  }
}
```

---

### 12.3 CTA 버튼 수정

```yaml
PATCH /api/lp/:id/cta/:ctaId
Rate Limit: 기본
인증: Access Token
```

---

### 12.4 CTA 버튼 삭제

```yaml
DELETE /api/lp/:id/cta/:ctaId
Rate Limit: 기본
인증: Access Token
```

---

### 12.5 CTA 클릭 이벤트 기록

```yaml
POST /api/lp/public/:slug/cta/:ctaId/click
Rate Limit: 기본
인증: 불필요 (공개 API)
```

#### 요청

```typescript
interface CTAClickEventRequest {
  deviceType?: 'desktop' | 'tablet' | 'mobile';
  referrer?: string;
}
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "recorded": true
  }
}
```

---

## 13. 관리자 API

### 13.1 사용자 목록 조회

```yaml
GET /api/admin/users
Rate Limit: 관리자
인증: Access Token (ENTERPRISE)
Query: ?page=1&limit=20&status=pending&search=email
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "홍길동",
      "tier": "FREE",
      "isApproved": false,
      "agreeMarketing": true,
      "createdAt": "2025-01-15T09:00:00Z",
      "lastLoginAt": "2025-01-15T10:00:00Z",
      "projectCount": 2,
      "landingPageCount": 1
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasMore": true
  }
}
```

---

### 13.2 사용자 승인

```yaml
POST /api/admin/users/:id/approve
Rate Limit: 관리자
인증: Access Token (ENTERPRISE)
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "사용자가 승인되었습니다",
    "userId": "uuid",
    "sessionsInvalidated": true
  }
}
```

---

### 13.3 사용자 거부

```yaml
POST /api/admin/users/:id/reject
Rate Limit: 관리자
인증: Access Token (ENTERPRISE)
```

#### 요청

```typescript
interface RejectUserRequest {
  reason?: string;
}
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "사용자가 거부되었습니다",
    "userId": "uuid"
  }
}
```

---

### 13.4 사용자 티어 변경

```yaml
PATCH /api/admin/users/:id/tier
Rate Limit: 관리자
인증: Access Token (ENTERPRISE)
```

#### 요청

```typescript
interface ChangeTierRequest {
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
}
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "티어가 변경되었습니다",
    "userId": "uuid",
    "newTier": "PRO",
    "sessionsInvalidated": true
  }
}
```

---

### 13.5 감사 로그 조회

```yaml
GET /api/admin/audit-logs
Rate Limit: 관리자
인증: Access Token (ENTERPRISE)
Query: ?userId=uuid&action=login&startDate=2025-01-01&endDate=2025-01-15&limit=100
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userEmail": "user@example.com",
      "action": "login",
      "details": {
        "ip": "123.45.67.89"
      },
      "ipAddress": "123.45.67.89",
      "userAgent": "Mozilla/5.0...",
      "createdAt": "2025-01-15T09:30:00Z"
    }
  ],
  "meta": {
    "total": 1234,
    "limit": 100
  }
}
```

---

### 13.6 대시보드 통계

```yaml
GET /api/admin/stats
Rate Limit: 관리자
인증: Access Token (ENTERPRISE)
Query: ?period=7d
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "users": {
      "total": 1250,
      "pending": 23,
      "newThisWeek": 45,
      "activeThisWeek": 380
    },
    "landingPages": {
      "total": 3420,
      "published": 1890,
      "generatedThisWeek": 156
    },
    "tokens": {
      "usedThisWeek": 45000000,
      "avgPerUser": 36000
    },
    "errors": {
      "total": 12,
      "critical": 0
    },
    "trends": {
      "signups": [10, 15, 12, 18, 20, 14, 11],
      "generations": [45, 52, 48, 60, 55, 42, 38]
    }
  }
}
```

---

## 14. 파일 업로드 API

### 14.1 이미지 업로드

```yaml
POST /api/storage/upload
Rate Limit: 10회/분
인증: Access Token
Content-Type: multipart/form-data
```

#### 요청

```typescript
// FormData
{
  file: File,           // 이미지 파일
  type: 'hero' | 'testimonial' | 'product' | 'logo',
  landingPageId?: string
}
```

#### 응답

```typescript
// 성공 (201 Created)
{
  "success": true,
  "data": {
    "url": "https://supabase.co/storage/v1/object/public/landing-images/uuid/hero.webp",
    "path": "uuid/hero.webp",
    "size": 245678,
    "mimeType": "image/webp"
  }
}

// 실패 - 파일 크기 초과 (413)
{
  "success": false,
  "error": {
    "code": "STORAGE_001",
    "message": "파일 크기가 5MB를 초과합니다"
  }
}

// 실패 - 지원하지 않는 형식 (415)
{
  "success": false,
  "error": {
    "code": "STORAGE_002",
    "message": "지원하지 않는 파일 형식입니다 (JPG, PNG, WebP만 허용)"
  }
}
```

---

### 14.2 이미지 삭제

```yaml
DELETE /api/storage/delete
Rate Limit: 기본
인증: Access Token
```

#### 요청

```typescript
interface DeleteImageRequest {
  path: string;
}
```

#### 응답

```typescript
// 성공 (200 OK)
{
  "success": true,
  "data": {
    "message": "이미지가 삭제되었습니다"
  }
}
```

---

## 15. 에러 코드 정의

### 15.1 인증 에러 (AUTH)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| AUTH_001 | 401 | 이메일 또는 비밀번호를 확인해주세요 |
| AUTH_002 | 403 | 관리자 승인 대기 중입니다 |
| AUTH_003 | 401 | 세션이 만료되었습니다 |
| AUTH_004 | 401 | 보안 문제가 감지되었습니다. 다시 로그인해주세요 |
| AUTH_005 | 409 | 이미 가입된 이메일입니다 |
| AUTH_006 | 403 | 탈퇴한 계정입니다 |

### 15.2 Q&A 에러 (QA)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| QA_001 | 429 | 프로젝트 수 제한을 초과했습니다 |
| QA_002 | 404 | 세션을 찾을 수 없습니다 |
| QA_003 | 400 | 이미 완료된 세션입니다 |
| QA_004 | 400 | 모든 질문에 답변해야 합니다 |

### 15.3 랜딩페이지 에러 (LP)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| LP_001 | 404 | 랜딩페이지를 찾을 수 없습니다 |
| LP_002 | 410 | 복구 기간(30일)이 만료되었습니다 |
| LP_003 | 429 | 랜딩페이지 수 제한을 초과했습니다 |
| LP_004 | 409 | 이미 사용 중인 URL입니다 |

### 15.4 토큰 에러 (TOKEN)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| TOKEN_001 | 429 | 토큰이 부족합니다 |
| TOKEN_002 | 429 | 오늘의 사용량을 모두 소진했습니다 |

### 15.5 AI 에러 (AI)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| AI_001 | 500 | 생성에 실패했습니다 |
| AI_002 | 408 | 요청 시간이 초과되었습니다 |
| AI_003 | 400 | 입력 내용이 적합하지 않습니다 |

### 15.6 Google Form 에러 (FORM)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| FORM_001 | 400 | 유효한 Google Forms URL을 입력해주세요 |
| FORM_002 | 400 | 폼에 접근할 수 없습니다 |

### 15.7 스토리지 에러 (STORAGE)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| STORAGE_001 | 413 | 파일 크기가 5MB를 초과합니다 |
| STORAGE_002 | 415 | 지원하지 않는 파일 형식입니다 |
| STORAGE_003 | 507 | 저장 공간이 부족합니다 |

### 15.8 Rate Limit 에러 (RATE)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| RATE_001 | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해주세요 |

### 15.9 CORS 에러 (CORS)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| CORS_001 | 403 | 허용되지 않은 요청입니다 |

### 15.10 일반 에러 (GEN)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| GEN_001 | 500 | 서비스 연결에 문제가 있습니다 |
| GEN_002 | 400 | 잘못된 요청입니다 |
| GEN_003 | 403 | 접근 권한이 없습니다 |

---

## 16. API 엔드포인트 요약

### 16.1 인증 API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| POST | /api/auth/signup | 회원가입 | 3/분 | - |
| POST | /api/auth/login | 로그인 | 5/분 | - |
| POST | /api/auth/refresh | 토큰 갱신 | 10/분 | Cookie |
| POST | /api/auth/logout | 로그아웃 | 기본 | Bearer |
| POST | /api/auth/change-password | 비밀번호 변경 | 3/분 | Bearer |
| POST | /api/auth/forgot-password | 비밀번호 재설정 요청 | 3/5분 | - |

### 16.2 Q&A API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| GET | /api/qa | 세션 목록 조회 | 기본 | Bearer |
| POST | /api/qa | 세션 생성 | 기본 | Bearer |
| GET | /api/qa/:id | 세션 상세 조회 | 기본 | Bearer |
| PATCH | /api/qa/:id/answer | 답변 저장 | 기본 | Bearer |
| DELETE | /api/qa/:id | 세션 삭제 | 기본 | Bearer |
| POST | /api/qa/:id/restore | 세션 복구 | 기본 | Bearer |

### 16.3 랜딩페이지 API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| GET | /api/lp | 목록 조회 | 기본 | Bearer |
| GET | /api/lp/:id | 상세 조회 | 기본 | Bearer |
| PATCH | /api/lp/:id | 수정 | 기본 | Bearer |
| DELETE | /api/lp/:id | 삭제 (Soft) | 기본 | Bearer |
| POST | /api/lp/:id/publish | 배포 | 기본 | Bearer |
| POST | /api/lp/:id/unpublish | 배포 취소 | 기본 | Bearer |
| POST | /api/lp/:id/restore | 복구 | 기본 | Bearer |
| GET | /api/lp/deleted | 삭제된 목록 | 기본 | Bearer |
| GET | /api/lp/public/:slug | 공개 페이지 조회 | 기본 | - |

### 16.4 Google Form API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| GET | /api/lp/:id/form | 폼 설정 조회 | 기본 | Bearer |
| POST | /api/lp/:id/form | 폼 설정 저장 | 기본 | Bearer |
| DELETE | /api/lp/:id/form | 폼 설정 삭제 | 기본 | Bearer |

### 16.5 CTA API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| GET | /api/lp/:id/cta | CTA 목록 | 기본 | Bearer |
| POST | /api/lp/:id/cta | CTA 생성 | 기본 | Bearer |
| PATCH | /api/lp/:id/cta/:ctaId | CTA 수정 | 기본 | Bearer |
| DELETE | /api/lp/:id/cta/:ctaId | CTA 삭제 | 기본 | Bearer |
| POST | /api/lp/public/:slug/cta/:ctaId/click | 클릭 기록 | 기본 | - |

### 16.6 AI API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| POST | /api/ai/generate | 랜딩페이지 생성 | 5/분 | Bearer |
| POST | /api/ai/regenerate | 섹션 재생성 | 3/분 | Bearer |
| GET | /api/ai/tokens | 토큰 사용량 조회 | 기본 | Bearer |

### 16.7 스토리지 API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| POST | /api/storage/upload | 이미지 업로드 | 10/분 | Bearer |
| DELETE | /api/storage/delete | 이미지 삭제 | 기본 | Bearer |

### 16.8 관리자 API

| Method | Endpoint | 설명 | Rate Limit | 인증 |
|--------|----------|------|------------|------|
| GET | /api/admin/users | 사용자 목록 | 관리자 | ENTERPRISE |
| POST | /api/admin/users/:id/approve | 사용자 승인 | 관리자 | ENTERPRISE |
| POST | /api/admin/users/:id/reject | 사용자 거부 | 관리자 | ENTERPRISE |
| PATCH | /api/admin/users/:id/tier | 티어 변경 | 관리자 | ENTERPRISE |
| GET | /api/admin/audit-logs | 감사 로그 조회 | 관리자 | ENTERPRISE |
| GET | /api/admin/stats | 대시보드 통계 | 관리자 | ENTERPRISE |

---

## 17. 유틸리티 함수

### 17.1 슬러그 생성

```typescript
// lib/utils/slug.ts

/**
 * 제목에서 URL 슬러그 생성
 */
export function generateSlug(title: string): string {
  // 한글 -> 영문 변환 (필요 시)
  let slug = title
    .toLowerCase()
    .trim()
    // 특수문자 제거
    .replace(/[^\w\s가-힣-]/g, '')
    // 공백 -> 하이픈
    .replace(/\s+/g, '-')
    // 연속 하이픈 제거
    .replace(/-+/g, '-')
    // 앞뒤 하이픈 제거
    .replace(/^-|-$/g, '');

  // 한글이 포함된 경우 랜덤 문자열 추가
  if (/[가-힣]/.test(slug)) {
    slug = `lp-${generateRandomString(8)}`;
  }

  // 최대 길이 제한
  if (slug.length > 100) {
    slug = slug.substring(0, 100).replace(/-$/, '');
  }

  return slug;
}

/**
 * 랜덤 문자열 생성
 */
export function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
```

### 17.2 에러 참조 ID 생성

```typescript
// lib/utils/error.ts

/**
 * 에러 추적용 참조 ID 생성
 * 형식: ERR-YYYYMMDDHHMMSS-XXXX
 */
export function generateErrorReference(): string {
  const now = new Date();

  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const random = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `ERR-${timestamp}-${random}`;
}
```

---

## 18. TypeScript 타입 정의

### 18.1 API 클라이언트 타입

```typescript
// src/types/api/index.ts

export * from './response';
export * from './pagination';

// 인증 관련
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    fullName: string;
    tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  };
}

export interface SignupRequest {
  email: string;
  password: string;
  confirmPassword: string;
  fullName: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeMarketing?: boolean;
}

// Q&A 관련
export interface QASession {
  id: string;
  title: string;
  currentStep: number;
  status: 'in_progress' | 'completed';
  answers: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface QASessionListItem {
  id: string;
  title: string;
  currentStep: number;
  totalSteps: number;
  progress: number;
  status: 'in_progress' | 'completed';
  createdAt: string;
  updatedAt: string;
}

// 랜딩페이지 관련
export interface LandingPage {
  id: string;
  title: string;
  status: 'draft' | 'generating' | 'published' | 'archived';
  slug: string | null;
  publishedUrl: string | null;
  content: LandingPageContent;
  qaSessionId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface LandingPageListItem {
  id: string;
  title: string;
  status: 'draft' | 'generating' | 'published' | 'archived';
  slug: string | null;
  publishedUrl: string | null;
  qaSessionId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

// AI 생성 관련
export interface GenerateRequest {
  qaSessionId: string;
  options?: {
    tone?: 'professional' | 'casual' | 'friendly';
    length?: 'short' | 'medium' | 'long';
    emphasis?: string[];
  };
}

export interface GenerateProgressEvent {
  step: string;
  progress: number;
  message: string;
}

export interface GenerateCompleteEvent {
  id: string;
  title: string;
  previewUrl: string;
  tokensUsed: number;
}

// 토큰 관련
export interface TokenUsage {
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
  dailyLimit: number;
  usedToday: number;
  reserved: number;
  available: number;
  resetAt: string;
}
```

---

## 19. 구현 체크리스트

### 19.1 공통

- [ ] 응답 형식 통일 (SuccessResponse / ErrorResponse)
- [ ] 에러 코드 체계 적용
- [ ] Rate Limiting 미들웨어
- [ ] CORS 미들웨어 (화이트리스트 기반)
- [ ] 감사 로그 연동

### 19.2 인증 API

- [ ] POST /api/auth/signup
- [ ] POST /api/auth/login
- [ ] POST /api/auth/refresh
- [ ] POST /api/auth/logout
- [ ] POST /api/auth/change-password
- [ ] POST /api/auth/forgot-password

### 19.3 Q&A API

- [ ] GET /api/qa
- [ ] POST /api/qa
- [ ] GET /api/qa/:id
- [ ] PATCH /api/qa/:id/answer
- [ ] DELETE /api/qa/:id
- [ ] POST /api/qa/:id/restore

### 19.4 랜딩페이지 API

- [ ] GET /api/lp
- [ ] GET /api/lp/:id
- [ ] PATCH /api/lp/:id
- [ ] DELETE /api/lp/:id
- [ ] POST /api/lp/:id/publish
- [ ] POST /api/lp/:id/unpublish
- [ ] POST /api/lp/:id/restore
- [ ] GET /api/lp/deleted
- [ ] GET /api/lp/public/:slug

### 19.5 Google Form / CTA API

- [ ] GET /api/lp/:id/form
- [ ] POST /api/lp/:id/form
- [ ] DELETE /api/lp/:id/form
- [ ] GET /api/lp/:id/cta
- [ ] POST /api/lp/:id/cta
- [ ] PATCH /api/lp/:id/cta/:ctaId
- [ ] DELETE /api/lp/:id/cta/:ctaId
- [ ] POST /api/lp/public/:slug/cta/:ctaId/click

### 19.6 AI API

- [ ] POST /api/ai/generate (SSE)
- [ ] POST /api/ai/regenerate
- [ ] GET /api/ai/tokens

### 19.7 스토리지 API

- [ ] POST /api/storage/upload
- [ ] DELETE /api/storage/delete

### 19.8 관리자 API

- [ ] GET /api/admin/users
- [ ] POST /api/admin/users/:id/approve
- [ ] POST /api/admin/users/:id/reject
- [ ] PATCH /api/admin/users/:id/tier
- [ ] GET /api/admin/audit-logs
- [ ] GET /api/admin/stats

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-01-15 | 초기 작성 | CTO |
