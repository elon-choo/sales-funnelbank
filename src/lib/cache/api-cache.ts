// src/lib/cache/api-cache.ts
// LMS API 응답 캐싱 유틸리티

import { LRUCache } from 'lru-cache';

// 캐시 설정 타입
interface CacheOptions {
  ttl: number;  // milliseconds
  maxSize?: number;
}

// 캐시 값 타입 (object만 허용)
type CacheValue = Record<string, unknown>;

// 기본 캐시 인스턴스 (메모리 기반)
const defaultCache = new LRUCache<string, CacheValue>({
  max: 500,  // 최대 500개 항목
  ttl: 1000 * 60 * 5,  // 기본 5분 TTL
  updateAgeOnGet: true,  // 조회 시 TTL 갱신
});

// 사용자별 캐시 (대시보드 등)
const userCache = new LRUCache<string, CacheValue>({
  max: 1000,  // 최대 1000명 사용자
  ttl: 1000 * 60 * 2,  // 2분 TTL (자주 변경되는 데이터)
});

// 글로벌 캐시 (기수 목록 등)
const globalCache = new LRUCache<string, CacheValue>({
  max: 100,
  ttl: 1000 * 60 * 10,  // 10분 TTL (드물게 변경)
});

// 캐시 키 생성
export function createCacheKey(prefix: string, params: Record<string, string | null | undefined>): string {
  const sortedParams = Object.entries(params)
    .filter(([, v]) => v != null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  return `${prefix}:${sortedParams || 'default'}`;
}

// 캐시 래퍼 함수
export async function withCache<T extends CacheValue>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions & { type?: 'default' | 'user' | 'global' } = { ttl: 1000 * 60 * 5 }
): Promise<{ data: T; cached: boolean }> {
  const cache = options.type === 'user'
    ? userCache
    : options.type === 'global'
      ? globalCache
      : defaultCache;

  // 캐시 히트 확인
  const cached = cache.get(key) as T | undefined;
  if (cached !== undefined) {
    return { data: cached, cached: true };
  }

  // 캐시 미스 - 데이터 조회
  const data = await fetcher();

  // 캐시 저장
  cache.set(key, data, { ttl: options.ttl });

  return { data, cached: false };
}

// 캐시 무효화
export function invalidateCache(pattern: string | RegExp, type: 'default' | 'user' | 'global' = 'default'): void {
  const cache = type === 'user'
    ? userCache
    : type === 'global'
      ? globalCache
      : defaultCache;

  const keysToDelete: string[] = [];

  for (const key of cache.keys()) {
    if (typeof pattern === 'string') {
      if (key.startsWith(pattern)) {
        keysToDelete.push(key);
      }
    } else {
      if (pattern.test(key)) {
        keysToDelete.push(key);
      }
    }
  }

  keysToDelete.forEach(key => cache.delete(key));
}

// 특정 사용자 캐시 무효화
export function invalidateUserCache(userId: string): void {
  invalidateCache(`user:${userId}`, 'user');
}

// 기수 관련 캐시 무효화
export function invalidateCourseCache(courseId?: string): void {
  if (courseId) {
    invalidateCache(`course:${courseId}`, 'global');
  } else {
    invalidateCache('course:', 'global');
  }
  invalidateCache('courses:', 'global');
}

// 캐시 통계
export function getCacheStats(): {
  default: { size: number; maxSize: number };
  user: { size: number; maxSize: number };
  global: { size: number; maxSize: number };
} {
  return {
    default: { size: defaultCache.size, maxSize: defaultCache.max },
    user: { size: userCache.size, maxSize: userCache.max },
    global: { size: globalCache.size, maxSize: globalCache.max },
  };
}

// HTTP 캐시 헤더 생성
export function createCacheHeaders(options: {
  maxAge?: number;  // seconds
  staleWhileRevalidate?: number;  // seconds
  private?: boolean;
  mustRevalidate?: boolean;
}): Record<string, string> {
  const directives: string[] = [];

  if (options.private) {
    directives.push('private');
  } else {
    directives.push('public');
  }

  if (options.maxAge !== undefined) {
    directives.push(`max-age=${options.maxAge}`);
  }

  if (options.staleWhileRevalidate !== undefined) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  if (options.mustRevalidate) {
    directives.push('must-revalidate');
  }

  return {
    'Cache-Control': directives.join(', '),
  };
}

// API 응답에 캐시 헤더 추가 (기본 설정)
export const CACHE_PROFILES = {
  // 대시보드 - 짧은 캐시, stale-while-revalidate
  dashboard: createCacheHeaders({
    maxAge: 30,
    staleWhileRevalidate: 60,
    private: true,
  }),

  // 기수 목록 - 중간 캐시
  courses: createCacheHeaders({
    maxAge: 60,
    staleWhileRevalidate: 300,
    private: false,
  }),

  // 주차 목록 - 중간 캐시
  weeks: createCacheHeaders({
    maxAge: 60,
    staleWhileRevalidate: 300,
    private: false,
  }),

  // 과제 목록 - 짧은 캐시 (사용자별)
  assignments: createCacheHeaders({
    maxAge: 30,
    staleWhileRevalidate: 60,
    private: true,
  }),

  // 피드백 - 중간 캐시 (변경 드묾)
  feedbacks: createCacheHeaders({
    maxAge: 120,
    staleWhileRevalidate: 300,
    private: true,
  }),

  // 작업 상태 - 캐시 없음 (실시간)
  jobs: createCacheHeaders({
    maxAge: 0,
    mustRevalidate: true,
    private: true,
  }),

  // RAG 데이터 - 긴 캐시
  rag: createCacheHeaders({
    maxAge: 300,
    staleWhileRevalidate: 600,
    private: false,
  }),

  // 정적 설정 - 매우 긴 캐시
  static: createCacheHeaders({
    maxAge: 3600,
    staleWhileRevalidate: 86400,
    private: false,
  }),
} as const;
