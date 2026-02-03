# PRD: 기술 스택

## 1. 개요

이 문서는 마그네틱 세일즈 웹앱의 기술 스택 선정 근거와 구체적인 버전, 설정 방법을 정의합니다.

## 2. 의존성

- 이 문서 작성 전 필요: `01_PRD_개요.md`
- 이 문서 작성 후 진행: `03_PRD_프로젝트구조.md`

---

## 3. 프론트엔드 스택

### 3.1 Next.js 14

#### 선정 근거
| 기준 | 평가 |
|------|------|
| SSR/SSG 지원 | App Router로 유연한 렌더링 전략 |
| API Routes | 별도 서버 없이 백엔드 구현 |
| Edge Functions | 글로벌 저지연 응답 |
| Vercel 최적화 | 원클릭 배포, 자동 최적화 |
| 커뮤니티 | 활발한 생태계, 풍부한 문서 |

#### 버전 및 설치

```bash
# 프로젝트 생성
npx create-next-app@14.2.0 magnetic-sales-webapp \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir \
  --import-alias "@/*"
```

#### next.config.js 설정

```typescript
// next.config.js
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 엄격 모드
  reactStrictMode: true,

  // 타입스크립트 빌드 에러 시 배포 중단
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint 빌드 에러 시 배포 중단
  eslint: {
    ignoreDuringBuilds: false,
  },

  // 이미지 최적화
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // 보안 헤더
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },

  // 리다이렉트
  async redirects() {
    return [
      {
        source: '/admin',
        destination: '/admin/dashboard',
        permanent: true,
      },
    ];
  },

  // 환경변수 노출
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
};

export default nextConfig;
```

### 3.2 TypeScript 5

#### 선정 근거
- 타입 안전성으로 런타임 에러 방지
- IDE 자동완성 및 리팩토링 지원
- 대규모 코드베이스 유지보수성

#### tsconfig.json 설정

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "strictNullChecks": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"],
      "@/components/*": ["./src/components/*"],
      "@/lib/*": ["./src/lib/*"],
      "@/hooks/*": ["./src/hooks/*"],
      "@/types/*": ["./src/types/*"],
      "@/styles/*": ["./src/styles/*"]
    },
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

### 3.3 Tailwind CSS 3

#### 선정 근거
| 기준 | 평가 |
|------|------|
| 개발 속도 | 유틸리티 클래스로 빠른 스타일링 |
| 번들 크기 | PurgeCSS로 미사용 CSS 제거 |
| 일관성 | 디자인 시스템 내장 |
| 반응형 | 모바일 퍼스트 설계 용이 |

#### tailwind.config.ts 설정

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 브랜드 컬러
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          950: '#082f49',
        },
        secondary: {
          50: '#fdf4ff',
          100: '#fae8ff',
          200: '#f5d0fe',
          300: '#f0abfc',
          400: '#e879f9',
          500: '#d946ef',
          600: '#c026d3',
          700: '#a21caf',
          800: '#86198f',
          900: '#701a75',
          950: '#4a044e',
        },
        // 시맨틱 컬러
        success: '#22c55e',
        warning: '#f59e0b',
        error: '#ef4444',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['var(--font-pretendard)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.75rem' }],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};

