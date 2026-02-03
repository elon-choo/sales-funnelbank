// __tests__/lib/cache/api-cache.test.ts
// API 캐싱 유틸리티 테스트

import {
  createCacheKey,
  withCache,
  invalidateCache,
  getCacheStats,
  createCacheHeaders,
  CACHE_PROFILES,
} from '@/lib/cache/api-cache';

describe('API Cache Utility', () => {
  describe('createCacheKey', () => {
    it('should create consistent cache key with params', () => {
      const key1 = createCacheKey('courses', { status: 'active', limit: '10' });
      const key2 = createCacheKey('courses', { limit: '10', status: 'active' });

      expect(key1).toBe(key2);  // 순서 무관
      expect(key1).toContain('courses:');
      expect(key1).toContain('status=active');
      expect(key1).toContain('limit=10');
    });

    it('should filter out null/undefined params', () => {
      const key = createCacheKey('dashboard', {
        courseId: null,
        userId: 'user-1',
        filter: undefined,
      });

      expect(key).toBe('dashboard:userId=user-1');
      expect(key).not.toContain('null');
      expect(key).not.toContain('undefined');
    });

    it('should return default key when no params', () => {
      const key = createCacheKey('empty', {});
      expect(key).toBe('empty:default');
    });
  });

  describe('withCache', () => {
    it('should cache fetched data', async () => {
      let fetchCount = 0;
      const fetcher = async () => {
        fetchCount++;
        return { id: 'test', name: 'Test Data' };
      };

      // 첫 번째 호출 - 캐시 미스
      const result1 = await withCache('test-key-1', fetcher, { ttl: 5000 });
      expect(result1.cached).toBe(false);
      expect(result1.data).toEqual({ id: 'test', name: 'Test Data' });
      expect(fetchCount).toBe(1);

      // 두 번째 호출 - 캐시 히트
      const result2 = await withCache('test-key-1', fetcher, { ttl: 5000 });
      expect(result2.cached).toBe(true);
      expect(result2.data).toEqual({ id: 'test', name: 'Test Data' });
      expect(fetchCount).toBe(1);  // 여전히 1 (캐시됨)
    });

    it('should use different cache by type', async () => {
      const fetcher = async () => ({ type: 'user-data' });

      await withCache('user-cache-key', fetcher, { ttl: 5000, type: 'user' });
      await withCache('global-cache-key', fetcher, { ttl: 5000, type: 'global' });

      const stats = getCacheStats();
      expect(stats.user.size).toBeGreaterThanOrEqual(1);
      expect(stats.global.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe('invalidateCache', () => {
    it('should invalidate cache by prefix', async () => {
      // 캐시 채우기
      await withCache('course:1', async () => ({ id: '1' }), { ttl: 10000 });
      await withCache('course:2', async () => ({ id: '2' }), { ttl: 10000 });
      await withCache('user:1', async () => ({ id: 'u1' }), { ttl: 10000 });

      // course: 프리픽스 무효화
      invalidateCache('course:');

      // course 캐시는 미스, user 캐시는 히트
      let fetchCalled = false;
      const result1 = await withCache('course:1', async () => {
        fetchCalled = true;
        return { id: '1-new' };
      }, { ttl: 10000 });

      expect(fetchCalled).toBe(true);
      expect(result1.cached).toBe(false);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', () => {
      const stats = getCacheStats();

      expect(stats).toHaveProperty('default');
      expect(stats).toHaveProperty('user');
      expect(stats).toHaveProperty('global');
      expect(stats.default).toHaveProperty('size');
      expect(stats.default).toHaveProperty('maxSize');
    });
  });

  describe('createCacheHeaders', () => {
    it('should create proper Cache-Control header', () => {
      const headers = createCacheHeaders({
        maxAge: 60,
        staleWhileRevalidate: 300,
        private: true,
      });

      expect(headers['Cache-Control']).toContain('private');
      expect(headers['Cache-Control']).toContain('max-age=60');
      expect(headers['Cache-Control']).toContain('stale-while-revalidate=300');
    });

    it('should handle must-revalidate', () => {
      const headers = createCacheHeaders({
        maxAge: 0,
        mustRevalidate: true,
        private: true,
      });

      expect(headers['Cache-Control']).toContain('must-revalidate');
      expect(headers['Cache-Control']).toContain('max-age=0');
    });
  });

  describe('CACHE_PROFILES', () => {
    it('should have all required profiles', () => {
      expect(CACHE_PROFILES).toHaveProperty('dashboard');
      expect(CACHE_PROFILES).toHaveProperty('courses');
      expect(CACHE_PROFILES).toHaveProperty('weeks');
      expect(CACHE_PROFILES).toHaveProperty('assignments');
      expect(CACHE_PROFILES).toHaveProperty('feedbacks');
      expect(CACHE_PROFILES).toHaveProperty('jobs');
      expect(CACHE_PROFILES).toHaveProperty('rag');
      expect(CACHE_PROFILES).toHaveProperty('static');
    });

    it('should have Cache-Control in all profiles', () => {
      Object.values(CACHE_PROFILES).forEach(profile => {
        expect(profile).toHaveProperty('Cache-Control');
      });
    });

    it('jobs profile should have no cache (realtime)', () => {
      expect(CACHE_PROFILES.jobs['Cache-Control']).toContain('max-age=0');
      expect(CACHE_PROFILES.jobs['Cache-Control']).toContain('must-revalidate');
    });
  });
});
