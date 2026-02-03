// src/lib/env.ts
// 환경 변수 검증 및 타입 안전 접근

import { z } from 'zod';

// 환경 변수 스키마 정의
const envSchema = z.object({
  // 필수: Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('유효한 Supabase URL이 필요합니다'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'Supabase Anon Key가 필요합니다'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase Service Role Key가 필요합니다'),

  // 필수: AI API
  ANTHROPIC_API_KEY: z.string().min(1, 'Anthropic API Key가 필요합니다'),

  // 선택: AI 모델 설정
  AI_DEFAULT_MODEL: z.string().default('claude-sonnet-4-20250514'),
  AI_PREMIUM_MODEL: z.string().default('claude-opus-4-5-20251101'),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().default(800),

  // 선택: Cron 보안
  CRON_SECRET: z.string().optional(),

  // 선택: 이메일 (Nodemailer)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().optional(),

  // 선택: Sentry (에러 모니터링)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),

  // 환경
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
});

// 타입 추출
export type Env = z.infer<typeof envSchema>;

// 환경 변수 검증 함수
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error('❌ 환경 변수 검증 실패:');
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
    });

    if (process.env.NODE_ENV === 'production') {
      throw new Error('환경 변수 검증 실패 - 프로덕션 실행 불가');
    }
  }

  return result.data as Env;
}

// 환경 변수 싱글톤
let envInstance: Env | null = null;

export function getEnv(): Env {
  if (!envInstance) {
    envInstance = validateEnv();
  }
  return envInstance;
}

// 개별 환경 변수 안전 접근
export const env = {
  // Supabase
  get supabaseUrl() {
    return process.env.NEXT_PUBLIC_SUPABASE_URL!;
  },
  get supabaseAnonKey() {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  },
  get supabaseServiceKey() {
    return process.env.SUPABASE_SERVICE_ROLE_KEY!;
  },

  // AI
  get anthropicApiKey() {
    return process.env.ANTHROPIC_API_KEY!;
  },
  get defaultAiModel() {
    return process.env.AI_DEFAULT_MODEL || 'claude-sonnet-4-20250514';
  },
  get premiumAiModel() {
    return process.env.AI_PREMIUM_MODEL || 'claude-opus-4-5-20251101';
  },
  get aiMonthlyBudget() {
    return Number(process.env.AI_MONTHLY_BUDGET_USD) || 800;
  },

  // Cron
  get cronSecret() {
    return process.env.CRON_SECRET;
  },

  // 환경
  get isDev() {
    return process.env.NODE_ENV === 'development';
  },
  get isProd() {
    return process.env.NODE_ENV === 'production';
  },
  get isTest() {
    return process.env.NODE_ENV === 'test';
  },
  get appUrl() {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  },

  // Sentry
  get sentryDsn() {
    return process.env.NEXT_PUBLIC_SENTRY_DSN;
  },
};

// 환경 변수 목록 (문서화용)
export const ENV_DOCUMENTATION = {
  required: [
    { key: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase 프로젝트 URL' },
    { key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase Anonymous Key (공개)' },
    { key: 'SUPABASE_SERVICE_ROLE_KEY', description: 'Supabase Service Role Key (비밀)' },
    { key: 'ANTHROPIC_API_KEY', description: 'Anthropic Claude API Key' },
  ],
  optional: [
    { key: 'AI_DEFAULT_MODEL', description: 'AI 기본 모델 (기본: claude-sonnet-4)', default: 'claude-sonnet-4-20250514' },
    { key: 'AI_PREMIUM_MODEL', description: 'AI 프리미엄 모델 (기본: claude-opus-4.5)', default: 'claude-opus-4-5-20251101' },
    { key: 'AI_MONTHLY_BUDGET_USD', description: 'AI 월간 예산 (USD)', default: '800' },
    { key: 'CRON_SECRET', description: 'Cron 작업 인증 토큰' },
    { key: 'NEXT_PUBLIC_SENTRY_DSN', description: 'Sentry DSN (에러 모니터링)' },
    { key: 'SMTP_HOST', description: 'SMTP 호스트' },
    { key: 'SMTP_PORT', description: 'SMTP 포트' },
    { key: 'SMTP_USER', description: 'SMTP 사용자' },
    { key: 'SMTP_PASS', description: 'SMTP 비밀번호' },
    { key: 'SMTP_FROM', description: '발신자 이메일' },
  ],
} as const;
