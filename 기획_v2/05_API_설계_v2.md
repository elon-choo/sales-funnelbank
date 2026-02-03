# 마그네틱 세일즈 웹앱 - API 설계 v2

## 문서 정보
| 항목 | 내용 |
|------|------|
| 버전 | 2.0 |
| 작성일 | 2025-01-15 |
| 이전 버전 | 04_API_설계.md (v1) |
| 변경 사유 | Red Team 보안 리뷰 반영 |

---

## v1 → v2 주요 변경 사항

| 영역 | v1 | v2 | 변경 사유 |
|------|----|----|-----------|
| CORS | 와일드카드(`*`) 허용 | 명시적 화이트리스트 | CRITICAL-API-001 |
| Rate Limiting | Upstash Redis | Supabase PostgreSQL | HIGH-UX-001 |
| 토큰 응답 | Access Token 직접 반환 | HttpOnly Cookie | HIGH-SEC-001 |
| 에러 응답 | 상세 메시지 | 일반화 + 에러 코드 | HIGH-SEC-004 |
| 삭제 API | DELETE (물리 삭제) | PATCH (Soft Delete) | CRITICAL-DB-001 |
| 복구 API | 미구현 | POST /restore | CRITICAL-DB-001 |

---

## 1. API 아키텍처

### 1.1 전체 구조

```mermaid
graph TB
    subgraph "클라이언트"
        Web[웹 브라우저]
    end

    subgraph "Edge Layer"
        CORS[CORS 미들웨어]
        Rate[Rate Limit 미들웨어]
    end

    subgraph "Next.js API Routes"
        Auth[/api/auth/*]
        AI[/api/ai/*]
        LP[/api/lp/*]
        Admin[/api/admin/*]
    end

    subgraph "Supabase"
        AuthS[Supabase Auth]
        DB[(PostgreSQL)]
        Storage[Supabase Storage]
    end

    subgraph "External"
        Claude[Claude API]
    end

    Web --> CORS
    CORS --> Rate
    Rate --> Auth
    Rate --> AI
    Rate --> LP
    Rate --> Admin

    Auth --> AuthS
    Auth --> DB
    AI --> DB
    AI --> Claude
    LP --> DB
    LP --> Storage
    Admin --> DB
```

### 1.2 공통 응답 형식

```typescript
// 성공 응답
interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

// 에러 응답 (v2 - 일반화된 메시지)
interface ErrorResponse {
  success: false;
  error: {
    code: string;      // 에러 코드 (예: AUTH_001)
    message: string;   // 사용자 친화적 메시지
    reference?: string; // 추적용 참조 ID
  };
}

// 예시
{
  "success": false,
  "error": {
    "code": "AUTH_003",
    "message": "세션이 만료되었습니다",
    "reference": "ERR-20250115143028-A7B3"
  }
}
```

---

## 2. CORS 미들웨어 (v2)

### 2.1 CORS 설정

```typescript
// middleware.ts (v2 - 와일드카드 제거)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// v2: 명시적 도메인 화이트리스트
const ALLOWED_ORIGINS = [
  'https://magnetic-sales.vercel.app',
  'https://www.magnetic-sales.com',
  // staging 환경도 명시적으로 등록
  'https://staging.magnetic-sales.vercel.app',
  'https://preview-123.magnetic-sales.vercel.app',
];

// 개발 환경에서만 localhost 허용
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000');
}

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const response = NextResponse.next();

  // v2: origin이 없는 경우 (same-origin 또는 non-browser)
  if (!origin) {
    const fetchSite = request.headers.get('sec-fetch-site');

    // same-origin 또는 none (직접 접근)만 허용
    if (fetchSite === 'same-origin' || fetchSite === 'none') {
      return response;
    }

    // cross-origin인데 origin이 없으면 거부
    return new NextResponse(null, { status: 403 });
  }

  // v2: 화이트리스트 확인 (와일드카드 없음)
  if (!ALLOWED_ORIGINS.includes(origin)) {
    console.warn(`CORS blocked: ${origin}`);

    // 감사 로그 (비동기)
    logSecurityEvent('cors_blocked', { origin });

    return new NextResponse(null, {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
      },
    });
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
    'Content-Type, Authorization, X-Request-ID'
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
```

