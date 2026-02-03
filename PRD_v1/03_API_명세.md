# Magnetic Sales WebApp - API 명세

## 문서 정보

| 항목 | 내용 |
|------|------|
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-15 |
| 이전 문서 | [02_DB_마이그레이션.md](./02_DB_마이그레이션.md) |
| 다음 문서 | [04_인증_시스템.md](./04_인증_시스템.md) |

---

## 1. API 개요

### 1.1 기본 정보

```yaml
Base URL: https://magnetic-sales.vercel.app/api
Content-Type: application/json
인증: Bearer Token (Authorization 헤더)
Refresh Token: HttpOnly Cookie
```

### 1.2 공통 응답 형식

```typescript
// src/types/api.ts

/**
 * 성공 응답 타입
 */
export interface SuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

/**
 * 에러 응답 타입
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: string;      // 에러 코드 (예: AUTH_001)
    message: string;   // 사용자 친화적 메시지
    reference?: string; // 추적용 참조 ID (예: ERR-20250115143028-A7B3)
  };
}

/**
 * API 응답 타입 (Union)
 */
export type ApiResponse<T> = SuccessResponse<T> | ErrorResponse;
```

### 1.3 에러 코드 체계

```typescript
// src/lib/constants/errors.ts

export const ERROR_CODES = {
  // 인증 에러 (AUTH)
  AUTH_001: 'AUTH_001', // 이메일 또는 비밀번호 오류
  AUTH_002: 'AUTH_002', // 관리자 승인 대기
  AUTH_003: 'AUTH_003', // 세션 만료
  AUTH_004: 'AUTH_004', // 토큰 재사용 감지 (보안 위협)
  AUTH_005: 'AUTH_005', // 이미 가입된 이메일
  AUTH_006: 'AUTH_006', // 탈퇴한 계정

  // 토큰 에러 (TOKEN)
  TOKEN_001: 'TOKEN_001', // 토큰 부족
  TOKEN_002: 'TOKEN_002', // 일일 한도 초과

  // 랜딩페이지 에러 (LP)
  LP_001: 'LP_001', // 랜딩페이지 없음
  LP_002: 'LP_002', // 복구 기간 만료
  LP_003: 'LP_003', // 랜딩페이지 수 제한 초과
  LP_004: 'LP_004', // 슬러그 중복

  // AI 에러 (AI)
  AI_001: 'AI_001', // 생성 실패
  AI_002: 'AI_002', // 요청 시간 초과
  AI_003: 'AI_003', // 프롬프트 인젝션 감지

  // Rate Limit 에러 (RATE)
  RATE_001: 'RATE_001', // 요청 과다

  // 일반 에러 (GEN)
  GEN_001: 'GEN_001', // 서버 오류
  GEN_002: 'GEN_002', // 잘못된 요청
  GEN_003: 'GEN_003', // 접근 권한 없음
  GEN_004: 'GEN_004', // 유효성 검사 실패
} as const;

export const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.AUTH_001]: '이메일 또는 비밀번호를 확인해주세요',
  [ERROR_CODES.AUTH_002]: '관리자 승인 대기 중입니다',
  [ERROR_CODES.AUTH_003]: '세션이 만료되었습니다',
  [ERROR_CODES.AUTH_004]: '보안 문제가 감지되었습니다. 다시 로그인해주세요',
  [ERROR_CODES.AUTH_005]: '이미 가입된 이메일입니다',
  [ERROR_CODES.AUTH_006]: '탈퇴한 계정입니다',
  [ERROR_CODES.TOKEN_001]: '토큰이 부족합니다',
  [ERROR_CODES.TOKEN_002]: '오늘의 사용량을 모두 소진했습니다',
  [ERROR_CODES.LP_001]: '랜딩페이지를 찾을 수 없습니다',
  [ERROR_CODES.LP_002]: '복구 기간(30일)이 만료되었습니다',
  [ERROR_CODES.LP_003]: '랜딩페이지 수 제한을 초과했습니다',
  [ERROR_CODES.LP_004]: '이미 사용 중인 URL입니다',
  [ERROR_CODES.AI_001]: '생성에 실패했습니다. 다시 시도해주세요',
  [ERROR_CODES.AI_002]: '요청 시간이 초과되었습니다',
  [ERROR_CODES.AI_003]: '허용되지 않는 입력입니다',
  [ERROR_CODES.RATE_001]: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요',
  [ERROR_CODES.GEN_001]: '서비스 연결에 문제가 있습니다',
  [ERROR_CODES.GEN_002]: '잘못된 요청입니다',
  [ERROR_CODES.GEN_003]: '접근 권한이 없습니다',
  [ERROR_CODES.GEN_004]: '입력 값을 확인해주세요',
};
```

