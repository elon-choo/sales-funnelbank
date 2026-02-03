// src/lib/logger.ts
// LMS 구조화된 로깅 시스템

import { env } from './env';

// 로그 레벨
type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// 로그 컨텍스트
interface LogContext {
  userId?: string;
  requestId?: string;
  path?: string;
  method?: string;
  duration?: number;
  statusCode?: number;
  [key: string]: unknown;
}

// 로그 엔트리
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// 로그 레벨 우선순위
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// 현재 로그 레벨 (개발: debug, 프로덕션: info)
const currentLevel: LogLevel = env.isDev ? 'debug' : 'info';

// 로그 포매터
function formatLog(entry: LogEntry): string {
  if (env.isDev) {
    // 개발 환경: 읽기 쉬운 포맷
    const timestamp = new Date(entry.timestamp).toLocaleTimeString();
    const levelEmoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      fatal: '💀',
    }[entry.level];

    let output = `${timestamp} ${levelEmoji} [${entry.level.toUpperCase()}] ${entry.message}`;

    if (entry.context && Object.keys(entry.context).length > 0) {
      output += `\n   Context: ${JSON.stringify(entry.context)}`;
    }

    if (entry.error) {
      output += `\n   Error: ${entry.error.name}: ${entry.error.message}`;
      if (entry.error.stack && env.isDev) {
        output += `\n   ${entry.error.stack.split('\n').slice(1, 4).join('\n   ')}`;
      }
    }

    return output;
  } else {
    // 프로덕션: JSON 포맷 (로그 수집기용)
    return JSON.stringify(entry);
  }
}

// 로그 출력
function log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
  // 레벨 체크
  if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
    return;
  }

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
  };

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  const output = formatLog(entry);

  switch (level) {
    case 'debug':
    case 'info':
      console.log(output);
      break;
    case 'warn':
      console.warn(output);
      break;
    case 'error':
    case 'fatal':
      console.error(output);
      break;
  }

  // Sentry로 에러 전송 (프로덕션)
  if ((level === 'error' || level === 'fatal') && env.isProd && env.sentryDsn) {
    // Sentry 통합 시 여기서 전송
    // Sentry.captureException(error, { extra: context });
  }
}

// Logger 인스턴스 생성
export function createLogger(namespace: string) {
  return {
    debug: (message: string, context?: LogContext) =>
      log('debug', `[${namespace}] ${message}`, context),

    info: (message: string, context?: LogContext) =>
      log('info', `[${namespace}] ${message}`, context),

    warn: (message: string, context?: LogContext) =>
      log('warn', `[${namespace}] ${message}`, context),

    error: (message: string, error?: Error, context?: LogContext) =>
      log('error', `[${namespace}] ${message}`, context, error),

    fatal: (message: string, error?: Error, context?: LogContext) =>
      log('fatal', `[${namespace}] ${message}`, context, error),

    // API 요청 로깅 헬퍼
    apiRequest: (method: string, path: string, context?: Omit<LogContext, 'method' | 'path'>) =>
      log('info', `[${namespace}] ${method} ${path}`, { method, path, ...context }),

    // API 응답 로깅 헬퍼
    apiResponse: (method: string, path: string, statusCode: number, duration: number, context?: LogContext) =>
      log(
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
        `[${namespace}] ${method} ${path} → ${statusCode} (${duration}ms)`,
        { method, path, statusCode, duration, ...context }
      ),

    // 타이머 시작
    time: (label: string) => {
      const start = Date.now();
      return {
        end: (context?: LogContext) => {
          const duration = Date.now() - start;
          log('debug', `[${namespace}] ${label} completed`, { duration, ...context });
          return duration;
        },
      };
    },
  };
}

// 기본 로거 인스턴스
export const logger = createLogger('LMS');

// API 전용 로거
export const apiLogger = createLogger('API');

// AI 전용 로거
export const aiLogger = createLogger('AI');

// Cron 전용 로거
export const cronLogger = createLogger('CRON');

// 미들웨어 로깅 헬퍼
export function withLogging<T extends (...args: unknown[]) => Promise<Response>>(
  handler: T,
  namespace: string
): T {
  const log = createLogger(namespace);

  return (async (...args: unknown[]) => {
    const timer = log.time('request');
    try {
      const response = await handler(...args);
      timer.end({ statusCode: response.status });
      return response;
    } catch (error) {
      log.error('Request failed', error as Error);
      throw error;
    }
  }) as T;
}