### 2.2 Staging 환경 관리

```typescript
// config/cors.ts (v2)
export function getAllowedOrigins(): string[] {
  const baseOrigins = [
    'https://magnetic-sales.vercel.app',
    'https://www.magnetic-sales.com',
  ];

  // 환경변수에서 추가 도메인 로드
  const additionalOrigins = process.env.ADDITIONAL_CORS_ORIGINS?.split(',') || [];

  // 개발 환경
  if (process.env.NODE_ENV === 'development') {
    return [...baseOrigins, 'http://localhost:3000', ...additionalOrigins];
  }

  // 프로덕션
  return [...baseOrigins, ...additionalOrigins];
}

// .env.production
// ADDITIONAL_CORS_ORIGINS=https://staging.magnetic-sales.vercel.app,https://preview-abc123.vercel.app
```

---

## 3. Rate Limiting (v2 - Supabase 기반)

### 3.1 Rate Limit 미들웨어

```typescript
// lib/rate-limit.ts (v2 - Supabase PostgreSQL)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': { limit: 5, windowSeconds: 60 },      // 5회/분
  '/api/auth/signup': { limit: 3, windowSeconds: 60 },     // 3회/분
  '/api/auth/refresh': { limit: 10, windowSeconds: 60 },   // 10회/분
  '/api/ai/generate': { limit: 10, windowSeconds: 60 },    // 10회/분
  '/api/lp': { limit: 30, windowSeconds: 60 },             // 30회/분
  'default': { limit: 60, windowSeconds: 60 },             // 60회/분
};

export async function checkRateLimit(
  identifier: string,
  endpoint: string
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS['default'];

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_identifier: identifier,
    p_endpoint: endpoint,
    p_limit: config.limit,
    p_window_seconds: config.windowSeconds,
  });

  if (error) {
    console.error('Rate limit check failed:', error);
    // 에러 시 허용 (fail-open)
    return { allowed: true, remaining: config.limit, resetAt: new Date() };
  }

  return {
    allowed: data.allowed,
    remaining: data.remaining || 0,
    resetAt: new Date(data.reset_at),
  };
}

// API Route에서 사용
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') ||
             'unknown';

  const userId = request.headers.get('x-user-id'); // 인증된 사용자
  const identifier = userId || ip;
  const endpoint = new URL(request.url).pathname;

  const { allowed, remaining, resetAt } = await checkRateLimit(identifier, endpoint);

  if (!allowed) {
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
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetAt.toISOString(),
          'Retry-After': Math.ceil((resetAt.getTime() - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  const response = await handler();
  response.headers.set('X-RateLimit-Remaining', remaining.toString());
  response.headers.set('X-RateLimit-Reset', resetAt.toISOString());

  return response;
}
```

---

## 4. 인증 API

### 4.1 회원가입

```yaml
POST /api/auth/signup
```

#### 요청
```typescript
// Request Body
interface SignupRequest {
  email: string;
  password: string;
  fullName: string;
  agreeTerms: boolean;
  agreePrivacy: boolean;
  agreeMarketing?: boolean;
}

// Zod Schema
const signupSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .regex(/[a-zA-Z]/, '영문을 포함해야 합니다')
    .regex(/[0-9]/, '숫자를 포함해야 합니다'),
  fullName: z.string().min(2).max(50),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: '서비스 이용약관에 동의해주세요' }),
  }),
  agreePrivacy: z.literal(true, {
    errorMap: () => ({ message: '개인정보 처리방침에 동의해주세요' }),
  }),
  agreeMarketing: z.boolean().optional(),
});
```