---

## 2. 인증 API

### 2.1 회원가입

```yaml
POST /api/auth/signup
Rate Limit: 3회/분
```

#### 요청

```typescript
// src/lib/validators/auth.ts
import { z } from 'zod';

export const signupSchema = z.object({
  email: z.string().email('유효한 이메일을 입력해주세요'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .regex(/[a-zA-Z]/, '영문을 포함해야 합니다')
    .regex(/[0-9]/, '숫자를 포함해야 합니다'),
  fullName: z.string().min(2, '이름은 2자 이상이어야 합니다').max(50),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: '서비스 이용약관에 동의해주세요' }),
  }),
  agreePrivacy: z.literal(true, {
    errorMap: () => ({ message: '개인정보 처리방침에 동의해주세요' }),
  }),
  agreeMarketing: z.boolean().optional().default(false),
});

export type SignupRequest = z.infer<typeof signupSchema>;
```

#### 응답

```typescript
// 성공 (201 Created)
interface SignupSuccessResponse {
  success: true;
  data: {
    message: string; // "이메일 인증 후 관리자 승인을 기다려주세요"
    userId: string;
  };
}

// 실패 예시
// 409 Conflict: AUTH_005 (이미 가입된 이메일)
// 400 Bad Request: GEN_004 (유효성 검사 실패)
```

#### 구현

```typescript
// src/app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { signupSchema } from '@/lib/validators/auth';
import { ERROR_CODES, ERROR_MESSAGES } from '@/lib/constants/errors';
import { withRateLimit } from '@/lib/security/rate-limit';
import { generateErrorReference } from '@/lib/security/crypto';

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json();

      // 1. 유효성 검사
      const validationResult = signupSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.GEN_004,
              message: validationResult.error.errors[0].message,
            },
          },
          { status: 400 }
        );
      }

      const { email, password, fullName, agreeMarketing } = validationResult.data;
      const supabase = getSupabaseAdmin();

      // 2. 이메일 중복 확인
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.AUTH_005,
              message: ERROR_MESSAGES[ERROR_CODES.AUTH_005],
            },
          },
          { status: 409 }
        );
      }

      // 3. Supabase Auth로 사용자 생성
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: false, // 이메일 인증 필요
        user_metadata: {
          full_name: fullName,
          agree_marketing: agreeMarketing,
        },
      });

      if (authError) {
        console.error('Signup error:', authError);
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.GEN_001,
              message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
              reference: generateErrorReference(),
            },
          },
          { status: 500 }
        );
      }

      // 4. 감사 로그
      await supabase.from('audit_logs').insert({
        user_id: authData.user.id,
        action: 'signup',
        details: { email },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
      });

      return NextResponse.json(
        {
          success: true,
          data: {
            message: '이메일 인증 후 관리자 승인을 기다려주세요',
            userId: authData.user.id,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('Signup error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.GEN_001,
            message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
            reference: generateErrorReference(),
          },
        },
        { status: 500 }
      );
    }
  });
}
```

### 2.2 로그인

```yaml
POST /api/auth/login
Rate Limit: 5회/분
```

#### 요청

```typescript
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, '비밀번호를 입력해주세요'),
});

export type LoginRequest = z.infer<typeof loginSchema>;
```

#### 응답

```typescript
// 성공 (200 OK)
interface LoginSuccessResponse {
  success: true;
  data: {
    accessToken: string;
    expiresIn: number; // 초 단위 (900 = 15분)
    user: {
      id: string;
      email: string;
      fullName: string;
      tier: 'FREE' | 'PRO' | 'ENTERPRISE';
    };
  };
}

// Set-Cookie 헤더 (HttpOnly)
// refresh_token=abc123...; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=604800
```

#### 구현

