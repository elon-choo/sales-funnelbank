# Blue Team 개선안 v1

## 개선안 개요

| 항목 | 내용 |
|------|------|
| 작성 일시 | 2025-12-15 |
| 대응 리뷰 | Red Team 기획 v1 리뷰 (01_RedTeam_기획v1_리뷰.md) |
| 리뷰어 | Blue Team Code Enhancer v3.0 |
| 총 개선 항목 | 23개 |

### 대응 현황 요약

| 심각도 | 지적 건수 | 대응 완료 | 개선안 제시 |
|--------|----------|----------|-------------|
| CRITICAL | 3 | - | 3 |
| HIGH | 6 | - | 6 |
| MEDIUM | 8 | - | 8 |
| LOW | 6 | - | 6 |
| 문서 불일치 | 3 | - | 3 |

---

## 1. CRITICAL 이슈 개선안

### [CRITICAL-API-001] CORS '*' 설정 보안 취약점

**문제 인식**
`04_API_설계.md` 2.9절에서 CORS 설정을 `Access-Control-Allow-Origin: *`로 명시. 이는 모든 출처에서 API 접근을 허용하여 CSRF 공격에 노출되는 심각한 보안 취약점.

**즉시 조치 (Hotfix)**

```typescript
// src/middleware/cors.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 환경별 허용 도메인 설정
const ALLOWED_ORIGINS = {
  production: [
    'https://magnetic-sales.com',
    'https://www.magnetic-sales.com',
    'https://app.magnetic-sales.com'
  ],
  staging: [
    'https://staging.magnetic-sales.com',
    'https://preview-*.vercel.app'
  ],
  development: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000'
  ]
};

export function corsMiddleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const env = process.env.NODE_ENV || 'development';

  // 환경별 허용 출처 확인
  const allowedOrigins = ALLOWED_ORIGINS[env as keyof typeof ALLOWED_ORIGINS] || [];
  const isAllowed = allowedOrigins.some(allowed => {
    if (allowed.includes('*')) {
      // 와일드카드 패턴 매칭 (preview-*.vercel.app)
      const regex = new RegExp('^' + allowed.replace('*', '.*') + '$');
      return regex.test(origin);
    }
    return allowed === origin;
  });

  if (!isAllowed) {
    return new NextResponse(null, { status: 403, statusText: 'Forbidden' });
  }

  const response = NextResponse.next();

  // 허용된 출처만 설정
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  response.headers.set('Access-Control-Max-Age', '86400');

  return response;
}
```

**근본적 해결 옵션**

| 옵션 | 설명 | 장점 | 단점 | 예상 공수 |
|------|------|------|------|----------|
| A. 환경별 화이트리스트 (권장) | 위 코드처럼 환경별 허용 도메인 관리 | 세밀한 제어, 보안 강화 | 도메인 추가 시 배포 필요 | 0.5일 |
| B. Vercel Edge Config | Vercel Edge Config로 동적 관리 | 배포 없이 변경 가능 | Vercel 종속성 | 1일 |
| C. DB 기반 동적 관리 | 허용 도메인을 DB에서 관리 | 유연성 최대화 | 성능 오버헤드 | 2일 |

**권장 사항**: 옵션 A (환경별 화이트리스트)
- MVP 단계에서는 도메인 변경이 빈번하지 않음
- 코드 레벨에서 관리하여 Git 히스토리 추적 가능
- 추후 필요시 옵션 B/C로 마이그레이션 가능

**변경 영향 범위**
- `/src/middleware.ts` 또는 `/src/middleware/cors.ts` 신규 생성
- `next.config.js` CORS 관련 설정 수정
- 배포 환경별 환경 변수 확인

---

### [CRITICAL-API-002] 민감 정보 환경 변수 관리 부재

**문제 인식**
`04_API_설계.md`에 API 키, 시크릿 키 등 민감 정보의 환경 변수 관리 방안이 누락됨. 코드에 하드코딩 시 Git 히스토리에 노출되는 심각한 보안 위험.

**즉시 조치**

```typescript
// src/lib/config/env.ts

import { z } from 'zod';

// 환경 변수 스키마 정의 (Zod 검증)
const envSchema = z.object({
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Claude AI
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-'),

  // 애플리케이션
  NEXT_PUBLIC_APP_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ENCRYPTION_KEY: z.string().length(32), // AES-256

  // 이메일 (선택)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // 환경
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

// 타입 추출
export type Env = z.infer<typeof envSchema>;

// 환경 변수 검증 함수
function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment variables:');
    console.error(parsed.error.flatten().fieldErrors);
    throw new Error('Missing or invalid environment variables');
  }

  return parsed.data;
}

// 싱글톤 패턴으로 환경 변수 제공
let env: Env | null = null;

export function getEnv(): Env {
  if (!env) {
    env = validateEnv();
  }
  return env;
}

// 클라이언트 사이드용 공개 환경 변수
export function getPublicEnv() {
  return {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    appUrl: process.env.NEXT_PUBLIC_APP_URL!,
  };
}
```

**환경 변수 체크리스트**

```bash
# .env.example (Git에 커밋)
# ===========================
# Supabase 설정
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# 애플리케이션
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your-32-character-secret-key-here
ENCRYPTION_KEY=32-character-encryption-key-here

# 이메일 (선택)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# 환경
NODE_ENV=development
```

**.gitignore 추가**
```gitignore
# 환경 변수
.env
.env.local
.env.*.local
.env.production
.env.staging

# 절대 커밋하지 말 것
*.pem
*.key
credentials.json
```

**Vercel 환경 변수 설정 가이드**

```bash
# Vercel CLI로 환경 변수 설정
vercel env add ANTHROPIC_API_KEY production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add JWT_SECRET production
vercel env add ENCRYPTION_KEY production
```

**근본적 해결: 비밀 관리 시스템 도입**

| 옵션 | 설명 | 비용 | 예상 공수 |
|------|------|------|----------|
| A. Vercel 환경 변수 (권장) | Vercel 대시보드에서 관리 | 무료 | 0.5일 |
| B. HashiCorp Vault | 엔터프라이즈급 비밀 관리 | 유료 | 3일 |
| C. AWS Secrets Manager | AWS 통합 비밀 관리 | 유료 | 2일 |