#### 응답
```typescript
// 성공 (201)
{
  "success": true,
  "data": {
    "message": "이메일 인증 후 관리자 승인을 기다려주세요"
  }
}

// 실패 - 이미 가입된 이메일 (409)
{
  "success": false,
  "error": {
    "code": "AUTH_005",
    "message": "이미 가입된 이메일입니다"
  }
}
```

### 4.2 로그인 (v2 - HttpOnly Cookie)

```yaml
POST /api/auth/login
```

#### 요청
```typescript
interface LoginRequest {
  email: string;
  password: string;
}
```

#### 응답 (v2)
```typescript
// 성공 (200) - Access Token만 body로, Refresh Token은 Cookie
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,  // 15분 (초)
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "홍길동",
      "tier": "FREE"
    }
  }
}

// Set-Cookie 헤더 (v2)
Set-Cookie: refresh_token=abc123...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800
```

#### 구현
```typescript
// app/api/auth/login/route.ts (v2)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { generateSecureToken, hashToken } from '@/lib/crypto';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Supabase Auth 로그인
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_001',
            message: '이메일 또는 비밀번호를 확인해주세요',
          },
        },
        { status: 401 }
      );
    }

    // 2. 승인 상태 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_approved, tier, full_name, deleted_at')
      .eq('id', authData.user.id)
      .single();

    if (profile?.deleted_at) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_006',
            message: '탈퇴한 계정입니다',
          },
        },
        { status: 403 }
      );
    }

    if (!profile?.is_approved) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_002',
            message: '관리자 승인 대기 중입니다',
          },
        },
        { status: 403 }
      );
    }

    // 3. Refresh Token 생성 및 저장 (v2)
    const refreshToken = generateSecureToken(64);
    const tokenHash = await hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

    await supabase.from('refresh_tokens').insert({
      user_id: authData.user.id,
      token_hash: tokenHash,
      expires_at: expiresAt.toISOString(),
      revoked: false,
    });

    // 4. 세션 기록
    await supabase.from('user_sessions').insert({
      user_id: authData.user.id,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
      user_agent: request.headers.get('user-agent'),
    });

    // 5. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: authData.user.id,
      action: 'login',
      details: { ip: request.headers.get('x-forwarded-for') },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
    });

    // 6. 응답 (v2 - HttpOnly Cookie)
    const response = NextResponse.json(
      {
        success: true,
        data: {
          accessToken: authData.session.access_token,
          expiresIn: 900,
          user: {
            id: authData.user.id,
            email: authData.user.email,
            fullName: profile.full_name,
            tier: profile.tier,
          },
        },
      },
      { status: 200 }
    );

    // HttpOnly Cookie 설정 (v2)
    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60, // 7일
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GEN_001',
          message: '서비스 연결에 문제가 있습니다',
          reference: generateErrorReference(),
        },
      },
      { status: 500 }
    );
  }
}
```

### 4.3 토큰 갱신 (v2 - Rotation)

```yaml
POST /api/auth/refresh
Cookie: refresh_token=abc123...
```

#### 응답
```typescript
// 성공 (200) - 새 토큰 쌍 발급
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900
  }
}

// Set-Cookie (새 Refresh Token)
Set-Cookie: refresh_token=xyz789...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800
```