```typescript
// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { loginSchema } from '@/lib/validators/auth';
import { ERROR_CODES, ERROR_MESSAGES } from '@/lib/constants/errors';
import { generateSecureToken, hashToken, generateErrorReference } from '@/lib/security/crypto';
import { withRateLimit } from '@/lib/security/rate-limit';

export async function POST(request: NextRequest) {
  return withRateLimit(request, async () => {
    try {
      const body = await request.json();

      // 1. 유효성 검사
      const validationResult = loginSchema.safeParse(body);
      if (!validationResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.GEN_004,
              message: ERROR_MESSAGES[ERROR_CODES.GEN_004],
            },
          },
          { status: 400 }
        );
      }

      const { email, password } = validationResult.data;
      const supabase = getSupabaseAdmin();

      // 2. Supabase Auth 로그인
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError || !authData.user) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.AUTH_001,
              message: ERROR_MESSAGES[ERROR_CODES.AUTH_001],
            },
          },
          { status: 401 }
        );
      }

      // 3. 프로필 조회 (승인 상태, 삭제 여부)
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, tier, is_approved, deleted_at')
        .eq('id', authData.user.id)
        .single();

      // 삭제된 계정
      if (profile?.deleted_at) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.AUTH_006,
              message: ERROR_MESSAGES[ERROR_CODES.AUTH_006],
            },
          },
          { status: 403 }
        );
      }

      // 미승인 계정
      if (!profile?.is_approved) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: ERROR_CODES.AUTH_002,
              message: ERROR_MESSAGES[ERROR_CODES.AUTH_002],
            },
          },
          { status: 403 }
        );
      }

      // 4. Refresh Token 생성 및 저장
      const refreshToken = generateSecureToken(64);
      const tokenHash = hashToken(refreshToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7일

      await supabase.from('refresh_tokens').insert({
        user_id: authData.user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        revoked: false,
      });

      // 5. 세션 기록
      await supabase.from('user_sessions').insert({
        user_id: authData.user.id,
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
        user_agent: request.headers.get('user-agent'),
      });

      // 6. 감사 로그
      await supabase.from('audit_logs').insert({
        user_id: authData.user.id,
        action: 'login',
        details: {},
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
      });

      // 7. 응답 생성
      const response = NextResponse.json(
        {
          success: true,
          data: {
            accessToken: authData.session!.access_token,
            expiresIn: 900, // 15분
            user: {
              id: authData.user.id,
              email: authData.user.email!,
              fullName: profile.full_name,
              tier: profile.tier,
            },
          },
        },
        { status: 200 }
      );

      // 8. HttpOnly Cookie 설정
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
            code: ERROR_CODES.GEN_001,
            message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
            reference: generateErrorReference(),
          },
        },
        { status: 500 }
      );
    }
  });
}
```

### 2.3 토큰 갱신 (Rotation)

```yaml
POST /api/auth/refresh
Cookie: refresh_token=abc123...
Rate Limit: 10회/분
```

#### 응답

```typescript
// 성공 (200 OK)
interface RefreshSuccessResponse {
  success: true;
  data: {
    accessToken: string;
    expiresIn: number;
  };
}

// 새 Refresh Token도 Set-Cookie로 발급됨
```

#### 구현