**권장 사항**: 옵션 A (MVP), 추후 사용자 증가 시 옵션 B/C 검토

**변경 영향 범위**
- `/src/lib/config/env.ts` 신규 생성
- `.env.example` 템플릿 생성
- `.gitignore` 업데이트
- 모든 환경 변수 사용처에서 `getEnv()` 함수 사용

---

### [CRITICAL-API-003] AI 토큰 사용량 제한 부재

**문제 인식**
`05_AI_프롬프트_설계.md`에서 예상 토큰 비용을 계산했으나, 실제 API 호출에서 토큰 제한 로직이 없음. 무한 호출 시 예상치 못한 비용 폭증 위험.

**즉시 조치**

```typescript
// src/lib/ai/token-limiter.ts

import { getEnv } from '@/lib/config/env';
import { supabase } from '@/lib/supabase';

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface UserTokenLimit {
  dailyLimit: number;
  monthlyLimit: number;
  currentDailyUsage: number;
  currentMonthlyUsage: number;
}

// Claude 3.5 Sonnet 가격 (2024년 12월 기준)
const CLAUDE_PRICING = {
  inputPerMillion: 3.0,   // $3/1M 입력 토큰
  outputPerMillion: 15.0, // $15/1M 출력 토큰
};

// 사용자 등급별 일/월 토큰 한도
const TOKEN_LIMITS = {
  free: { daily: 50000, monthly: 500000 },
  basic: { daily: 200000, monthly: 2000000 },
  premium: { daily: 1000000, monthly: 10000000 },
};

export class TokenLimiter {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  // 토큰 사용량 확인 및 제한 검사
  async checkLimit(estimatedTokens: number): Promise<{
    allowed: boolean;
    remaining: number;
    message?: string;
  }> {
    const usage = await this.getCurrentUsage();
    const limits = await this.getUserLimits();

    // 일일 한도 확인
    if (usage.currentDailyUsage + estimatedTokens > limits.dailyLimit) {
      return {
        allowed: false,
        remaining: limits.dailyLimit - usage.currentDailyUsage,
        message: `일일 사용량 한도에 도달했습니다. 내일 다시 시도해주세요. (남은 토큰: ${limits.dailyLimit - usage.currentDailyUsage})`
      };
    }

    // 월간 한도 확인
    if (usage.currentMonthlyUsage + estimatedTokens > limits.monthlyLimit) {
      return {
        allowed: false,
        remaining: limits.monthlyLimit - usage.currentMonthlyUsage,
        message: `월간 사용량 한도에 도달했습니다. 업그레이드하시거나 다음 달까지 기다려주세요.`
      };
    }

    return {
      allowed: true,
      remaining: Math.min(
        limits.dailyLimit - usage.currentDailyUsage,
        limits.monthlyLimit - usage.currentMonthlyUsage
      )
    };
  }

  // 토큰 사용량 기록
  async recordUsage(usage: TokenUsage): Promise<void> {
    const cost = this.calculateCost(usage);

    await supabase.from('ai_usage_logs').insert({
      user_id: this.userId,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      cost_usd: cost,
      created_at: new Date().toISOString(),
    });

    // 일일/월간 사용량 업데이트
    await supabase.rpc('update_token_usage', {
      p_user_id: this.userId,
      p_tokens: usage.inputTokens + usage.outputTokens,
    });
  }

  // 비용 계산
  private calculateCost(usage: TokenUsage): number {
    const inputCost = (usage.inputTokens / 1_000_000) * CLAUDE_PRICING.inputPerMillion;
    const outputCost = (usage.outputTokens / 1_000_000) * CLAUDE_PRICING.outputPerMillion;
    return inputCost + outputCost;
  }

  // 현재 사용량 조회
  private async getCurrentUsage(): Promise<{ currentDailyUsage: number; currentMonthlyUsage: number }> {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    // 일일 사용량
    const { data: dailyData } = await supabase
      .from('ai_usage_logs')
      .select('input_tokens, output_tokens')
      .eq('user_id', this.userId)
      .gte('created_at', today);

    const currentDailyUsage = (dailyData || []).reduce(
      (sum, row) => sum + row.input_tokens + row.output_tokens, 0
    );

    // 월간 사용량
    const { data: monthlyData } = await supabase
      .from('ai_usage_logs')
      .select('input_tokens, output_tokens')
      .eq('user_id', this.userId)
      .gte('created_at', monthStart);

    const currentMonthlyUsage = (monthlyData || []).reduce(
      (sum, row) => sum + row.input_tokens + row.output_tokens, 0
    );

    return { currentDailyUsage, currentMonthlyUsage };
  }

  // 사용자 등급별 한도 조회
  private async getUserLimits(): Promise<{ dailyLimit: number; monthlyLimit: number }> {
    const { data: user } = await supabase
      .from('users')
      .select('tier')
      .eq('id', this.userId)
      .single();

    const tier = user?.tier || 'free';
    return TOKEN_LIMITS[tier as keyof typeof TOKEN_LIMITS] || TOKEN_LIMITS.free;
  }
}

// AI API 호출 래퍼
export async function callClaudeWithLimiter(
  userId: string,
  messages: any[],
  options: { maxTokens?: number } = {}
) {
  const limiter = new TokenLimiter(userId);

  // 예상 토큰 계산 (대략적 추정)
  const estimatedInputTokens = JSON.stringify(messages).length / 4;
  const estimatedOutputTokens = options.maxTokens || 4096;

  // 한도 확인
  const limitCheck = await limiter.checkLimit(estimatedInputTokens + estimatedOutputTokens);

  if (!limitCheck.allowed) {
    throw new Error(limitCheck.message);
  }

  // API 호출
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': getEnv().ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: options.maxTokens || 4096,
      messages,
    }),
  });

  const data = await response.json();

  // 실제 사용량 기록
  await limiter.recordUsage({
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    cost: 0, // calculateCost 내부에서 계산
  });

  return data;
}
```

**DB 스키마 추가**