#### 구현
```typescript
// app/api/auth/refresh/route.ts (v2)
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_003',
            message: '세션이 만료되었습니다',
          },
        },
        { status: 401 }
      );
    }

    const tokenHash = await hashToken(refreshToken);

    // 1. 토큰 조회
    const { data: tokenRecord } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (!tokenRecord) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_003',
            message: '세션이 만료되었습니다',
          },
        },
        { status: 401 }
      );
    }

    // 2. 토큰 재사용 감지 (v2 핵심)
    if (tokenRecord.revoked) {
      // 보안 위협: 모든 토큰 폐기
      await supabase
        .from('refresh_tokens')
        .update({ revoked: true, revoked_at: new Date().toISOString() })
        .eq('user_id', tokenRecord.user_id);

      // 모든 세션 무효화
      await supabase
        .from('user_sessions')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('user_id', tokenRecord.user_id)
        .is('invalidated_at', null);

      // 감사 로그
      await supabase.from('audit_logs').insert({
        user_id: tokenRecord.user_id,
        action: 'token_reuse_detected',
        details: { severity: 'critical', token_id: tokenRecord.id },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
      });

      // Cookie 삭제
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_004',
            message: '보안 문제가 감지되었습니다. 다시 로그인해주세요',
          },
        },
        { status: 401 }
      );

      response.cookies.delete('refresh_token');
      return response;
    }

    // 3. 만료 확인
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'AUTH_003',
            message: '세션이 만료되었습니다',
          },
        },
        { status: 401 }
      );
    }

    // 4. 기존 토큰 폐기 (Rotation)
    await supabase
      .from('refresh_tokens')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // 5. 새 Refresh Token 발급
    const newRefreshToken = generateSecureToken(64);
    const newTokenHash = await hashToken(newRefreshToken);

    await supabase.from('refresh_tokens').insert({
      user_id: tokenRecord.user_id,
      token_hash: newTokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
    });

    // 6. 새 Access Token 발급
    const { data: authData } = await supabase.auth.admin.getUserById(
      tokenRecord.user_id
    );

    const { data: sessionData } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: authData.user?.email!,
    });

    // 7. 응답
    const response = NextResponse.json(
      {
        success: true,
        data: {
          accessToken: sessionData.properties?.access_token,
          expiresIn: 900,
        },
      },
      { status: 200 }
    );

    response.cookies.set('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/auth',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GEN_001',
          message: '서비스 연결에 문제가 있습니다',
          reference: generateErrorReference(),
        },
      },
      { status: 500 }
    );
  }
}
```

### 4.4 로그아웃

```yaml
POST /api/auth/logout
Authorization: Bearer {accessToken}
```

#### 응답
```typescript
// 성공 (200)
{
  "success": true,
  "data": {
    "message": "로그아웃되었습니다"
  }
}

// Set-Cookie (삭제)
Set-Cookie: refresh_token=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0
```

---

## 5. 랜딩페이지 API

### 5.1 목록 조회

```yaml
GET /api/lp
Authorization: Bearer {accessToken}
Query: ?page=1&limit=10&status=all&includeDeleted=false
```

#### 응답
```typescript
// 성공 (200)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "1인 코칭 비즈니스 런칭 가이드",
      "status": "published",
      "slug": "coaching-business-guide",
      "publishedUrl": "https://lp.magnetic-sales.com/coaching-business-guide",
      "createdAt": "2025-01-10T09:00:00Z",
      "updatedAt": "2025-01-14T15:30:00Z",
      "deletedAt": null
    }
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 2
  }
}
```

### 5.2 삭제 (v2 - Soft Delete)

```yaml
DELETE /api/lp/:id
Authorization: Bearer {accessToken}
```

#### 응답 (v2)
```typescript
// 성공 (200) - Soft Delete
{
  "success": true,
  "data": {
    "message": "삭제되었습니다. 30일 이내 복구 가능합니다.",
    "deletedAt": "2025-01-15T10:30:00Z",
    "recoveryDeadline": "2025-02-14T10:30:00Z"
  }
}
```

#### 구현
```typescript
// app/api/lp/[id]/route.ts (v2)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromToken(request);

    // 1. 소유권 확인
    const { data: lp } = await supabase
      .from('landing_pages')
      .select('id, user_id, status')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single();

    if (!lp || lp.user_id !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LP_001',
            message: '랜딩페이지를 찾을 수 없습니다',
          },
        },
        { status: 404 }
      );
    }

    // 2. Soft Delete (v2)
    const deletedAt = new Date().toISOString();
    await supabase
      .from('landing_pages')
      .update({ deleted_at: deletedAt })
      .eq('id', params.id);

    // 3. 배포된 경우 URL 비활성화
    if (lp.status === 'published') {
      // 배포 URL 비활성화 로직
    }

    // 4. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'landing_page_deleted',
      details: { landing_page_id: params.id },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: '삭제되었습니다. 30일 이내 복구 가능합니다.',
          deletedAt,
          recoveryDeadline: new Date(
            Date.now() + 30 * 24 * 60 * 60 * 1000
          ).toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Delete LP error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GEN_001',
          message: '서비스 연결에 문제가 있습니다',
          reference: generateErrorReference(),
        },
      },
      { status: 500 }
    );
  }
}
```