```typescript
// src/app/api/auth/refresh/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { ERROR_CODES, ERROR_MESSAGES } from '@/lib/constants/errors';
import { generateSecureToken, hashToken, generateErrorReference } from '@/lib/security/crypto';

export async function POST(request: NextRequest) {
  try {
    // 1. Cookie에서 Refresh Token 추출
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.AUTH_003,
            message: ERROR_MESSAGES[ERROR_CODES.AUTH_003],
          },
        },
        { status: 401 }
      );
    }

    const supabase = getSupabaseAdmin();
    const tokenHash = hashToken(refreshToken);

    // 2. 토큰 조회
    const { data: tokenRecord } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .single();

    if (!tokenRecord) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.AUTH_003,
            message: ERROR_MESSAGES[ERROR_CODES.AUTH_003],
          },
        },
        { status: 401 }
      );
      response.cookies.delete('refresh_token');
      return response;
    }

    // 3. 토큰 재사용 감지 (CRITICAL: 보안 위협)
    if (tokenRecord.revoked) {
      // 모든 토큰 폐기
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

      // 감사 로그 (심각도: critical)
      await supabase.from('audit_logs').insert({
        user_id: tokenRecord.user_id,
        action: 'token_reuse_detected',
        details: {
          severity: 'critical',
          token_id: tokenRecord.id,
        },
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
      });

      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.AUTH_004,
            message: ERROR_MESSAGES[ERROR_CODES.AUTH_004],
          },
        },
        { status: 401 }
      );
      response.cookies.delete('refresh_token');
      return response;
    }

    // 4. 만료 확인
    if (new Date(tokenRecord.expires_at) < new Date()) {
      const response = NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.AUTH_003,
            message: ERROR_MESSAGES[ERROR_CODES.AUTH_003],
          },
        },
        { status: 401 }
      );
      response.cookies.delete('refresh_token');
      return response;
    }

    // 5. 기존 토큰 폐기 (Rotation)
    await supabase
      .from('refresh_tokens')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('id', tokenRecord.id);

    // 6. 새 Refresh Token 발급
    const newRefreshToken = generateSecureToken(64);
    const newTokenHash = hashToken(newRefreshToken);

    await supabase.from('refresh_tokens').insert({
      user_id: tokenRecord.user_id,
      token_hash: newTokenHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      revoked: false,
    });

    // 7. 새 Access Token 발급 (Supabase 내부 처리)
    const { data: userData } = await supabase.auth.admin.getUserById(tokenRecord.user_id);

    if (!userData.user) {
      throw new Error('User not found');
    }

    // 새 세션 생성
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: userData.user.email!,
    });

    if (sessionError) {
      throw sessionError;
    }

    // 8. 응답 생성
    const response = NextResponse.json(
      {
        success: true,
        data: {
          accessToken: sessionData.properties?.access_token || '',
          expiresIn: 900, // 15분
        },
      },
      { status: 200 }
    );

    // 새 Refresh Token Cookie 설정
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
          code: ERROR_CODES.GEN_001,
          message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
          reference: generateErrorReference(),
        },
      },
      { status: 500 }
    );
  }
}
```

### 2.4 로그아웃

```yaml
POST /api/auth/logout
Authorization: Bearer {accessToken}
```

#### 구현

```typescript
// src/app/api/auth/logout/route.ts
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;
    const supabase = getSupabaseAdmin();

    if (refreshToken) {
      const tokenHash = hashToken(refreshToken);

      // 토큰 폐기
      await supabase
        .from('refresh_tokens')
        .update({ revoked: true, revoked_at: new Date().toISOString() })
        .eq('token_hash', tokenHash);

      // 사용자 ID 조회 후 감사 로그
      const { data: tokenRecord } = await supabase
        .from('refresh_tokens')
        .select('user_id')
        .eq('token_hash', tokenHash)
        .single();

      if (tokenRecord) {
        await supabase.from('audit_logs').insert({
          user_id: tokenRecord.user_id,
          action: 'logout',
          details: {},
          ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
        });
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: '로그아웃되었습니다',
        },
      },
      { status: 200 }
    );

    // Cookie 삭제
    response.cookies.delete('refresh_token');
    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: ERROR_CODES.GEN_001,
          message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
        },
      },
      { status: 500 }
    );
  }
}
```

### 2.5 전체 로그아웃 (모든 기기)

```yaml
POST /api/auth/logout-all
Authorization: Bearer {accessToken}
```

#### 구현

```typescript
// src/app/api/auth/logout-all/route.ts
import { withAuth, AuthenticatedRequest } from '@/lib/auth/guards';

export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    const supabase = getSupabaseAdmin();

    // 모든 Refresh Token 폐기
    await supabase
      .from('refresh_tokens')
      .update({ revoked: true, revoked_at: new Date().toISOString() })
      .eq('user_id', req.userId)
      .eq('revoked', false);

    // 모든 세션 무효화
    await supabase
      .from('user_sessions')
      .update({ invalidated_at: new Date().toISOString() })
      .eq('user_id', req.userId)
      .is('invalidated_at', null);

    // 감사 로그
    await supabase.from('audit_logs').insert({
      user_id: req.userId,
      action: 'logout_all',
      details: {},
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0],
    });

    const response = NextResponse.json(
      {
        success: true,
        data: {
          message: '모든 기기에서 로그아웃되었습니다',
        },
      },
      { status: 200 }
    );

    response.cookies.delete('refresh_token');
    return response;
  });
}
```

---

## 3. 랜딩페이지 API

### 3.1 목록 조회

```yaml
GET /api/lp
Authorization: Bearer {accessToken}
Query: ?page=1&limit=10&status=all
```

#### 응답

```typescript
interface LandingPageListItem {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'archived';
  slug: string | null;
  publishedUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LandingPageListResponse {
  success: true;
  data: LandingPageListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
  };
}
```

#### 구현