```sql
-- AI 사용량 로그 테이블
CREATE TABLE ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 추가 (성능 최적화)
CREATE INDEX idx_ai_usage_logs_user_date
ON ai_usage_logs(user_id, created_at DESC);

-- 일/월 사용량 업데이트 함수
CREATE OR REPLACE FUNCTION update_token_usage(p_user_id UUID, p_tokens INTEGER)
RETURNS VOID AS $$
BEGIN
  -- 향후 캐시 테이블에 집계된 사용량 업데이트 로직
  -- 현재는 ai_usage_logs에 직접 기록하고 조회 시 집계
END;
$$ LANGUAGE plpgsql;
```

**변경 영향 범위**
- `/src/lib/ai/token-limiter.ts` 신규 생성
- `ai_usage_logs` 테이블 생성
- 모든 AI API 호출처에서 `callClaudeWithLimiter()` 사용
- 사용자 대시보드에 토큰 사용량 표시 UI 추가

---

## 2. HIGH 이슈 개선안

### [HIGH-SEC-001] 세션 토큰 만료 로직 미정의

**문제 인식**
`06_보안_인증.md`에서 JWT 토큰 만료 시간이 명시되지 않음. 탈취된 토큰이 무기한 유효할 경우 계정 탈취 위험.

**개선안**

```typescript
// src/lib/auth/token.ts

import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '@/lib/config/env';

// 토큰 만료 시간 설정
const TOKEN_EXPIRY = {
  accessToken: '15m',      // 15분 (짧은 수명)
  refreshToken: '7d',      // 7일 (로그인 유지)
  rememberMe: '30d',       // 30일 (자동 로그인)
};

interface TokenPayload {
  userId: string;
  email: string;
  role: 'user' | 'admin';
  approved: boolean;
}

// Access Token 생성
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  const secret = new TextEncoder().encode(getEnv().JWT_SECRET);

  return new SignJWT({ ...payload, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY.accessToken)
    .setJti(crypto.randomUUID()) // 유니크 토큰 ID
    .sign(secret);
}

// Refresh Token 생성
export async function generateRefreshToken(
  payload: TokenPayload,
  rememberMe: boolean = false
): Promise<string> {
  const secret = new TextEncoder().encode(getEnv().JWT_SECRET);
  const expiry = rememberMe ? TOKEN_EXPIRY.rememberMe : TOKEN_EXPIRY.refreshToken;

  return new SignJWT({ ...payload, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiry)
    .setJti(crypto.randomUUID())
    .sign(secret);
}

// 토큰 검증
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = new TextEncoder().encode(getEnv().JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as 'user' | 'admin',
      approved: payload.approved as boolean,
    };
  } catch (error) {
    // 토큰 만료 또는 유효하지 않음
    return null;
  }
}

// 토큰 갱신 플로우
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const payload = await verifyToken(refreshToken);

  if (!payload) {
    return null;
  }

  // 새 토큰 쌍 발급
  const newAccessToken = await generateAccessToken(payload);
  const newRefreshToken = await generateRefreshToken(payload);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}
```

**클라이언트 측 토큰 관리**

```typescript
// src/lib/auth/token-manager.ts (클라이언트)

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  setTokens: (access: string, refresh: string) => void;
  clearTokens: () => void;
  isExpired: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      expiresAt: null,

      setTokens: (access, refresh) => {
        // JWT 디코딩하여 만료 시간 추출
        const payload = JSON.parse(atob(access.split('.')[1]));
        set({
          accessToken: access,
          refreshToken: refresh,
          expiresAt: payload.exp * 1000, // Unix timestamp -> ms
        });
      },

      clearTokens: () => set({
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
      }),

      isExpired: () => {
        const { expiresAt } = get();
        if (!expiresAt) return true;
        // 만료 1분 전부터 갱신 필요로 판단
        return Date.now() > expiresAt - 60000;
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        refreshToken: state.refreshToken,
      }),
    }
  )
);

// Axios 인터셉터에서 자동 갱신
export async function setupAxiosInterceptors(axiosInstance: any) {
  axiosInstance.interceptors.request.use(async (config: any) => {
    const store = useAuthStore.getState();

    // 토큰 만료 확인 및 갱신
    if (store.isExpired() && store.refreshToken) {
      try {
        const response = await fetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: store.refreshToken }),
        });

        if (response.ok) {
          const { accessToken, refreshToken } = await response.json();
          store.setTokens(accessToken, refreshToken);
        } else {
          store.clearTokens();
          window.location.href = '/login';
          return Promise.reject('Session expired');
        }
      } catch (error) {
        store.clearTokens();
      }
    }

    // 헤더에 토큰 추가
    if (store.accessToken) {
      config.headers.Authorization = `Bearer ${store.accessToken}`;
    }

    return config;
  });
}
```

**예상 공수**: 1일

---

### [HIGH-SEC-002] SQL Injection 방어 로직 미명시

**문제 인식**
`03_DB_설계.md`에 SQL Injection 방어 전략이 누락. RLS만으로는 복잡한 쿼리에서 인젝션 취약점 가능.

**개선안: Prepared Statement 강제 + 입력 검증**

