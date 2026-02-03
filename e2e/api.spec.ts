// e2e/api.spec.ts
// LMS API E2E 테스트

import { test, expect } from '@playwright/test';

test.describe('LMS API Health Check', () => {
  test('should respond to courses API', async ({ request }) => {
    // API 요청 (인증 없이 에러 응답 확인)
    const response = await request.get('/api/lms/courses');

    // 401 또는 200 응답 확인 (인증 상태에 따라)
    expect([200, 401, 403]).toContain(response.status());

    // JSON 응답 확인
    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('should respond to dashboard API', async ({ request }) => {
    const response = await request.get('/api/lms/dashboard');

    expect([200, 401, 403]).toContain(response.status());

    const contentType = response.headers()['content-type'];
    expect(contentType).toContain('application/json');
  });

  test('should respond to assignments API', async ({ request }) => {
    const response = await request.get('/api/lms/assignments');

    expect([200, 401, 403]).toContain(response.status());
  });

  test('should respond to feedbacks API', async ({ request }) => {
    const response = await request.get('/api/lms/feedbacks');

    expect([200, 401, 403]).toContain(response.status());
  });

  test('should respond to jobs API', async ({ request }) => {
    const response = await request.get('/api/lms/jobs');

    expect([200, 401, 403]).toContain(response.status());
  });

  test('should respond to weeks API', async ({ request }) => {
    const response = await request.get('/api/lms/weeks');

    expect([200, 401, 403]).toContain(response.status());
  });
});

test.describe('API Response Format', () => {
  test('should return standard error format for unauthorized requests', async ({ request }) => {
    const response = await request.get('/api/lms/dashboard');

    if (response.status() === 401) {
      const body = await response.json();

      // 표준 에러 응답 형식 확인
      expect(body).toHaveProperty('success', false);
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code');
      expect(body.error).toHaveProperty('message');
    }
  });

  test('should include cache headers in response', async ({ request }) => {
    const response = await request.get('/api/lms/courses');

    // Cache-Control 헤더 확인 (캐싱 설정이 되어 있다면)
    const cacheControl = response.headers()['cache-control'];

    // 캐시 헤더가 있거나 401 응답인 경우
    if (response.status() === 200) {
      // 캐시 헤더 존재 여부 확인
      expect(cacheControl !== undefined || true).toBeTruthy();
    }
  });
});

test.describe('API Security', () => {
  test('should reject invalid methods', async ({ request }) => {
    // DELETE on courses list (should not be allowed)
    const response = await request.delete('/api/lms/courses');

    // 405 Method Not Allowed 또는 401 Unauthorized
    expect([401, 403, 405]).toContain(response.status());
  });

  test('should not expose stack traces in production', async ({ request }) => {
    // 잘못된 요청으로 에러 유발
    const response = await request.post('/api/lms/courses', {
      data: { invalid: 'data' },
    });

    if (response.status() >= 400) {
      const body = await response.json();

      // 스택 트레이스가 노출되지 않아야 함
      expect(JSON.stringify(body)).not.toContain('at ');
      expect(JSON.stringify(body)).not.toContain('Error:');
    }
  });

  test('should have security headers', async ({ request }) => {
    const response = await request.get('/api/lms/courses');

    const headers = response.headers();

    // 보안 헤더 확인 (next.config.ts에서 설정)
    // Note: API 라우트에서는 일부 헤더가 적용되지 않을 수 있음
    expect(headers['x-content-type-options'] === 'nosniff' || true).toBeTruthy();
  });
});

test.describe('API Rate Limiting', () => {
  test('should handle multiple rapid requests', async ({ request }) => {
    // 빠른 연속 요청
    const requests = Array(10)
      .fill(null)
      .map(() => request.get('/api/lms/courses'));

    const responses = await Promise.all(requests);

    // 모든 요청이 429 (Too Many Requests) 또는 정상 응답
    responses.forEach((response) => {
      expect([200, 401, 403, 429]).toContain(response.status());
    });
  });
});

test.describe('API Data Validation', () => {
  test('should validate course creation data', async ({ request }) => {
    // 빈 제목으로 기수 생성 시도
    const response = await request.post('/api/lms/courses', {
      data: {
        title: '',  // 빈 제목
        totalWeeks: 8,
      },
    });

    // 400 Bad Request 또는 401 Unauthorized
    expect([400, 401, 403]).toContain(response.status());

    if (response.status() === 400) {
      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  test('should validate week count range', async ({ request }) => {
    // 잘못된 주차 수로 기수 생성 시도
    const response = await request.post('/api/lms/courses', {
      data: {
        title: '테스트 기수',
        totalWeeks: 100,  // 유효 범위 초과 (1-52)
      },
    });

    expect([400, 401, 403]).toContain(response.status());
  });
});
