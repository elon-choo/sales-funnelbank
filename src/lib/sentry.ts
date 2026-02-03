// src/lib/sentry.ts
// Sentry 에러 모니터링 설정
// 설치: npm install @sentry/nextjs

/*
 * Sentry 설정 가이드
 * ===================
 *
 * 1. Sentry 계정 생성: https://sentry.io
 * 2. 프로젝트 생성 (Next.js 선택)
 * 3. DSN 복사 후 환경변수 설정:
 *    NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
 *    SENTRY_ORG=your-org
 *    SENTRY_PROJECT=your-project
 *    SENTRY_AUTH_TOKEN=your-auth-token
 *
 * 4. 패키지 설치:
 *    npm install @sentry/nextjs
 *
 * 5. 루트에 sentry.client.config.ts, sentry.server.config.ts 생성
 *    npx @sentry/wizard@latest -i nextjs
 *
 * 6. next.config.ts에 Sentry 플러그인 추가
 */

import { env } from './env';

// Sentry 초기화 상태
let isInitialized = false;

// 에러 컨텍스트 타입
export interface ErrorContext {
  userId?: string;
  email?: string;
  role?: string;
  courseId?: string;
  assignmentId?: string;
  path?: string;
  action?: string;
  extra?: Record<string, unknown>;
}

// Sentry 초기화 (클라이언트/서버 공통)
export function initSentry(): boolean {
  if (isInitialized) return true;

  if (!env.sentryDsn) {
    if (env.isDev) {
      console.log('ℹ️ Sentry DSN이 설정되지 않음 - 에러 모니터링 비활성화');
    }
    return false;
  }

  // Sentry SDK가 설치되어 있을 때만 초기화
  try {
    // @sentry/nextjs 패키지 필요
    // import * as Sentry from '@sentry/nextjs';
    // Sentry.init({
    //   dsn: env.sentryDsn,
    //   environment: env.isProd ? 'production' : 'development',
    //   tracesSampleRate: env.isProd ? 0.1 : 1.0,
    //   beforeSend(event) {
    //     // 개인정보 필터링
    //     if (event.user?.email) {
    //       event.user.email = event.user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    //     }
    //     return event;
    //   },
    // });
    isInitialized = true;
    return true;
  } catch {
    console.warn('⚠️ Sentry SDK를 찾을 수 없음 - npm install @sentry/nextjs 필요');
    return false;
  }
}

// 에러 캡처 (Sentry 없이도 동작)
export function captureError(error: Error, context?: ErrorContext): void {
  // 콘솔에 항상 출력
  console.error('[Error Captured]', {
    name: error.name,
    message: error.message,
    context,
    stack: env.isDev ? error.stack : undefined,
  });

  // Sentry로 전송 (설정된 경우)
  if (isInitialized) {
    // Sentry.captureException(error, {
    //   user: context?.userId ? { id: context.userId, email: context.email } : undefined,
    //   tags: {
    //     role: context?.role,
    //     action: context?.action,
    //   },
    //   extra: {
    //     courseId: context?.courseId,
    //     assignmentId: context?.assignmentId,
    //     path: context?.path,
    //     ...context?.extra,
    //   },
    // });
  }
}

// 메시지 캡처
export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
  console.log(`[${level.toUpperCase()}]`, message, context);

  if (isInitialized) {
    // Sentry.captureMessage(message, {
    //   level,
    //   extra: context,
    // });
  }
}

// 사용자 컨텍스트 설정
export function setUser(user: { id: string; email?: string; role?: string }): void {
  if (isInitialized) {
    // Sentry.setUser({
    //   id: user.id,
    //   email: user.email,
    //   role: user.role,
    // });
  }
}

// 사용자 컨텍스트 초기화
export function clearUser(): void {
  if (isInitialized) {
    // Sentry.setUser(null);
  }
}

// 태그 설정
export function setTag(key: string, value: string): void {
  if (isInitialized) {
    // Sentry.setTag(key, value);
  }
}

// 브레드크럼 추가 (디버깅용 이벤트 추적)
export function addBreadcrumb(category: string, message: string, data?: Record<string, unknown>): void {
  if (isInitialized) {
    // Sentry.addBreadcrumb({
    //   category,
    //   message,
    //   data,
    //   level: 'info',
    // });
  }
}

// 성능 트랜잭션 시작
export function startTransaction(name: string, op: string) {
  if (isInitialized) {
    // return Sentry.startSpan({ name, op });
  }
  return null;
}

// React Error Boundary 헬퍼
export function reportReactError(error: Error, errorInfo: { componentStack: string }): void {
  captureError(error, {
    extra: {
      componentStack: errorInfo.componentStack,
    },
  });
}

// API 에러 핸들러
export function handleApiError(error: unknown, context: ErrorContext): Error {
  const err = error instanceof Error ? error : new Error(String(error));
  captureError(err, context);
  return err;
}

// Sentry 설정 문서
export const SENTRY_SETUP_GUIDE = `
# Sentry 설정 가이드

## 1. Sentry 계정 및 프로젝트 생성
- https://sentry.io 에서 계정 생성
- 새 프로젝트 생성 (Platform: Next.js)

## 2. 환경변수 설정 (.env.local)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=your-project-slug
SENTRY_AUTH_TOKEN=sntrys_xxx (Settings > Auth Tokens에서 생성)

## 3. 패키지 설치
npm install @sentry/nextjs

## 4. Sentry Wizard 실행
npx @sentry/wizard@latest -i nextjs

## 5. 설정 파일 확인
- sentry.client.config.ts (클라이언트 설정)
- sentry.server.config.ts (서버 설정)
- sentry.edge.config.ts (Edge Runtime 설정)
- next.config.ts에 withSentryConfig 적용

## 6. 소스맵 업로드 (선택)
- 빌드 시 자동으로 소스맵 업로드
- 디버깅 편의성 향상

## 7. 테스트
- 의도적으로 에러 발생시켜 Sentry에 기록되는지 확인
`;