```typescript
// src/lib/db/safe-query.ts

import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// 입력 검증 스키마 예시
const searchSchema = z.object({
  keyword: z.string().max(100).regex(/^[a-zA-Z0-9가-힣\s]+$/), // 특수문자 차단
  page: z.number().int().min(1).max(1000),
  limit: z.number().int().min(1).max(100),
});

// 안전한 쿼리 빌더
export class SafeQueryBuilder {
  private table: string;
  private filters: { column: string; operator: string; value: any }[] = [];

  constructor(table: string) {
    // 테이블명 화이트리스트 검증
    const allowedTables = ['users', 'projects', 'landing_pages', 'ai_sessions'];
    if (!allowedTables.includes(table)) {
      throw new Error(`Invalid table name: ${table}`);
    }
    this.table = table;
  }

  // 컬럼명 화이트리스트 검증
  private validateColumn(table: string, column: string): boolean {
    const columnWhitelist: Record<string, string[]> = {
      users: ['id', 'email', 'name', 'approved', 'created_at'],
      projects: ['id', 'user_id', 'title', 'status', 'created_at'],
      landing_pages: ['id', 'project_id', 'slug', 'html_content', 'published'],
      ai_sessions: ['id', 'user_id', 'session_type', 'status', 'created_at'],
    };

    return columnWhitelist[table]?.includes(column) ?? false;
  }

  where(column: string, operator: string, value: any): this {
    if (!this.validateColumn(this.table, column)) {
      throw new Error(`Invalid column: ${column}`);
    }

    // 연산자 화이트리스트
    const allowedOperators = ['=', '!=', '>', '<', '>=', '<=', 'like', 'ilike', 'in'];
    if (!allowedOperators.includes(operator.toLowerCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    this.filters.push({ column, operator, value });
    return this;
  }

  async execute() {
    let query = supabase.from(this.table).select('*');

    for (const filter of this.filters) {
      // Supabase는 내부적으로 Prepared Statement 사용
      switch (filter.operator.toLowerCase()) {
        case '=':
          query = query.eq(filter.column, filter.value);
          break;
        case '!=':
          query = query.neq(filter.column, filter.value);
          break;
        case '>':
          query = query.gt(filter.column, filter.value);
          break;
        case '<':
          query = query.lt(filter.column, filter.value);
          break;
        case 'like':
        case 'ilike':
          // LIKE 패턴에서 특수문자 이스케이프
          const escapedValue = filter.value.replace(/[%_]/g, '\\$&');
          query = query.ilike(filter.column, `%${escapedValue}%`);
          break;
        case 'in':
          query = query.in(filter.column, filter.value);
          break;
      }
    }

    return query;
  }
}

// 사용 예시
export async function searchProjects(userId: string, keyword: string) {
  // 입력 검증
  const validated = searchSchema.parse({ keyword, page: 1, limit: 20 });

  const query = new SafeQueryBuilder('projects')
    .where('user_id', '=', userId)
    .where('title', 'ilike', validated.keyword);

  return query.execute();
}
```

**예상 공수**: 1일

---

### [HIGH-PERF-001] AI 응답 스트리밍 에러 핸들링 미정의

**문제 인식**
`05_AI_프롬프트_설계.md`에서 스트리밍 지원을 언급했으나, 스트리밍 중 에러 발생 시 처리 로직이 없음.

**개선안**

```typescript
// src/lib/ai/streaming.ts

import { getEnv } from '@/lib/config/env';

interface StreamingOptions {
  onToken: (token: string) => void;
  onError: (error: Error) => void;
  onComplete: (fullResponse: string) => void;
  signal?: AbortSignal;
  timeout?: number;
}

export async function streamClaudeResponse(
  messages: any[],
  options: StreamingOptions
): Promise<void> {
  const { onToken, onError, onComplete, signal, timeout = 60000 } = options;

  let fullResponse = '';
  let retryCount = 0;
  const maxRetries = 3;

  // 타임아웃 설정
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': getEnv().ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        messages,
        stream: true,
      }),
      signal: signal || controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);

          if (data === '[DONE]') {
            onComplete(fullResponse);
            return;
          }

          try {
            const parsed = JSON.parse(data);

            // 에러 이벤트 처리
            if (parsed.type === 'error') {
              throw new Error(parsed.error?.message || 'Unknown streaming error');
            }

            // 콘텐츠 델타 처리
            if (parsed.type === 'content_block_delta') {
              const token = parsed.delta?.text || '';
              fullResponse += token;
              onToken(token);
            }
          } catch (parseError) {
            // JSON 파싱 에러는 무시 (불완전한 청크일 수 있음)
            console.warn('Partial JSON chunk:', line);
          }
        }
      }
    }

    onComplete(fullResponse);

  } catch (error: any) {
    clearTimeout(timeoutId);

    // 재시도 가능한 에러인 경우
    if (
      retryCount < maxRetries &&
      (error.name === 'AbortError' || error.message.includes('network'))
    ) {
      retryCount++;
      console.log(`Retrying... (${retryCount}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      return streamClaudeResponse(messages, options);
    }

    // 사용자 친화적 에러 메시지
    const userMessage = getErrorMessage(error);
    onError(new Error(userMessage));

  } finally {
    clearTimeout(timeoutId);
  }
}

function getErrorMessage(error: Error): string {
  if (error.name === 'AbortError') {
    return '응답 시간이 초과되었습니다. 다시 시도해주세요.';
  }

  if (error.message.includes('429')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
  }

  if (error.message.includes('500') || error.message.includes('503')) {
    return 'AI 서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.';
  }

  return 'AI 응답 생성 중 오류가 발생했습니다. 다시 시도해주세요.';
}
```

**예상 공수**: 0.5일

---

### [HIGH-DB-001] users 테이블 approved 필드 기본값 충돌

**문제 인식**
`03_DB_설계.md`에서 `approved` 필드가 `DEFAULT false`이지만, `06_보안_인증.md`에서는 기본값 언급 없음. 문서 간 불일치.

**개선안**

```sql
-- 명확한 approved 필드 정의
ALTER TABLE users
ALTER COLUMN approved SET DEFAULT false;

-- NOT NULL 제약 추가 (null 방지)
ALTER TABLE users
ALTER COLUMN approved SET NOT NULL;

-- 체크 제약 추가 (boolean만 허용)
-- PostgreSQL에서는 boolean 타입이 자동으로 true/false만 허용

-- 코멘트 추가
COMMENT ON COLUMN users.approved IS '관리자 승인 여부. 가입 시 false, 관리자 승인 후 true. NULL 불가.';
```

**문서 통일안**

| 문서 | 현재 내용 | 수정 내용 |
|------|----------|----------|
| 03_DB_설계.md | `approved BOOLEAN DEFAULT false` | `approved BOOLEAN NOT NULL DEFAULT false` |
| 06_보안_인증.md | 기본값 언급 없음 | "가입 시 approved=false로 저장, 관리자 승인 후 true로 변경" 명시 |
| 02_기능_정의.md | AUTH-001에서 `approved: false` 언급 | 유지 |

**예상 공수**: 0.5일 (문서 수정 + 마이그레이션)

---

### [HIGH-PERF-002] 랜딩페이지 생성 60초 타임아웃 복구 전략 부재

**문제 인식**
`02_기능_정의.md`에서 랜딩페이지 생성 시간을 60초 이내로 명시. 60초 초과 시 사용자 경험 저하.

**개선안: 비동기 작업 큐 + 진행 상황 폴링**

```typescript
// src/lib/queue/landing-page-generator.ts