### 5.3 복구 (v2 신규)

```yaml
POST /api/lp/:id/restore
Authorization: Bearer {accessToken}
```

#### 응답
```typescript
// 성공 (200)
{
  "success": true,
  "data": {
    "message": "복구되었습니다",
    "id": "uuid"
  }
}

// 실패 - 복구 기간 만료 (410)
{
  "success": false,
  "error": {
    "code": "LP_002",
    "message": "복구 기간(30일)이 만료되었습니다"
  }
}
```

#### 구현
```typescript
// app/api/lp/[id]/restore/route.ts (v2)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = await getUserIdFromToken(request);

    // 1. 삭제된 항목 조회
    const { data: lp } = await supabase
      .from('landing_pages')
      .select('id, user_id, deleted_at')
      .eq('id', params.id)
      .not('deleted_at', 'is', null)
      .single();

    if (!lp || lp.user_id !== userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LP_001',
            message: '복구할 항목을 찾을 수 없습니다',
          },
        },
        { status: 404 }
      );
    }

    // 2. 30일 초과 확인
    const deletedAt = new Date(lp.deleted_at);
    const daysElapsed = (Date.now() - deletedAt.getTime()) / (1000 * 60 * 60 * 24);

    if (daysElapsed > 30) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LP_002',
            message: '복구 기간(30일)이 만료되었습니다',
          },
        },
        { status: 410 }
      );
    }

    // 3. 랜딩페이지 수 제한 확인
    const { count } = await supabase
      .from('landing_pages')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null);

    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    const maxPages = profile.tier === 'FREE' ? 3 : Infinity;

    if (count >= maxPages) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'LP_003',
            message: '랜딩페이지 수 제한을 초과했습니다',
          },
        },
        { status: 429 }
      );
    }

    // 4. 복구 실행
    await supabase
      .from('landing_pages')
      .update({ deleted_at: null })
      .eq('id', params.id);

    // 5. 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action: 'landing_page_restored',
      details: { landing_page_id: params.id },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: '복구되었습니다',
          id: params.id,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Restore LP error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'GEN_001',
          message: '서비스 연결에 문제가 있습니다',
          reference: generateErrorReference(),
        },
      },
      { status: 500 }
    );
  }
}
```

### 5.4 삭제된 항목 목록 (v2 신규)

```yaml
GET /api/lp/deleted
Authorization: Bearer {accessToken}
```

#### 응답
```typescript
// 성공 (200)
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

## 6. AI API

### 6.1 랜딩페이지 생성

```yaml
POST /api/ai/generate
Authorization: Bearer {accessToken}
Content-Type: application/json
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
```

#### 응답 (SSE)
```typescript
// 진행률 이벤트
event: progress
data: {"step": "analyzing", "progress": 20, "message": "고객 페르소나 분석 중..."}

event: progress
data: {"step": "generating", "progress": 60, "message": "마그네틱 헤드라인 생성 중..."}

// 완료 이벤트
event: complete
data: {"id": "uuid", "title": "생성된 제목", "previewUrl": "/preview/uuid"}

