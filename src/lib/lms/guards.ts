// src/lib/lms/guards.ts
// 세퍼마 LMS 전용 인증 가드 (CTO-001 방안B: API 레벨 권한 검증)

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAccessToken } from '@/lib/auth/tokens';
import type { AuthResult, UserTier } from '@/types/auth';
import type { SupabaseClient } from '@supabase/supabase-js';

// LMS 역할 타입
export type LmsRole = 'student' | 'admin';

// LMS 인증 결과 (AuthResult 확장)
export interface LmsAuthResult extends AuthResult {
  lmsRole: LmsRole;
}

// 에러 코드 (T16 API 명세서 기준)
const LMS_ERRORS = {
  AUTH_REQUIRED: {
    code: 'LMS_001',
    message: '로그인이 필요합니다.',
    status: 401,
  },
  SESSION_EXPIRED: {
    code: 'LMS_002',
    message: '세션이 만료되었습니다. 다시 로그인해주세요.',
    status: 401,
  },
  FORBIDDEN: {
    code: 'LMS_003',
    message: '접근 권한이 없습니다.',
    status: 403,
  },
  LMS_ADMIN_REQUIRED: {
    code: 'LMS_004',
    message: 'LMS 관리자 권한이 필요합니다.',
    status: 403,
  },
  NOT_ENROLLED: {
    code: 'LMS_101',
    message: '해당 기수에 등록되어 있지 않습니다.',
    status: 403,
  },
};

/**
 * LMS 인증 요청 처리
 * - 커스텀 JWT 검증
 * - profiles.lms_role 조회
 */
async function authenticateLmsRequest(
  request: NextRequest
): Promise<LmsAuthResult | null> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const payload = await verifyAccessToken(token);

    if (!payload || !payload.sub) {
      return null;
    }

    // 프로필 조회 (lms_role 컬럼 없으면 기본값 사용)
    const supabase = createAdminClient();
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('tier, role, is_approved, deleted_at')
      .eq('id', payload.sub)
      .single();

    if (profileError) {
      console.error('[LMS Auth] Profile query error:', profileError.message);
      return null;
    }

    if (!profile || profile.deleted_at || !profile.is_approved) {
      return null;
    }

    // lms_role은 role 또는 tier 기반으로 결정 (lms_role 컬럼이 없을 경우)
    const lmsRole: LmsRole = (profile.role === 'admin' || profile.tier === 'ENTERPRISE') ? 'admin' : 'student';

    return {
      userId: payload.sub,
      email: payload.email,
      tier: profile.tier as UserTier,
      role: profile.role || 'user',
      isApproved: profile.is_approved,
      lmsRole,
    };
  } catch (error) {
    console.error('[LMS Auth Error]', error);
    return null;
  }
}

// Handler 타입 정의
type LmsAuthHandler = (
  auth: LmsAuthResult,
  supabase: SupabaseClient
) => Promise<NextResponse>;

type LmsEnrollmentHandler = (
  auth: LmsAuthResult,
  supabase: SupabaseClient,
  enrollment: EnrollmentInfo
) => Promise<NextResponse>;

/**
 * LMS 인증 필수 API Route Wrapper
 * - 기본 인증만 확인 (학생/관리자 모두 접근 가능)
 * - handler에 auth와 supabase client 전달
 */
export async function withLmsAuth(
  request: NextRequest,
  handler: LmsAuthHandler
): Promise<NextResponse> {
  const auth = await authenticateLmsRequest(request);

  if (!auth) {
    return NextResponse.json(
      {
        success: false,
        error: LMS_ERRORS.SESSION_EXPIRED,
      },
      { status: LMS_ERRORS.SESSION_EXPIRED.status }
    );
  }

  // Admin 클라이언트 사용 (Bearer 토큰 인증에서는 쿠키 세션 없음)
  const supabase = createAdminClient();
  return handler(auth, supabase);
}