import { supabase } from '@/lib/supabase';

interface GenerationJob {
  id: string;
  userId: string;
  projectId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: string;
  error?: string;
}

// 작업 생성 (즉시 반환)
export async function createGenerationJob(
  userId: string,
  projectId: string,
  prompt: string
): Promise<string> {
  const jobId = crypto.randomUUID();

  await supabase.from('generation_jobs').insert({
    id: jobId,
    user_id: userId,
    project_id: projectId,
    prompt,
    status: 'pending',
    progress: 0,
    created_at: new Date().toISOString(),
  });

  // 백그라운드 작업 트리거 (Edge Function 또는 별도 워커)
  await triggerBackgroundGeneration(jobId);

  return jobId;
}

// 진행 상황 조회
export async function getJobStatus(jobId: string): Promise<GenerationJob | null> {
  const { data, error } = await supabase
    .from('generation_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (error) return null;
  return data as GenerationJob;
}

// 백그라운드 작업 트리거
async function triggerBackgroundGeneration(jobId: string): Promise<void> {
  // Supabase Edge Function 호출
  await supabase.functions.invoke('generate-landing-page', {
    body: { jobId },
  });
}
```

**프론트엔드 폴링 컴포넌트**

```typescript
// src/components/GenerationProgress.tsx

import { useEffect, useState } from 'react';

interface Props {
  jobId: string;
  onComplete: (html: string) => void;
  onError: (error: string) => void;
}

export function GenerationProgress({ jobId, onComplete, onError }: Props) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>('pending');

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      const response = await fetch(`/api/jobs/${jobId}/status`);
      const job = await response.json();

      setProgress(job.progress);
      setStatus(job.status);

      if (job.status === 'completed') {
        clearInterval(pollInterval);
        onComplete(job.result);
      }

      if (job.status === 'failed') {
        clearInterval(pollInterval);
        onError(job.error || '생성에 실패했습니다.');
      }
    }, 2000); // 2초마다 폴링

    // 최대 5분 타임아웃
    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      onError('생성 시간이 초과되었습니다. 다시 시도해주세요.');
    }, 300000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(timeoutId);
    };
  }, [jobId]);

  const progressSteps = [
    { name: '프롬프트 분석', threshold: 10 },
    { name: '섹션 구조 설계', threshold: 30 },
    { name: 'HTML 코드 생성', threshold: 60 },
    { name: '스타일 적용', threshold: 80 },
    { name: '최종 검토', threshold: 100 },
  ];

  return (
    <div className="p-6 text-center">
      <div className="mb-4">
        <div className="w-16 h-16 mx-auto border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>

      <h3 className="text-xl font-bold mb-2">랜딩페이지 생성 중...</h3>
      <p className="text-gray-600 mb-6">예상 소요 시간: 약 30-60초</p>

      <div className="max-w-md mx-auto">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-2 text-left">
          {progressSteps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              {progress >= step.threshold ? (
                <span className="text-green-500">✓</span>
              ) : progress > progressSteps[index - 1]?.threshold || (index === 0 && progress > 0) ? (
                <span className="animate-pulse">▶</span>
              ) : (
                <span className="text-gray-300">○</span>
              )}
              <span className={progress >= step.threshold ? 'text-green-700' : 'text-gray-500'}>
                {step.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**예상 공수**: 2일

---

### [HIGH-UX-001] Rate Limiting 정책 미정의

**문제 인식**
`04_API_설계.md`에 Rate Limiting 정책이 없음. DDoS 및 API 남용에 취약.

**개선안**

```typescript
// src/middleware/rate-limiter.ts

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Upstash Redis 기반 Rate Limiter
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});

// 엔드포인트별 Rate Limit 설정
const rateLimiters = {
  // 일반 API: 분당 60회
  default: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(60, '1m'),
    analytics: true,
  }),

  // AI API: 분당 10회 (비용 절약)
  ai: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1m'),
    analytics: true,
  }),

  // 로그인: 분당 5회 (브루트포스 방지)
  auth: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '1m'),
    analytics: true,
  }),

  // 랜딩페이지 생성: 시간당 10회
  generation: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, '1h'),
    analytics: true,
  }),
};

export async function rateLimitMiddleware(
  request: NextRequest,
  type: keyof typeof rateLimiters = 'default'
): Promise<NextResponse | null> {
  // IP 또는 사용자 ID로 식별
  const identifier =
    request.headers.get('x-user-id') ||
    request.ip ||
    request.headers.get('x-forwarded-for') ||
    'anonymous';

  const limiter = rateLimiters[type];
  const { success, limit, remaining, reset } = await limiter.limit(identifier);

  // Rate Limit 헤더 추가
  const headers = new Headers();
  headers.set('X-RateLimit-Limit', limit.toString());
  headers.set('X-RateLimit-Remaining', remaining.toString());
  headers.set('X-RateLimit-Reset', reset.toString());

  if (!success) {
    return new NextResponse(
      JSON.stringify({
        error: '요청 한도를 초과했습니다.',
        retryAfter: Math.ceil((reset - Date.now()) / 1000),
      }),
      {
        status: 429,
        headers: {
          ...Object.fromEntries(headers),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null;
}
```

**Rate Limit 정책 문서화**

| 엔드포인트 | 제한 | 윈도우 | 초과 시 |
|-----------|------|--------|---------|
| `/api/*` (기본) | 60회 | 1분 | 429 + Retry-After |
| `/api/ai/*` | 10회 | 1분 | 429 + 대기 안내 |
| `/api/auth/login` | 5회 | 1분 | 429 + 계정 잠금 경고 |
| `/api/generate/*` | 10회 | 1시간 | 429 + 시간당 한도 안내 |

**예상 공수**: 1일

---

## 3. MEDIUM 이슈 개선안

### [MEDIUM-API-001] API 버전 관리 전략 부재

**개선안**

```typescript
// src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // API 버전 라우팅
  if (pathname.startsWith('/api/')) {
    // 버전 명시가 없으면 v1으로 리다이렉트
    if (!pathname.match(/\/api\/v\d+\//)) {
      const newPath = pathname.replace('/api/', '/api/v1/');
      return NextResponse.rewrite(new URL(newPath, request.url));
    }
  }

  return NextResponse.next();
}

// 버전별 API 라우트 구조
// /src/app/api/v1/users/route.ts
// /src/app/api/v2/users/route.ts (향후)
```

**예상 공수**: 0.5일

---

### [MEDIUM-DB-002] 소프트 삭제 구현 상세 부재

**개선안**

```sql
-- 소프트 삭제용 컬럼 추가
ALTER TABLE landing_pages ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE projects ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 소프트 삭제 뷰 (삭제되지 않은 항목만)
CREATE VIEW active_landing_pages AS
SELECT * FROM landing_pages WHERE deleted_at IS NULL;

CREATE VIEW active_projects AS
SELECT * FROM projects WHERE deleted_at IS NULL;

-- 소프트 삭제 함수
CREATE OR REPLACE FUNCTION soft_delete_landing_page(p_page_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE landing_pages
  SET deleted_at = NOW()
  WHERE id = p_page_id AND deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 복구 함수
CREATE OR REPLACE FUNCTION restore_landing_page(p_page_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE landing_pages
  SET deleted_at = NULL
  WHERE id = p_page_id;
END;
$$ LANGUAGE plpgsql;

-- 30일 후 영구 삭제 (배치 작업)
CREATE OR REPLACE FUNCTION permanent_delete_old_records()
RETURNS VOID AS $$
BEGIN
  DELETE FROM landing_pages
  WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';

  DELETE FROM projects
  WHERE deleted_at IS NOT NULL
  AND deleted_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;
```

**예상 공수**: 0.5일

---

### [MEDIUM-SEC-003] XSS 방어 구현 상세 부재

**개선안**

```typescript
// src/lib/security/sanitize.ts

import DOMPurify from 'isomorphic-dompurify';

// HTML 콘텐츠 세니타이징 (랜딩페이지 저장 시)
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr',
      'ul', 'ol', 'li',
      'strong', 'em', 'u', 'strike',
      'a', 'img',
      'div', 'span', 'section', 'article', 'header', 'footer',
      'table', 'tr', 'td', 'th', 'thead', 'tbody',
      'form', 'input', 'button', 'textarea', 'label',
      'style', // TailwindCSS 인라인 스타일용
    ],
    ALLOWED_ATTR: [
      'href', 'src', 'alt', 'title', 'class', 'id', 'style',
      'target', 'rel',
      'type', 'name', 'value', 'placeholder',
      'data-*', // 데이터 속성 허용
    ],
    ALLOW_DATA_ATTR: true,
    ADD_ATTR: ['target'], // a 태그에 target 허용
  });
}

// 텍스트 입력 이스케이프
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}

// 사용자 입력 검증 (프롬프트, 댓글 등)
export function sanitizeUserInput(input: string): string {
  // 1. 앞뒤 공백 제거
  let sanitized = input.trim();

  // 2. NULL 바이트 제거
  sanitized = sanitized.replace(/\0/g, '');

  // 3. 연속 공백 단일 공백으로
  sanitized = sanitized.replace(/\s+/g, ' ');

  // 4. 위험한 유니코드 문자 제거
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');

  return sanitized;
}
```

**예상 공수**: 0.5일

---

### [MEDIUM-UX-002] 오프라인 지원 구현 상세 부재

**개선안: Service Worker + IndexedDB 캐싱**

```typescript
// public/sw.js (Service Worker)

const CACHE_NAME = 'magnetic-sales-v1';
const OFFLINE_URLS = [
  '/',
  '/offline.html',
  '/dashboard',
  '/_next/static/css/app.css',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // API 요청은 네트워크 우선
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // 오프라인 시 캐시된 응답 또는 오류 메시지
          return new Response(
            JSON.stringify({ error: '오프라인 상태입니다.' }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        })
    );
    return;
  }

  // 정적 리소스는 캐시 우선
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

```typescript
// src/lib/offline/conversation-cache.ts

import { openDB } from 'idb';

const DB_NAME = 'magnetic-sales-offline';
const STORE_NAME = 'conversations';

async function getDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    },
  });
}