```typescript
// src/app/api/lp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/auth/guards';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);
    const status = searchParams.get('status') || 'all';

    const supabase = getSupabaseAdmin();
    const offset = (page - 1) * limit;

    // 쿼리 빌드
    let query = supabase
      .from('landing_pages')
      .select('id, title, status, slug, published_url, created_at, updated_at', {
        count: 'exact',
      })
      .eq('user_id', req.userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // 상태 필터
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('LP list error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.GEN_001,
            message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: data?.map((lp) => ({
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
  });
}
```

### 3.2 생성

```yaml
POST /api/lp
Authorization: Bearer {accessToken}
```

#### 요청

```typescript
export const createLandingPageSchema = z.object({
  title: z.string().min(1).max(200),
  qaSessionId: z.string().uuid().optional(),
  content: z.record(z.any()).optional().default({}),
});

export type CreateLandingPageRequest = z.infer<typeof createLandingPageSchema>;
```

#### 구현

```typescript
// src/app/api/lp/route.ts (POST)
export async function POST(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    const body = await request.json();
    const validationResult = createLandingPageSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.GEN_004,
            message: ERROR_MESSAGES[ERROR_CODES.GEN_004],
          },
        },
        { status: 400 }
      );
    }

    const { title, qaSessionId, content } = validationResult.data;
    const supabase = getSupabaseAdmin();

    // 1. 랜딩페이지 수 제한 확인
    const { count } = await supabase
      .from('landing_pages')
      .select('id', { count: 'exact' })
      .eq('user_id', req.userId)
      .is('deleted_at', null);

    const maxPages = req.userTier === 'FREE' ? 3 : Infinity;
    if ((count || 0) >= maxPages) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.LP_003,
            message: ERROR_MESSAGES[ERROR_CODES.LP_003],
          },
        },
        { status: 429 }
      );
    }

    // 2. 생성
    const { data, error } = await supabase
      .from('landing_pages')
      .insert({
        user_id: req.userId,
        title,
        qa_session_id: qaSessionId,
        content,
        status: 'draft',
      })
      .select()
      .single();

    if (error) {
      console.error('LP create error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.GEN_001,
            message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
          },
        },
        { status: 500 }
      );
    }

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
  });
}
```

### 3.3 상세 조회

```yaml
GET /api/lp/:id
Authorization: Bearer {accessToken}
```

### 3.4 수정

```yaml
PATCH /api/lp/:id
Authorization: Bearer {accessToken}
```

### 3.5 삭제 (Soft Delete)

```yaml
DELETE /api/lp/:id
Authorization: Bearer {accessToken}
```

#### 응답

```typescript
interface DeleteLandingPageResponse {
  success: true;
  data: {
    message: string;
    deletedAt: string;
    recoveryDeadline: string; // 30일 후
  };
}
```

#### 구현

```typescript
// src/app/api/lp/[id]/route.ts (DELETE)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    const supabase = getSupabaseAdmin();

    // 1. 소유권 확인
    const { data: lp } = await supabase
      .from('landing_pages')
      .select('id, user_id, status, title')
      .eq('id', params.id)
      .is('deleted_at', null)
      .single();

    if (!lp || lp.user_id !== req.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.LP_001,
            message: ERROR_MESSAGES[ERROR_CODES.LP_001],
          },
        },
        { status: 404 }
      );
    }

    // 2. Soft Delete
    const deletedAt = new Date().toISOString();
    await supabase
      .from('landing_pages')
      .update({ deleted_at: deletedAt })
      .eq('id', params.id);

    // 3. 배포된 경우 상태 변경
    if (lp.status === 'published') {
      await supabase
        .from('landing_pages')
        .update({ status: 'archived' })
        .eq('id', params.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        message: '삭제되었습니다. 30일 이내 복구 가능합니다.',
        deletedAt,
        recoveryDeadline: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
    });
  });
}
```

### 3.6 복구

```yaml
POST /api/lp/:id/restore
Authorization: Bearer {accessToken}
```

#### 구현