export default config;
```

### 3.4 상태 관리 (Zustand)

#### 선정 근거
| 기준 | Zustand | Redux | Jotai |
|------|---------|-------|-------|
| 보일러플레이트 | 매우 적음 | 많음 | 적음 |
| 학습 곡선 | 낮음 | 높음 | 중간 |
| 번들 크기 | 1.1KB | 4.7KB | 2.4KB |
| TypeScript | 우수 | 우수 | 우수 |

#### 설치 및 스토어 템플릿

```bash
npm install zustand@4.5.0
```

```typescript
// src/stores/auth-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  fullName: string;
  tier: 'FREE' | 'PRO' | 'ENTERPRISE';
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Actions
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setAccessToken: (accessToken) =>
        set({ accessToken }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        // accessToken은 메모리에만 (persist 제외)
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
```

### 3.5 폼 관리 (React Hook Form + Zod)

#### 설치

```bash
npm install react-hook-form@7.50.0 zod@3.22.0 @hookform/resolvers@3.3.0
```

#### 사용 예시

```typescript
// src/lib/validations/auth.ts
import { z } from 'zod';

export const signupSchema = z.object({
  email: z
    .string()
    .min(1, '이메일을 입력해주세요')
    .email('유효한 이메일 형식이 아닙니다'),
  password: z
    .string()
    .min(8, '비밀번호는 8자 이상이어야 합니다')
    .max(128, '비밀번호가 너무 깁니다')
    .regex(/[a-zA-Z]/, '영문을 포함해야 합니다')
    .regex(/[0-9]/, '숫자를 포함해야 합니다'),
  fullName: z
    .string()
    .min(2, '이름은 2자 이상이어야 합니다')
    .max(50, '이름이 너무 깁니다'),
  agreeTerms: z.literal(true, {
    errorMap: () => ({ message: '서비스 이용약관에 동의해주세요' }),
  }),
  agreePrivacy: z.literal(true, {
    errorMap: () => ({ message: '개인정보 처리방침에 동의해주세요' }),
  }),
  agreeMarketing: z.boolean().optional(),
});

export type SignupFormData = z.infer<typeof signupSchema>;
```

```typescript
// src/components/forms/signup-form.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupFormData } from '@/lib/validations/auth';

export function SignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      agreeTerms: false,
      agreePrivacy: false,
      agreeMarketing: false,
    },
  });

  const onSubmit = async (data: SignupFormData) => {
    // API 호출
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      {/* 폼 필드 */}
    </form>
  );
}
```

---

## 4. 백엔드 스택

### 4.1 Supabase

#### 선정 근거
| 기준 | 평가 |
|------|------|
| Auth | JWT 기반 인증 내장 |
| PostgreSQL | 풀매니지드 + RLS |
| Real-time | WebSocket 구독 지원 |
| Storage | 파일 업로드 내장 |
| Edge Functions | 서버리스 함수 |
| 비용 | 무료 티어 충분 |

#### 클라이언트 설정

```bash
npm install @supabase/supabase-js@2.39.0 @supabase/ssr@0.1.0
```

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

```typescript
// src/lib/supabase/server.ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/supabase';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Server Component에서는 무시
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // Server Component에서는 무시
          }
        },
      },
    }
  );
}
```

```typescript
// src/lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

// Service Role Key - 서버 사이드 전용!
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

### 4.2 Claude API (Anthropic)

#### 설치 및 설정

```bash
npm install @anthropic-ai/sdk@0.17.0
```

```typescript
// src/lib/ai/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export const AI_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  maxTokens: 8192,
  temperature: 0.7,
  topP: 0.9,
} as const;

export async function generateWithClaude(
  systemPrompt: string,
  userPrompt: string,
  options?: Partial<typeof AI_CONFIG>
) {
  const config = { ...AI_CONFIG, ...options };

  const response = await anthropic.messages.create({
    model: config.model,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    top_p: config.topP,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  });

  return {
    content: response.content[0].type === 'text' ? response.content[0].text : '',
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
```

---

## 5. 개발 도구

### 5.1 ESLint + Prettier

#### ESLint 설정

```javascript
// .eslintrc.cjs
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    'next/core-web-vitals',
    'next/typescript',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'prettier',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint'],
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-floating-promises': 'error',

    // React
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Import 정렬
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling'],
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    // 일반
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prefer-const': 'error',
    'no-var': 'error',
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    '*.config.js',
    '*.config.mjs',
  ],
};
```

#### Prettier 설정

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 80,
  "useTabs": false,
  "bracketSpacing": true,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

### 5.2 Husky + lint-staged

```bash
npm install -D husky lint-staged
npx husky init
```