// 대화 내용 로컬 저장
export async function saveConversation(sessionId: string, messages: any[]) {
  const db = await getDb();
  await db.put(STORE_NAME, {
    id: sessionId,
    messages,
    lastSaved: new Date().toISOString(),
    synced: false,
  });
}

// 로컬 대화 불러오기
export async function loadConversation(sessionId: string) {
  const db = await getDb();
  return db.get(STORE_NAME, sessionId);
}

// 온라인 복귀 시 동기화
export async function syncConversations() {
  const db = await getDb();
  const unsyncedConversations = await db.getAll(STORE_NAME);

  for (const conv of unsyncedConversations) {
    if (!conv.synced) {
      try {
        await fetch('/api/ai/sync', {
          method: 'POST',
          body: JSON.stringify(conv),
        });

        conv.synced = true;
        await db.put(STORE_NAME, conv);
      } catch (error) {
        console.error('Sync failed:', error);
      }
    }
  }
}
```

**예상 공수**: 2일

---

### [MEDIUM-UX-003] 40개 질문 스킵 시 기본값 미정의

**개선안**

```typescript
// src/lib/ai/default-values.ts

// 질문별 기본값 정의
export const QUESTION_DEFAULTS: Record<number, {
  default: string;
  skipMessage: string;
}> = {
  // Phase 1: 기본 정보
  1: {
    default: '미지정',
    skipMessage: '업종을 지정하지 않으면 범용 템플릿이 적용됩니다.'
  },
  2: {
    default: '30-50대 성인',
    skipMessage: '타겟을 지정하지 않으면 범용 타겟팅이 적용됩니다.'
  },
  3: {
    default: '비공개',
    skipMessage: '매출 정보는 비공개로 처리됩니다.'
  },
  4: {
    default: '현재 대비 2배',
    skipMessage: '목표 매출은 현재의 2배로 설정됩니다.'
  },

  // Phase 2: 페인포인트
  11: {
    default: '신규 고객 확보에 어려움',
    skipMessage: '일반적인 DB 부족 페인포인트가 적용됩니다.'
  },
  14: {
    default: '"생각해볼게요"',
    skipMessage: '가장 흔한 거절 반응이 적용됩니다.'
  },

  // Phase 3: 희망/목표
  21: {
    default: '현재 대비 50% 성장',
    skipMessage: '일반적인 3개월 목표가 적용됩니다.'
  },
  26: {
    default: '자신감 있는 세일즈',
    skipMessage: '일반적인 감정 목표가 적용됩니다.'
  },

  // Phase 4: 콘텐츠 소재
  32: {
    default: '1:1 맞춤 서비스',
    skipMessage: '일반적인 차별점이 적용됩니다.'
  },
  37: {
    default: '상담 후 안내',
    skipMessage: '가격은 상담 후 안내로 표시됩니다.'
  },
  39: {
    default: '100% 만족 보장',
    skipMessage: '일반적인 보장 문구가 적용됩니다.'
  },
  40: {
    default: '무료 상담 신청',
    skipMessage: 'CTA 목표는 상담 신청으로 설정됩니다.'
  },
};