// 에러 이벤트
event: error
data: {"code": "AI_001", "message": "생성에 실패했습니다"}
```

### 6.2 토큰 사용량 조회

```yaml
GET /api/ai/tokens
Authorization: Bearer {accessToken}
```

#### 응답
```typescript
// 성공 (200)
{
  "success": true,
  "data": {
    "tier": "FREE",
    "dailyLimit": 100000,
    "usedToday": 45230,
    "reserved": 5000,
    "available": 49770,
    "resetAt": "2025-01-16T00:00:00Z"
  }
}
```

---

## 7. 관리자 API

### 7.1 사용자 승인

```yaml
POST /api/admin/users/:id/approve
Authorization: Bearer {accessToken}
```

#### 응답
```typescript
// 성공 (200)
{
  "success": true,
  "data": {
    "message": "사용자가 승인되었습니다",
    "userId": "uuid",
    "sessionsInvalidated": true
  }
}
```

### 7.2 감사 로그 조회 (v2 신규)

```yaml
GET /api/admin/audit-logs
Authorization: Bearer {accessToken}
Query: ?userId=uuid&action=login&startDate=2025-01-01&endDate=2025-01-15&limit=100
```

#### 응답
```typescript
// 성공 (200)
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "userId": "uuid",
      "userEmail": "user@example.com",
      "action": "login",
      "details": {"ip": "123.45.67.89"},
      "ipAddress": "123.45.67.89",
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

## 8. 에러 코드 정의

### 8.1 인증 에러 (AUTH)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| AUTH_001 | 401 | 이메일 또는 비밀번호를 확인해주세요 |
| AUTH_002 | 403 | 관리자 승인 대기 중입니다 |
| AUTH_003 | 401 | 세션이 만료되었습니다 |
| AUTH_004 | 401 | 보안 문제가 감지되었습니다. 다시 로그인해주세요 |
| AUTH_005 | 409 | 이미 가입된 이메일입니다 |
| AUTH_006 | 403 | 탈퇴한 계정입니다 |

### 8.2 토큰 에러 (TOKEN)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| TOKEN_001 | 429 | 토큰이 부족합니다 |
| TOKEN_002 | 429 | 오늘의 사용량을 모두 소진했습니다 |

### 8.3 랜딩페이지 에러 (LP)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| LP_001 | 404 | 랜딩페이지를 찾을 수 없습니다 |
| LP_002 | 410 | 복구 기간(30일)이 만료되었습니다 |
| LP_003 | 429 | 랜딩페이지 수 제한을 초과했습니다 |

### 8.4 AI 에러 (AI)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| AI_001 | 500 | 생성에 실패했습니다 |
| AI_002 | 408 | 요청 시간이 초과되었습니다 |

### 8.5 Rate Limit 에러 (RATE)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| RATE_001 | 429 | 요청이 너무 많습니다. 잠시 후 다시 시도해주세요 |

### 8.6 일반 에러 (GEN)

| 코드 | HTTP | 메시지 |
|------|------|--------|
| GEN_001 | 500 | 서비스 연결에 문제가 있습니다 |
| GEN_002 | 400 | 잘못된 요청입니다 |
| GEN_003 | 403 | 접근 권한이 없습니다 |

---

## 9. 구현 체크리스트

### 9.1 CORS (v2)
- [ ] 와일드카드 제거
- [ ] 명시적 화이트리스트
- [ ] Sec-Fetch-Site 검증
- [ ] staging 환경 별도 등록

### 9.2 Rate Limiting (v2)
- [ ] Supabase 기반 구현
- [ ] 엔드포인트별 제한
- [ ] 헤더 응답

### 9.3 인증 (v2)
- [ ] HttpOnly Cookie
- [ ] Refresh Token Rotation
- [ ] 토큰 재사용 감지
- [ ] 로그아웃 시 Cookie 삭제

### 9.4 에러 처리 (v2)
- [ ] 일반화된 메시지
- [ ] 에러 코드 체계
- [ ] 참조 ID 생성
- [ ] 감사 로그 연동

### 9.5 Soft Delete (v2)
- [ ] DELETE → PATCH 변경
- [ ] /restore 엔드포인트
- [ ] /deleted 목록 API
- [ ] 30일 복구 기간 체크