```json
// package.json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

```bash
# .husky/pre-commit
npx lint-staged
```

---

## 6. 인프라

### 6.1 Vercel

#### 선정 근거
| 기준 | 평가 |
|------|------|
| Next.js 최적화 | 자동 최적화, Edge Runtime |
| 배포 속도 | 푸시 후 ~30초 |
| 글로벌 CDN | 전세계 Edge 노드 |
| 환경변수 | 안전한 시크릿 관리 |
| 프리뷰 배포 | PR별 자동 배포 |

#### vercel.json 설정

```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm ci",
  "regions": ["icn1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 60
    },
    "src/app/api/ai/**/*.ts": {
      "maxDuration": 120
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "no-store"
        }
      ]
    }
  ]
}
```

### 6.2 환경변수

```bash
# .env.local (개발용)

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development

# CORS (프로덕션)
ADDITIONAL_CORS_ORIGINS=

# 보안 알림
SECURITY_ALERT_WEBHOOK=
```

---

## 7. 패키지 전체 목록

### 7.1 package.json

```json
{
  "name": "magnetic-sales-webapp",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "format": "prettier --write .",
    "type-check": "tsc --noEmit",
    "test": "vitest",
    "test:coverage": "vitest --coverage",
    "db:generate": "supabase gen types typescript --project-id xxx > src/types/supabase.ts",
    "prepare": "husky"
  },
  "dependencies": {
    "next": "14.2.0",
    "react": "18.2.0",
    "react-dom": "18.2.0",
    "@supabase/supabase-js": "2.39.0",
    "@supabase/ssr": "0.1.0",
    "@anthropic-ai/sdk": "0.17.0",
    "zustand": "4.5.0",
    "react-hook-form": "7.50.0",
    "@hookform/resolvers": "3.3.0",
    "zod": "3.22.0",
    "dompurify": "3.0.8",
    "clsx": "2.1.0",
    "tailwind-merge": "2.2.0"
  },
  "devDependencies": {
    "typescript": "5.3.0",
    "@types/node": "20.11.0",
    "@types/react": "18.2.0",
    "@types/react-dom": "18.2.0",
    "@types/dompurify": "3.0.5",
    "tailwindcss": "3.4.0",
    "postcss": "8.4.33",
    "autoprefixer": "10.4.17",
    "@tailwindcss/forms": "0.5.7",
    "@tailwindcss/typography": "0.5.10",
    "eslint": "8.56.0",
    "eslint-config-next": "14.2.0",
    "@typescript-eslint/eslint-plugin": "6.19.0",
    "@typescript-eslint/parser": "6.19.0",
    "eslint-config-prettier": "9.1.0",
    "prettier": "3.2.0",
    "prettier-plugin-tailwindcss": "0.5.11",
    "husky": "9.0.0",
    "lint-staged": "15.2.0",
    "vitest": "1.2.0",
    "@vitest/coverage-v8": "1.2.0",
    "@testing-library/react": "14.1.0",
    "@testing-library/jest-dom": "6.3.0",
    "supabase": "1.142.0"
  }
}
```

---

## 8. 체크리스트

### 8.1 환경 설정
- [ ] Node.js 20.x 설치
- [ ] 프로젝트 생성 (`create-next-app`)
- [ ] TypeScript 설정 (`tsconfig.json`)
- [ ] Tailwind CSS 설정 (`tailwind.config.ts`)
- [ ] ESLint/Prettier 설정
- [ ] Husky 설정

### 8.2 의존성 설치
- [ ] Supabase SDK 설치
- [ ] Anthropic SDK 설치
- [ ] Zustand 설치
- [ ] React Hook Form + Zod 설치
- [ ] DOMPurify 설치

### 8.3 환경변수
- [ ] `.env.local` 생성
- [ ] Supabase 키 설정
- [ ] Anthropic 키 설정
- [ ] Vercel 환경변수 등록

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2025-01-15 | 초기 작성 | CTO |