// 스킵 처리 함수
export function handleQuestionSkip(questionNumber: number): {
  value: string;
  userMessage: string;
} {
  const defaultInfo = QUESTION_DEFAULTS[questionNumber];

  if (!defaultInfo) {
    return {
      value: '미응답',
      userMessage: '이 항목은 비워둡니다.',
    };
  }

  return {
    value: defaultInfo.default,
    userMessage: `건너뛰셨네요. ${defaultInfo.skipMessage}`,
  };
}
```

**예상 공수**: 0.5일

---

### 기타 MEDIUM 이슈 요약

| 이슈 ID | 문제 | 개선안 요약 | 예상 공수 |
|---------|------|------------|----------|
| MEDIUM-PERF-003 | 이미지 지연 로딩 구현 미정의 | Next.js Image 컴포넌트 + blur placeholder | 0.5일 |
| MEDIUM-UX-004 | 비밀번호 재설정 토큰 유효시간 30분 근거 | 업계 표준 준수, 문서에 근거 명시 | 0.25일 |
| MEDIUM-DB-003 | ai_sessions 테이블 만료 정책 | 90일 후 자동 삭제 배치 작업 추가 | 0.5일 |
| MEDIUM-API-004 | 페이지네이션 최대값 미정의 | limit 최대 100, 기본 20으로 설정 | 0.25일 |

---

## 4. LOW 이슈 개선안 요약

| 이슈 ID | 문제 | 개선안 요약 | 예상 공수 |
|---------|------|------------|----------|
| LOW-DOC-001 | 에러 코드 체계화 부족 | `ERR_{도메인}_{코드}` 형식 정의 | 0.5일 |
| LOW-DOC-002 | API 응답 예시 일부 누락 | Swagger/OpenAPI 스펙 생성 | 1일 |
| LOW-SEC-003 | 로그인 5회 실패 후 잠금 해제 방법 | 15분 자동 해제 + 이메일 즉시 해제 링크 | 0.25일 |
| LOW-PERF-001 | 동시 사용자 100명 산출 근거 | Vercel Hobby 플랜 기준, Pro 업그레이드 시 확장 | 0.25일 |
| LOW-UX-001 | 구글 폼 연동만 지원 이유 | MVP 빠른 출시 위해, Phase 2에서 자체 폼 빌더 | 문서 명시 |
| LOW-DB-004 | 파일 업로드 5MB 제한 근거 | Vercel 서버리스 제한 + 이미지 최적화 효율 | 문서 명시 |

---

## 5. 문서 간 불일치 해결안

### [CONFLICT-001] approved 필드 기본값 불일치

**현황**
- `03_DB_설계.md`: `DEFAULT false` 명시
- `06_보안_인증.md`: 기본값 언급 없음
- `02_기능_정의.md`: AUTH-001에서 `approved: false` 언급

**해결안**
`06_보안_인증.md` 3.1절에 다음 내용 추가:

```markdown
### 3.1.2 승인 상태 관리

#### 가입 시 기본값
- 모든 신규 가입자는 `approved = false` 상태로 저장됩니다.
- 관리자가 수동으로 승인 후 `approved = true`로 변경됩니다.

#### 승인 상태별 접근 권한
| approved | 접근 가능 | 제한됨 |
|----------|----------|--------|
| false | /pending, /logout | /dashboard, /planner, /builder |
| true | 모든 페이지 | - |
```

---

### [CONFLICT-002] 세션 타임아웃 불일치

**현황**
- `02_기능_정의.md` AI-001: "30분 비활동 시 자동 저장"
- `01_UX_플로우.md`: 타임아웃 관련 언급 없음

**해결안**
`01_UX_플로우.md` 2.2절에 다음 내용 추가:

```markdown
#### 2.2.6 세션 타임아웃 처리

**타임아웃 조건**
- 30분간 메시지 입력 없음

**타임아웃 처리 플로우**
```
[25분 경과]
    |
    v
+----------------------------------+
| 5분 후 자동 저장됩니다.          |
| [계속하기]  [저장 후 나가기]     |
+----------------------------------+
    |
    | (5분 후)
    v
+----------------------------------+
| 대화가 자동 저장되었습니다.      |
| 대시보드에서 이어서 진행할 수    |
| 있습니다.                        |
|                                  |
| [대시보드로 이동]                |
+----------------------------------+
```
```

---

### [CONFLICT-003] 이미지 업로드 제한 불일치

**현황**
- `02_기능_정의.md` LP-003: "파일 크기 제한: 5MB"
- `01_UX_플로우.md`: "최대 10장, 각 5MB 이하"

**해결안**
두 문서가 일치하므로 충돌 없음. 단, 명확성을 위해 `02_기능_정의.md`에 장수 제한 추가:

```markdown
#### LP-003: 이미지 업로드/처리

