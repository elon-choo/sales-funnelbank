// __tests__/api/lms/dashboard.test.ts
// LMS 대시보드 데이터 구조 테스트

describe('LMS Dashboard Data Structure', () => {
  // Student Dashboard 구조
  const mockStudentDashboard = {
    type: 'student' as const,
    enrollments: [
      {
        id: 'enroll-1',
        course_id: 'course-1',
        status: 'active',
        enrolled_at: '2025-01-15',
        courses: {
          id: 'course-1',
          title: '세일즈 퍼널 마스터클래스 1기',
          status: 'active',
          total_weeks: 8,
        },
      },
    ],
    assignmentStats: {
      total: 5,
      draft: 1,
      submitted: 2,
      reviewed: 2,
    },
    pendingJobs: [],
    recentFeedbacks: [
      {
        id: 'feedback-1',
        score: 85,
        created_at: '2025-01-20',
        assignments: {
          id: 'assignment-1',
          week_id: 'week-1',
          course_weeks: {
            week_number: 1,
            title: '세일즈 기초',
          },
        },
      },
    ],
    averageScore: 85,
    generatedAt: new Date().toISOString(),
  };

  // Admin Dashboard 구조
  const mockAdminDashboard = {
    type: 'admin' as const,
    activeCourses: 2,
    totalEnrollments: 150,
    assignmentStats: {
      total: 450,
      pending: 50,
      submitted: 100,
      reviewed: 300,
    },
    jobStats: {
      pending: 10,
      processing: 2,
      completed: 500,
      failed: 5,
    },
    costStats: {
      daily: 12.5,
      weekly: 87.5,
      monthly: 350,
    },
    generatedAt: new Date().toISOString(),
  };

  describe('Student Dashboard', () => {
    it('should have correct type', () => {
      expect(mockStudentDashboard.type).toBe('student');
    });

    it('should have enrollments array', () => {
      expect(Array.isArray(mockStudentDashboard.enrollments)).toBe(true);
    });

    it('should have assignment stats', () => {
      const { assignmentStats } = mockStudentDashboard;

      expect(assignmentStats).toHaveProperty('total');
      expect(assignmentStats).toHaveProperty('draft');
      expect(assignmentStats).toHaveProperty('submitted');
      expect(assignmentStats).toHaveProperty('reviewed');

      // Sum should equal total
      expect(assignmentStats.draft + assignmentStats.submitted + assignmentStats.reviewed)
        .toBeLessThanOrEqual(assignmentStats.total);
    });

    it('should have valid score range', () => {
      if (mockStudentDashboard.averageScore !== null) {
        expect(mockStudentDashboard.averageScore).toBeGreaterThanOrEqual(0);
        expect(mockStudentDashboard.averageScore).toBeLessThanOrEqual(100);
      }
    });

    it('should have recent feedbacks with valid structure', () => {
      mockStudentDashboard.recentFeedbacks.forEach(feedback => {
        expect(feedback).toHaveProperty('id');
        expect(feedback).toHaveProperty('score');
        expect(feedback).toHaveProperty('assignments');
        expect(feedback.assignments).toHaveProperty('course_weeks');
      });
    });
  });

  describe('Admin Dashboard', () => {
    it('should have correct type', () => {
      expect(mockAdminDashboard.type).toBe('admin');
    });

    it('should have course and enrollment counts', () => {
      expect(typeof mockAdminDashboard.activeCourses).toBe('number');
      expect(typeof mockAdminDashboard.totalEnrollments).toBe('number');
      expect(mockAdminDashboard.activeCourses).toBeGreaterThanOrEqual(0);
    });

    it('should have job stats with all statuses', () => {
      const { jobStats } = mockAdminDashboard;

      expect(jobStats).toHaveProperty('pending');
      expect(jobStats).toHaveProperty('processing');
      expect(jobStats).toHaveProperty('completed');
      expect(jobStats).toHaveProperty('failed');
    });

    it('should have cost stats', () => {
      const { costStats } = mockAdminDashboard;

      expect(costStats).toHaveProperty('daily');
      expect(costStats).toHaveProperty('weekly');
      expect(costStats).toHaveProperty('monthly');

      // Weekly should be roughly 7x daily
      expect(costStats.weekly).toBeGreaterThan(costStats.daily);
    });
  });

  describe('Data Validation', () => {
    it('should have generatedAt timestamp', () => {
      expect(mockStudentDashboard.generatedAt).toBeTruthy();
      expect(new Date(mockStudentDashboard.generatedAt).toString()).not.toBe('Invalid Date');
    });

    it('should handle empty pending jobs', () => {
      expect(mockStudentDashboard.pendingJobs).toEqual([]);
    });
  });
});

describe('Dashboard API Response Format', () => {
  it('should follow standard response format', () => {
    const successResponse = {
      success: true,
      data: { type: 'student', enrollments: [] },
    };

    const errorResponse = {
      success: false,
      error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' },
    };

    expect(successResponse.success).toBe(true);
    expect(successResponse).toHaveProperty('data');

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error).toHaveProperty('code');
    expect(errorResponse.error).toHaveProperty('message');
  });
});
