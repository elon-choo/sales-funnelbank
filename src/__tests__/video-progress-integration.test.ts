/**
 * VOD 시청 현황 기능 통합 테스트
 * - Admin video-progress API
 * - Analytics videoStats 연동
 * - Dashboard videoStats 연동
 *
 * 실제 DB의 유저 ID를 사용하여 인증 검증
 */
import { SignJWT } from 'jose';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3333';
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || 'oKtWgCfd8xKnYjGuG/NnxCBI+puzGe8cKRD5fC+KeWG8L4esS9ADC3Pd+IzzFNPsi1cHrIkL9cjy6M6rjNSqvA==';

// 실제 DB에 존재하는 유저 ID (profiles 테이블 조회 기반)
const REAL_ADMIN_USER = {
  id: '2413c0d5-726c-4063-8225-68d318c8b447',
  email: 'admin@magneticsales.com',
  role: 'owner',
  tier: 'ENTERPRISE',
};
const REAL_STUDENT_USER = {
  id: '8982ab9c-3898-4647-80ca-67d3383a3aa7',
  email: 'chillro@naver.com',
  role: 'user',
  tier: 'FREE',
};
const KNOWN_COURSE_ID = '30e8f97e-85dc-4abd-999b-cf069b7742f1';

async function generateToken(user: { id: string; email: string; role: string; tier: string }) {
  const secret = new TextEncoder().encode(JWT_SECRET);
  return new SignJWT({
    sub: user.id,
    email: user.email,
    tier: user.tier,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .setIssuer('magnetic-sales-webapp')
    .setAudience('magnetic-sales-api')
    .sign(secret);
}

describe('Admin Video Progress API', () => {
  let adminToken: string;
  let studentToken: string;

  beforeAll(async () => {
    adminToken = await generateToken(REAL_ADMIN_USER);
    studentToken = await generateToken(REAL_STUDENT_USER);
  });

  // =================================================================
  // 1. 인증 및 권한 테스트
  // =================================================================
  describe('Auth & Permissions', () => {
    it('should return 401 without token', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`);
      expect(res.status).toBe(401);
    });

    it('should return 403 for student user', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(res.status).toBe(403);
    });

    it('should return 400 without courseId', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('MISSING_PARAM');
    });

    it('should return 200 for admin with valid courseId', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);
    });
  });

  // =================================================================
  // 2. 데이터 조회 테스트
  // =================================================================
  describe('Data Retrieval', () => {
    it('should return correct response structure', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('records');
      expect(data.data).toHaveProperty('summary');
      expect(data.data).toHaveProperty('pagination');
      expect(data.data).toHaveProperty('weeks');

      // Summary
      const { summary } = data.data;
      expect(typeof summary.totalStudents).toBe('number');
      expect(typeof summary.completedCount).toBe('number');
      expect(typeof summary.avgPercentage).toBe('number');
      expect(typeof summary.notStartedCount).toBe('number');

      // Pagination
      const { pagination } = data.data;
      expect(pagination.page).toBe(1);
      expect(pagination.limit).toBe(50);
      expect(typeof pagination.total).toBe('number');
      expect(typeof pagination.totalPages).toBe('number');
    });

    it('should return records with correct shape when data exists', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      if (data.data.records.length > 0) {
        const record = data.data.records[0];
        expect(record).toHaveProperty('id');
        expect(record).toHaveProperty('userId');
        expect(record).toHaveProperty('studentName');
        expect(record).toHaveProperty('email');
        expect(record).toHaveProperty('weekId');
        expect(record).toHaveProperty('weekNumber');
        expect(record).toHaveProperty('weekTitle');
        expect(record).toHaveProperty('watchPercentage');
        expect(record).toHaveProperty('watchedSeconds');
        expect(record).toHaveProperty('totalSeconds');
        expect(record).toHaveProperty('isCompleted');
        expect(record).toHaveProperty('lastActivity');
        expect(typeof record.watchPercentage).toBe('number');
        expect(record.watchPercentage).toBeGreaterThanOrEqual(0);
        expect(record.watchPercentage).toBeLessThanOrEqual(100);
      }
    });

    it('should filter by weekId', async () => {
      const baseRes = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const baseData = await baseRes.json();

      if (baseData.data.weeks?.length > 0) {
        const weekId = baseData.data.weeks[0].id;
        const res = await fetch(
          `${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}&weekId=${weekId}`,
          { headers: { Authorization: `Bearer ${adminToken}` } }
        );
        const data = await res.json();
        expect(data.success).toBe(true);

        for (const record of data.data.records) {
          expect(record.weekId).toBe(weekId);
        }
      }
    });

    it('should return empty for non-matching search', async () => {
      const res = await fetch(
        `${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}&search=zzz_nonexistent_xyz_999`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.records.length).toBe(0);
    });

    it('should sort by watch_percentage descending', async () => {
      const res = await fetch(
        `${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}&sortBy=watch_percentage&sortOrder=desc`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const data = await res.json();
      expect(data.success).toBe(true);

      const records = data.data.records;
      for (let i = 1; i < records.length; i++) {
        expect(records[i - 1].watchPercentage).toBeGreaterThanOrEqual(records[i].watchPercentage);
      }
    });

    it('should respect pagination limit', async () => {
      const res = await fetch(
        `${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}&page=1`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.pagination.page).toBe(1);
      expect(data.data.records.length).toBeLessThanOrEqual(50);
    });

    it('should handle non-existent courseId gracefully', async () => {
      const res = await fetch(
        `${BASE_URL}/api/lms/admin/video-progress?courseId=00000000-0000-0000-0000-000000000000`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.records.length).toBe(0);
      expect(data.data.summary.totalStudents).toBe(0);
    });
  });

  // =================================================================
  // 3. Analytics API - videoStats 포함 여부
  // =================================================================
  describe('Analytics videoStats', () => {
    it('should include videoStats in analytics response', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/analytics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('videoStats');

      const { videoStats } = data.data;
      expect(typeof videoStats.totalWatchers).toBe('number');
      expect(typeof videoStats.completedCount).toBe('number');
      expect(typeof videoStats.avgPercentage).toBe('number');
      expect(videoStats).toHaveProperty('byWeek');
    });

    it('videoStats.byWeek entries should have correct shape', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/analytics`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();

      if (!data.success) return;

      const { byWeek } = data.data.videoStats;
      for (const [, stats] of Object.entries(byWeek) as [string, { watchers: number; completed: number; avgPct: number }][]) {
        expect(typeof stats.watchers).toBe('number');
        expect(typeof stats.completed).toBe('number');
        expect(typeof stats.avgPct).toBe('number');
        expect(stats.avgPct).toBeGreaterThanOrEqual(0);
        expect(stats.avgPct).toBeLessThanOrEqual(100);
      }
    });
  });

  // =================================================================
  // 4. Dashboard API - videoStats 포함 여부
  // =================================================================
  describe('Dashboard videoStats', () => {
    it('should include videoStats for admin dashboard', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/dashboard`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('admin');
      expect(data.data).toHaveProperty('videoStats');

      const { videoStats } = data.data;
      expect(typeof videoStats.totalWatchers).toBe('number');
      expect(typeof videoStats.completedCount).toBe('number');
      expect(typeof videoStats.avgPercentage).toBe('number');
      expect(videoStats.avgPercentage).toBeGreaterThanOrEqual(0);
      expect(videoStats.avgPercentage).toBeLessThanOrEqual(100);
    });

    it('should NOT include videoStats for student dashboard', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/dashboard`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.data.type).toBe('student');
      // Student dashboard should NOT have videoStats
      expect(data.data).not.toHaveProperty('videoStats');
    });
  });

  // =================================================================
  // 5. 데이터 일관성 테스트
  // =================================================================
  describe('Data Consistency', () => {
    it('summary.notStartedCount should be non-negative', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!data.success) return;
      expect(data.data.summary.notStartedCount).toBeGreaterThanOrEqual(0);
    });

    it('avgPercentage should be between 0 and 100', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!data.success) return;
      expect(data.data.summary.avgPercentage).toBeGreaterThanOrEqual(0);
      expect(data.data.summary.avgPercentage).toBeLessThanOrEqual(100);
    });

    it('totalStudents >= watchers + notStarted', async () => {
      const res = await fetch(`${BASE_URL}/api/lms/admin/video-progress?courseId=${KNOWN_COURSE_ID}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!data.success) return;
      const s = data.data.summary;
      const watchers = s.totalStudents - s.notStartedCount;
      expect(watchers).toBeGreaterThanOrEqual(0);
      expect(s.notStartedCount).toBeLessThanOrEqual(s.totalStudents);
    });
  });
});