```typescript
// src/app/api/lp/[id]/restore/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    const supabase = getSupabaseAdmin();

    // 1. 삭제된 항목 조회
    const { data: lp } = await supabase
      .from('landing_pages')
      .select('id, user_id, deleted_at, title')
      .eq('id', params.id)
      .not('deleted_at', 'is', null)
      .single();

    if (!lp || lp.user_id !== req.userId) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.LP_001,
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
            code: ERROR_CODES.LP_002,
            message: ERROR_MESSAGES[ERROR_CODES.LP_002],
          },
        },
        { status: 410 } // Gone
      );
    }

    // 3. 랜딩페이지 수 제한 확인
    const { count } = await supabase
      .from('landing_pages')
      .select('id', { count: 'exact' })
      .eq('user_id', req.userId)
      .is('deleted_at', null);

    const maxPages = req.userTier === 'FREE' ? 3 : Infinity;
    if ((count || 0) >= maxPages) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.LP_003,
            message: ERROR_MESSAGES[ERROR_CODES.LP_003],
          },
        },
        { status: 429 }
      );
    }

    // 4. 복구
    await supabase
      .from('landing_pages')
      .update({ deleted_at: null, status: 'draft' })
      .eq('id', params.id);

    return NextResponse.json({
      success: true,
      data: {
        message: '복구되었습니다',
        id: params.id,
      },
    });
  });
}
```

### 3.7 발행

```yaml
POST /api/lp/:id/publish
Authorization: Bearer {accessToken}
```

---

## 4. AI API

### 4.1 토큰 사용량 조회

```yaml
GET /api/ai/tokens
Authorization: Bearer {accessToken}
```

#### 응답

```typescript
interface TokenUsageResponse {
  success: true;
  data: {
    tier: 'FREE' | 'PRO' | 'ENTERPRISE';
    dailyLimit: number;
    usedToday: number;
    reserved: number;
    available: number;
    resetAt: string;
  };
}
```

#### 구현

```typescript
// src/app/api/ai/tokens/route.ts
export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase.rpc('get_token_usage_summary', {
      p_user_id: req.userId,
    });

    if (error) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: ERROR_CODES.GEN_001,
            message: ERROR_MESSAGES[ERROR_CODES.GEN_001],
          },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        tier: data.tier,
        dailyLimit: data.daily_limit,
        usedToday: data.used_today,
        reserved: data.reserved,
        available: data.available,
        resetAt: data.reset_at,
      },
    });
  });
}
```

### 4.2 AI 생성 (SSE)

```yaml
POST /api/ai/generate
Authorization: Bearer {accessToken}
Content-Type: application/json
Accept: text/event-stream
```

#### 요청

```typescript
export const aiGenerateSchema = z.object({
  qaSessionId: z.string().uuid(),
  options: z
    .object({
      tone: z.enum(['professional', 'casual', 'friendly']).optional(),
      length: z.enum(['short', 'medium', 'long']).optional(),
    })
    .optional(),
});
```

#### 응답 (Server-Sent Events)

```typescript
// 진행률 이벤트
event: progress
data: {"step": "analyzing", "progress": 20, "message": "고객 페르소나 분석 중..."}

// 스트리밍 텍스트
event: content
data: {"text": "생성된 "}

event: content
data: {"text": "텍스트 "}

// 완료
event: complete
data: {"id": "uuid", "title": "생성된 제목"}

// 에러
event: error
data: {"code": "AI_001", "message": "생성에 실패했습니다"}
```

---

## 5. Rate Limit 헤더

모든 API 응답에 Rate Limit 헤더 포함:

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 2025-01-15T10:00:00Z
Retry-After: 45  # 429 응답 시에만
```

---

## 6. 구현 체크리스트

### 6.1 인증 API
- [ ] POST /api/auth/signup
- [ ] POST /api/auth/login
- [ ] POST /api/auth/refresh
- [ ] POST /api/auth/logout
- [ ] POST /api/auth/logout-all

### 6.2 랜딩페이지 API
- [ ] GET /api/lp
- [ ] POST /api/lp
- [ ] GET /api/lp/:id
- [ ] PATCH /api/lp/:id
- [ ] DELETE /api/lp/:id
- [ ] POST /api/lp/:id/restore
- [ ] POST /api/lp/:id/publish
- [ ] GET /api/lp/deleted

### 6.3 AI API
- [ ] GET /api/ai/tokens
- [ ] POST /api/ai/generate
- [ ] POST /api/ai/chat

### 6.4 공통
- [ ] CORS 미들웨어
- [ ] Rate Limit 미들웨어
- [ ] 에러 코드 상수
- [ ] 응답 타입 정의
- [ ] Zod 스키마

---

**이전 문서: [02_DB_마이그레이션.md](./02_DB_마이그레이션.md)**
**다음 문서: [04_인증_시스템.md](./04_인증_시스템.md)**