| 제한 항목 | 값 |
|-----------|-----|
| 파일 크기 | 최대 5MB/장 |
| 업로드 개수 | 최대 10장/프로젝트 |
| 허용 형식 | JPG, PNG, WebP |
| 총 용량 | 최대 50MB/프로젝트 |
```

---

## 6. 구현 우선순위 로드맵

### Week 1: CRITICAL 이슈 해결 (필수)

| 우선순위 | 이슈 ID | 개선 내용 | 담당 | 예상 공수 |
|----------|---------|-----------|------|----------|
| P0-1 | CRITICAL-API-001 | CORS 화이트리스트 구현 | Backend | 0.5일 |
| P0-2 | CRITICAL-API-002 | 환경 변수 관리 체계 구축 | DevOps | 0.5일 |
| P0-3 | CRITICAL-API-003 | AI 토큰 제한 시스템 구현 | Backend | 1일 |

**Week 1 목표**: 보안 필수 요소 완료, 비용 폭증 방지

---

### Week 2: HIGH 이슈 해결

| 우선순위 | 이슈 ID | 개선 내용 | 담당 | 예상 공수 |
|----------|---------|-----------|------|----------|
| P1-1 | HIGH-SEC-001 | JWT 토큰 만료/갱신 로직 | Backend | 1일 |
| P1-2 | HIGH-SEC-002 | SQL Injection 방어 강화 | Backend | 1일 |
| P1-3 | HIGH-PERF-001 | 스트리밍 에러 핸들링 | Backend | 0.5일 |
| P1-4 | HIGH-UX-001 | Rate Limiting 구현 | Backend | 1일 |

**Week 2 목표**: 인증/보안 강화, API 안정성 확보

---

### Week 3: MEDIUM 이슈 해결

| 우선순위 | 이슈 ID | 개선 내용 | 담당 | 예상 공수 |
|----------|---------|-----------|------|----------|
| P2-1 | HIGH-PERF-002 | 비동기 작업 큐 구현 | Backend | 2일 |
| P2-2 | MEDIUM-SEC-003 | XSS 방어 구현 | Frontend | 0.5일 |
| P2-3 | MEDIUM-DB-002 | 소프트 삭제 구현 | Backend | 0.5일 |
| P2-4 | MEDIUM-UX-003 | 질문 스킵 기본값 구현 | Backend | 0.5일 |

**Week 3 목표**: UX 개선, 데이터 안전성 강화

---

### Week 4: LOW 이슈 + 문서화

| 우선순위 | 이슈 ID | 개선 내용 | 담당 | 예상 공수 |
|----------|---------|-----------|------|----------|
| P3-1 | LOW-DOC-001 | 에러 코드 체계화 | Tech Writer | 0.5일 |
| P3-2 | LOW-DOC-002 | API 문서 보완 | Tech Writer | 1일 |
| P3-3 | CONFLICT-* | 문서 불일치 해결 | Tech Writer | 0.5일 |
| P3-4 | - | QA 및 테스트 | QA | 2일 |

**Week 4 목표**: 문서 정합성 확보, 출시 준비 완료

---

## 7. 추가 권장 사항

### Red Team이 미처 발견하지 못한 개선점

#### 1. 모니터링 및 알림 시스템 구축

```typescript
// src/lib/monitoring/alerts.ts

interface AlertConfig {
  channel: 'slack' | 'email';
  threshold: number;
  message: string;
}

const ALERT_CONFIGS: Record<string, AlertConfig> = {
  // 비용 알림
  dailyCostThreshold: {
    channel: 'slack',
    threshold: 10, // $10 초과 시
    message: '일일 AI API 비용이 $10을 초과했습니다.',
  },

  // 에러율 알림
  errorRateThreshold: {
    channel: 'slack',
    threshold: 5, // 5% 초과 시
    message: 'API 에러율이 5%를 초과했습니다.',
  },

  // 응답 시간 알림
  responseTimeThreshold: {
    channel: 'email',
    threshold: 10000, // 10초 초과 시
    message: 'AI 응답 시간이 10초를 초과하는 요청이 발생했습니다.',
  },
};
```

#### 2. A/B 테스트 인프라 (Phase 2 권장)

```typescript
// 랜딩페이지 변형 테스트용
interface ABTestConfig {
  testId: string;
  variants: Array<{
    id: string;
    weight: number;
    changes: Record<string, any>;
  }>;
  metrics: string[];
  startDate: Date;
  endDate: Date;
}
```

#### 3. 백업 및 복구 전략

```yaml
백업_정책:
  supabase_db:
    주기: 매일 자동 백업 (Supabase 기본)
    보관: 7일

  사용자_콘텐츠:
    주기: 변경 시 버전 저장
    보관: 최근 10개 버전

  복구_테스트:
    주기: 분기 1회
    담당: DevOps
```

#### 4. 접근성(a11y) 자동 테스트

```typescript
// 빌드 파이프라인에 접근성 테스트 추가
// package.json scripts
{
  "test:a11y": "pa11y-ci --config .pa11yci.json",
  "prebuild": "npm run test:a11y"
}
```

---

## 8. 결론

### 핵심 요약

1. **CRITICAL 이슈 3건**은 즉시 수정 필요
   - CORS 보안 취약점
   - 환경 변수 관리
   - AI 비용 제어

2. **HIGH 이슈 6건**은 1주 내 해결 권장
   - 세션 토큰 관리
   - SQL Injection 방어
   - Rate Limiting

3. **문서 불일치 3건**은 정합성 확보 필요
   - approved 기본값 통일
   - 세션 타임아웃 명시
   - 이미지 제한 명확화

### 예상 총 공수

| 심각도 | 이슈 수 | 예상 공수 |
|--------|---------|----------|
| CRITICAL | 3 | 2일 |
| HIGH | 6 | 6일 |
| MEDIUM | 8 | 5일 |
| LOW | 6 | 2.5일 |
| 문서화 | 3 | 1일 |
| QA/테스트 | - | 2일 |
| **총계** | **26** | **18.5일 (약 4주)** |

### 권장 일정

| 주차 | 목표 | 산출물 |
|------|------|--------|
| Week 1 | CRITICAL 해결 | 보안 패치 완료 |
| Week 2 | HIGH 해결 | 인증/API 안정화 |
| Week 3 | MEDIUM 해결 | UX/데이터 안전성 |
| Week 4 | LOW + QA | 출시 준비 완료 |

---

**Blue Team Code Enhancer v3.0**
*"문제를 기회로, 지적을 개선으로, 비판을 발전으로"*

---

## 문서 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-12-15 | 초안 작성 | Blue Team Code Enhancer v3.0 |
