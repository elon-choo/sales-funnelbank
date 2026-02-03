// e2e/lms-student.spec.ts
// LMS 학생 기능 E2E 테스트

import { test, expect } from '@playwright/test';

test.describe('LMS Student Dashboard', () => {
  // 테스트 전 로그인 필요 시 사용
  test.beforeEach(async ({ page }) => {
    // 테스트 환경에서는 모킹 또는 테스트 계정 사용
    await page.goto('/lms/dashboard');
  });

  test('should display student dashboard', async ({ page }) => {
    // 페이지 로드 확인
    await expect(page).toHaveURL(/.*lms\/dashboard/);

    // 대시보드 제목 확인
    await expect(page.locator('h1')).toContainText(/대시보드|Dashboard/i);
  });

  test('should show enrollment statistics', async ({ page }) => {
    // 통계 카드 확인
    const statsSection = page.locator('[data-testid="stats-section"]');

    // 또는 텍스트로 확인
    await expect(page.getByText(/수강 기수|등록된 강좌/i)).toBeVisible();
  });

  test('should navigate to assignments page', async ({ page }) => {
    // 과제 메뉴 클릭
    await page.click('text=내 과제');

    // URL 변경 확인
    await expect(page).toHaveURL(/.*lms\/assignments/);
  });

  test('should navigate to feedbacks page', async ({ page }) => {
    // 피드백 메뉴 클릭
    await page.click('text=AI 피드백');

    // URL 변경 확인
    await expect(page).toHaveURL(/.*lms\/feedbacks/);
  });

  test('should navigate to weeks progress page', async ({ page }) => {
    // 주차별 진도 메뉴 클릭
    await page.click('text=주차별 진도');

    // URL 변경 확인
    await expect(page).toHaveURL(/.*lms\/weeks/);
  });
});

test.describe('LMS Student Assignments', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lms/assignments');
  });

  test('should display assignments list', async ({ page }) => {
    // 과제 목록 페이지 확인
    await expect(page.locator('h1')).toContainText(/과제|Assignment/i);
  });

  test('should have filter options', async ({ page }) => {
    // 상태 필터 확인
    await expect(page.getByRole('button', { name: /전체|All/i })).toBeVisible();
  });

  test('should show empty state when no assignments', async ({ page }) => {
    // 과제가 없을 때 안내 메시지 확인
    const emptyState = page.locator('[data-testid="empty-state"]');
    const assignmentCard = page.locator('[data-testid="assignment-card"]');

    // 둘 중 하나는 보여야 함
    await expect(emptyState.or(assignmentCard).first()).toBeVisible();
  });
});

test.describe('LMS Student Feedbacks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lms/feedbacks');
  });

  test('should display feedbacks list', async ({ page }) => {
    // 피드백 목록 페이지 확인
    await expect(page.locator('h1')).toContainText(/피드백|Feedback/i);
  });

  test('should show score distribution if feedbacks exist', async ({ page }) => {
    // 피드백이 있을 경우 점수 분포 차트 확인
    const scoreChart = page.locator('[data-testid="score-chart"]');
    const emptyState = page.locator('[data-testid="empty-state"]');

    // 둘 중 하나는 보여야 함
    await expect(scoreChart.or(emptyState).first()).toBeVisible();
  });
});

test.describe('LMS Student Weeks Progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/lms/weeks');
  });

  test('should display weeks progress page', async ({ page }) => {
    // 주차별 진도 페이지 확인
    await expect(page.locator('h1')).toContainText(/주차|Week|진도/i);
  });

  test('should show progress percentage', async ({ page }) => {
    // 진도율 표시 확인
    await expect(page.getByText(/%/)).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('should have working sidebar navigation', async ({ page }) => {
    await page.goto('/lms/dashboard');

    // 사이드바 존재 확인
    const sidebar = page.locator('nav, aside, [role="navigation"]');
    await expect(sidebar.first()).toBeVisible();
  });

  test('should highlight current page in navigation', async ({ page }) => {
    await page.goto('/lms/dashboard');

    // 현재 페이지 하이라이트 확인 (active 클래스 또는 aria-current)
    const activeLink = page.locator('[aria-current="page"], .active, [data-active="true"]');
    await expect(activeLink.first()).toBeVisible();
  });
});

test.describe('Responsive Design', () => {
  test('should be mobile responsive', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/lms/dashboard');

    // 페이지가 정상적으로 렌더링되는지 확인
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should be tablet responsive', async ({ page }) => {
    // 태블릿 뷰포트 설정
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/lms/dashboard');

    // 페이지가 정상적으로 렌더링되는지 확인
    await expect(page.locator('h1')).toBeVisible();
  });
});
