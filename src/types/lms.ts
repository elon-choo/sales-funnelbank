// src/types/lms.ts
// 세퍼마 LMS 타입 정의

import type { UserTier, UserRole } from './auth';

// LMS 역할 타입
export type LmsRole = 'student' | 'admin';

// LMS 사용자 인터페이스 (확장)
export interface LmsUser {
  id: string;
  email: string;
  fullName: string;
  tier: UserTier;
  role: UserRole;
  lmsRole: LmsRole;
  isApproved: boolean;
  createdAt: string;
}

// 기수 상태
export type CourseStatus = 'draft' | 'active' | 'completed';

// 과제 타입
export type AssignmentType = 'plan' | 'funnel' | 'free';

// 과제 상태
export type AssignmentStatus = 'draft' | 'submitted' | 'processing' | 'feedback_ready';

// 수강 상태
export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'dropped';

// 피드백 상태
export type FeedbackStatus = 'generated' | 'approved' | 'sent' | 'rejected';

// 피드백 작업 상태
export type FeedbackJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// 기수 정보
export interface Course {
  id: string;
  title: string;
  description?: string;
  status: CourseStatus;
  totalWeeks: number;
  startDate?: string;
  endDate?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// 주차 정보
export interface CourseWeek {
  id: string;
  courseId: string;
  weekNumber: number;
  title: string;
  assignmentType: AssignmentType;
  deadline?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 주차별 과제 설정
export interface WeekAssignmentConfig {
  id: string;
  weekId: string;
  fieldKey: string;
  fieldLabel: string;
  fieldType: 'textarea' | 'file' | 'text';
  placeholder?: string;
  helpText?: string;
  isRequired: boolean;
  sortOrder: number;
}

// 수강 등록 정보
export interface CourseEnrollment {
  id: string;
  userId: string;
  courseId: string;
  status: EnrollmentStatus;
  emailOptOut: boolean;
  enrolledAt: string;
  completedAt?: string;
}

// 과제 제출
export interface Assignment {
  id: string;
  userId: string;
  courseId: string;
  weekId: string;
  content: Record<string, unknown>;
  version: number;
  status: AssignmentStatus;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// 과제 첨부파일
export interface AssignmentFile {
  id: string;
  assignmentId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  extractedText?: string;
  createdAt: string;
}

// AI 피드백
export interface Feedback {
  id: string;
  assignmentId: string;
  userId: string;
  courseId: string;
  weekId: string;
  content: string;
  summary?: string;
  scores?: Record<string, number>;
  version: number;
  assignmentVersion: number;
  status: FeedbackStatus;
  tokensInput?: number;
  tokensOutput?: number;
  generationTimeMs?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  createdAt: string;
  updatedAt: string;
}

// 피드백 작업
export interface FeedbackJob {
  id: string;
  assignmentId: string;
  status: FeedbackJobStatus;
  workerType: 'cron' | 'edge';
  attempts: number;
  maxAttempts: number;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

// LMS 대시보드 통계
export interface LmsDashboardStats {
  totalCourses: number;
  activeCourses: number;
  totalAssignments: number;
  submittedAssignments: number;
  pendingFeedbacks: number;
  completedFeedbacks: number;
}

// 학생 대시보드 데이터
export interface StudentDashboard {
  enrolledCourses: CourseEnrollment[];
  currentWeek?: CourseWeek;
  recentAssignments: Assignment[];
  recentFeedbacks: Feedback[];
  progress: {
    totalWeeks: number;
    completedWeeks: number;
    submissionRate: number;
  };
}

// 관리자 대시보드 데이터
export interface AdminDashboard {
  courseStats: {
    totalEnrollments: number;
    activeEnrollments: number;
    totalAssignments: number;
    totalFeedbacks: number;
    pendingJobs: number;
    processingJobs: number;
    completedJobs: number;
    failedJobs: number;
  };
  recentActivity: {
    recentSubmissions: Assignment[];
    recentFeedbacks: Feedback[];
    failedJobs: FeedbackJob[];
  };
  aiCostSummary: {
    dailyCost: number;
    monthlyCost: number;
    dailyLimit: number;
    monthlyLimit: number;
  };
}

// API 응답 타입
export interface LmsApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