/**
 * LMS 관리자 전용 API Route Wrapper
 * - lmsRole === 'admin' 또는 tier === 'ENTERPRISE' 필요
 * - handler에 auth와 supabase client 전달
 */
export async function withLmsAdminAuth(
  request: NextRequest,
  handler: LmsAuthHandler
): Promise<NextResponse> {
  const auth = await authenticateLmsRequest(request);

  if (!auth) {
    return NextResponse.json(
      {
        success: false,
        error: LMS_ERRORS.SESSION_EXPIRED,
      },
      { status: LMS_ERRORS.SESSION_EXPIRED.status }
    );
  }

  // LMS Admin 권한 확인 (lms_role='admin' 또는 ENTERPRISE 티어)
  if (auth.lmsRole !== 'admin' && auth.tier !== 'ENTERPRISE') {
    return NextResponse.json(
      {
        success: false,
        error: LMS_ERRORS.LMS_ADMIN_REQUIRED,
      },
      { status: LMS_ERRORS.LMS_ADMIN_REQUIRED.status }
    );
  }

  // Admin 클라이언트 사용 (Bearer 토큰 인증에서는 쿠키 세션 없음)
  const supabase = createAdminClient();
  return handler(auth, supabase);
}

/**
 * LMS 수강생 등록 확인 API Route Wrapper
 * - courseId 파라미터에 대한 수강 등록 여부 확인
 * - 관리자는 모든 기수 접근 가능
 */
export interface EnrollmentInfo {
  courseId: string;
  enrollmentId: string;
  status: 'active' | 'completed' | 'dropped';
  max_submissions_per_week?: number;
}

export async function withEnrollmentAuth(
  request: NextRequest,
  courseId: string,
  handler: LmsEnrollmentHandler
): Promise<NextResponse> {
  const auth = await authenticateLmsRequest(request);

  if (!auth) {
    return NextResponse.json(
      {
        success: false,
        error: LMS_ERRORS.SESSION_EXPIRED,
      },
      { status: LMS_ERRORS.SESSION_EXPIRED.status }
    );
  }

  // Admin 클라이언트 사용 (Bearer 토큰 인증에서는 쿠키 세션 없음)
  const supabase = createAdminClient();

  // 관리자는 모든 기수 접근 가능
  if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
    return handler(auth, supabase, {
      courseId,
      enrollmentId: 'admin-access',
      status: 'active',
    });
  }

  // 수강생: 등록 여부 확인 (CTO-001 방안B: API 레벨 권한 검증)
  const { data: enrollment } = await supabase
    .from('course_enrollments')
    .select('id, status, max_submissions_per_week')
    .eq('course_id', courseId)
    .eq('user_id', auth.userId)  // 핵심: API 레벨에서 user_id 필터
    .eq('status', 'active')
    .single();

  if (!enrollment) {
    return NextResponse.json(
      {
        success: false,
        error: LMS_ERRORS.NOT_ENROLLED,
      },
      { status: LMS_ERRORS.NOT_ENROLLED.status }
    );
  }

  return handler(auth, supabase, {
    courseId,
    enrollmentId: enrollment.id,
    status: enrollment.status,
    max_submissions_per_week: enrollment.max_submissions_per_week,
  });
}

/**
 * 과제 소유권 확인 헬퍼
 * - 과제 제출/조회 시 본인 과제인지 확인
 */
export async function verifyAssignmentOwnership(
  assignmentId: string,
  userId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('assignments')
    .select('id')
    .eq('id', assignmentId)
    .eq('user_id', userId)  // API 레벨 권한 검증
    .single();

  return !!data;
}

/**
 * 피드백 접근 권한 확인 헬퍼
 * - 피드백 조회 시 본인 피드백인지 확인
 */
export async function verifyFeedbackAccess(
  feedbackId: string,
  userId: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('feedbacks')
    .select('id, assignments!inner(user_id)')
    .eq('id', feedbackId)
    .eq('assignments.user_id', userId)  // JOIN으로 소유권 확인
    .single();

  return !!data;
}
