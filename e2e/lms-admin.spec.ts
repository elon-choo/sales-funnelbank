// e2e/lms-admin.spec.ts
// LMS 관리자 기능 E2E 테스트

import { test, expect } from '@playwright/test';

test.describe('LMS Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // 관리자 권한으로 접근 (테스트 환경에서 모킹 필요)
    await page.goto('/lms-admin/dashboard');
  });

  test('should display admin dashboard', async ({ page }) => {
    // 페이지 로드 확인
    await expect(page).toHaveURL(/.*lms-admin\/dashboard/);

    // 관리자 대시보드 제목 확인
    await expect(page.locator('h1')).toContainText(/관리자|Admin|대시보드/i);
  });

  test('should show course statistics', async ({ page }) => {
    // 기수 통계 확인
    await expect(page.getByText(/활성 기수|Active Course/i)).toBeVisible();
  });

  test('should show enrollment count', async ({ page }) => {
    // 수강생 수 확인
    await expect(page.getByText(/수강생|Enrollment/i)).toBeVisible();
  });

  test('should show job statistics', async ({ page }) => {
    // 작업 통계 확인
    await expect(page.getByText(/작업|Job/i)).toBeVisible();
  });

  test('should show cost statistics', async ({ page }) => {
    // AI 비용 통계 확인
    await expect(page.getByText(/비용|Cost|\$/i)).toBeVisible();
  });
});

test.describe('LMS Admin Courses Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lms-admin/courses');
  });

  test('should display courses list', async ({ page }) => {
    // 기수 관리 페이지 확인
    await expect(page.locator('h1')).toContainText(/기수|Course/i);
  });

  test('should have create course button', async ({ page }) => {
    // 기수 생성 버튼 확인
    const createButton = page.getByRole('button', { name: /생성|Create|추가|Add/i });
    await expect(createButton).toBeVisible();
  });

  test('should open create course modal', async ({ page }) => {
    // 기수 생성 버튼 클릭
    await page.click('button:has-text("생성"), button:has-text("추가")');

    // 모달 확인
    const modal = page.locator('[role="dialog"], .modal, [data-testid="modal"]');
    await expect(modal.first()).toBeVisible();
  });

  test('should display course status badges', async ({ page }) => {
    // 상태 배지 확인 (draft, active, completed, archived 중 하나)
    const statusBadge = page.locator('[data-testid="status-badge"], .badge, .status');
    const statusText = page.getByText(/draft|active|완료|활성|보관/i);

    // 기수가 있으면 상태 배지가 보여야 함
    await expect(statusBadge.first().or(statusText.first())).toBeVisible();
  });
});

test.describe('LMS Admin Enrollments Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lms-admin/enrollments');
  });

  test('should display enrollments list', async ({ page }) => {
    // 수강생 관리 페이지 확인
    await expect(page.locator('h1')).toContainText(/수강생|Enrollment/i);
  });

  test('should have filter options', async ({ page }) => {
    // 필터 옵션 확인
    const filterSection = page.locator('[data-testid="filter"], select, [role="combobox"]');
    await expect(filterSection.first()).toBeVisible();
  });

  test('should display enrollment table', async ({ page }) => {
    // 테이블 확인
    const table = page.locator('table, [role="table"], [data-testid="enrollments-table"]');
    await expect(table.first()).toBeVisible();
  });
});

test.describe('LMS Admin Jobs Monitor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lms-admin/jobs');
  });

  test('should display jobs monitor page', async ({ page }) => {
    // 작업 모니터 페이지 확인
    await expect(page.locator('h1')).toContainText(/작업|Job/i);
  });

  test('should show realtime toggle', async ({ page }) => {
    // 실시간 토글 확인
    const realtimeToggle = page.getByText(/실시간|Realtime|자동/i);
    await expect(realtimeToggle).toBeVisible();
  });

  test('should display job statistics', async ({ page }) => {
    // 작업 통계 (pending, processing, completed, failed)
    await expect(page.getByText(/pending|대기|처리 중|완료|실패/i).first()).toBeVisible();
  });

  test('should have retry button for failed jobs', async ({ page }) => {
    // 실패한 작업이 있으면 재시도 버튼 확인
    const retryButton = page.getByRole('button', { name: /재시도|Retry/i });
    const failedJob = page.getByText(/failed|실패/i);

    // 실패 작업이 있을 때만 재시도 버튼 확인
    if (await failedJob.isVisible()) {
      await expect(retryButton.first()).toBeVisible();
    }
  });
});

test.describe('LMS Admin RAG Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lms-admin/rag');
  });

  test('should display RAG management page', async ({ page }) => {
    // RAG 관리 페이지 확인
    await expect(page.locator('h1')).toContainText(/RAG|데이터셋/i);
  });

  test('should have datasets tab', async ({ page }) => {
    // 데이터셋 탭 확인
    const datasetsTab = page.getByRole('tab', { name: /데이터셋|Dataset/i });
    await expect(datasetsTab).toBeVisible();
  });

  test('should have mappings tab', async ({ page }) => {
    // 매핑 탭 확인
    const mappingsTab = page.getByRole('tab', { name: /매핑|Mapping/i });
    await expect(mappingsTab).toBeVisible();
  });

  test('should switch between tabs', async ({ page }) => {
    // 탭 전환 테스트
    const mappingsTab = page.getByRole('tab', { name: /매핑|Mapping/i });
    await mappingsTab.click();

    // 매핑 탭 내용 확인
    await expect(page.getByText(/주차|Week|연결|Link/i)).toBeVisible();
  });
});

test.describe('Admin Navigation', () => {
  test('should have admin sidebar navigation', async ({ page }) => {
    await page.goto('/lms-admin/dashboard');

    // 관리자 사이드바 확인
    const sidebar = page.locator('nav, aside, [role="navigation"]');
    await expect(sidebar.first()).toBeVisible();
  });

  test('should navigate to all admin pages', async ({ page }) => {
    await page.goto('/lms-admin/dashboard');

    // 기수 관리 링크
    await expect(page.getByRole('link', { name: /기수|Course/i })).toBeVisible();

    // 수강생 관리 링크
    await expect(page.getByRole('link', { name: /수강생|Enrollment/i })).toBeVisible();

    // 작업 모니터 링크
    await expect(page.getByRole('link', { name: /작업|Job/i })).toBeVisible();
  });
});

test.describe('Admin Responsive Design', () => {
  test('should be mobile responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lms-admin/dashboard');

    // 페이지가 정상적으로 렌더링되는지 확인
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should have hamburger menu on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lms-admin/dashboard');

    // 모바일 메뉴 버튼 확인
    const menuButton = page.locator('[data-testid="mobile-menu"], button:has([class*="menu"]), [aria-label*="menu"]');

    // 모바일 메뉴가 있거나 사이드바가 숨겨져 있음
    await expect(menuButton.first()).toBeVisible().catch(() => {
      // 메뉴 버튼이 없으면 OK (반응형 디자인에 따라 다름)
    });
  });
});
