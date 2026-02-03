// playwright.config.ts
// E2E 테스트 설정

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // 테스트 디렉토리
  testDir: './e2e',

  // 테스트 파일 패턴
  testMatch: '**/*.spec.ts',

  // 완전 병렬 실행
  fullyParallel: true,

  // CI에서는 재시도 하지 않음
  forbidOnly: !!process.env.CI,

  // 재시도 횟수
  retries: process.env.CI ? 2 : 0,

  // 워커 수
  workers: process.env.CI ? 1 : undefined,

  // 리포터 설정
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  // 공통 설정
  use: {
    // 기본 URL
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',

    // 트레이스 수집 (실패 시)
    trace: 'on-first-retry',

    // 스크린샷 (실패 시)
    screenshot: 'only-on-failure',

    // 비디오 (실패 시)
    video: 'on-first-retry',

    // 타임아웃
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  // 프로젝트 (브라우저별)
  projects: [
    // 데스크톱 Chrome
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // 데스크톱 Firefox
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // 데스크톱 Safari
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // 모바일 Chrome
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },

    // 모바일 Safari
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // 개발 서버 자동 시작
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // 출력 디렉토리
  outputDir: 'test-results/',

  // 전역 타임아웃
  timeout: 60000,

  // 예상 타임아웃
  expect: {
    timeout: 5000,
  },
});
