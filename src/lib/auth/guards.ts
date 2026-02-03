// src/lib/auth/guards.ts

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAccessToken } from '@/lib/auth/tokens';
import type { AuthResult, UserTier, UserRole } from '@/types/auth';

// 하드코딩된 어드민 ID (login/me route와 동일)
const HARDCODED_ADMIN_ID = '00000000-0000-0000-0000-000000000001';

/**
 * API Route에서 인증 확인
 * - 커스텀 JWT Bearer Token 검증 (jose)
 * - 하드코딩된 어드민은 DB 조회 스킵
 * - 일반 사용자는 프로필 조회 (승인, 삭제 상태 확인)
 */
export async function authenticateRequest(
    request: NextRequest
): Promise<AuthResult | null> {
    const authHeader = request.headers.get('authorization');

    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);

    try {
        // 커스텀 JWT 토큰 검증 (jose 라이브러리)
        const payload = await verifyAccessToken(token);

        if (!payload || !payload.sub) {
            return null;
        }

        // 하드코딩된 어드민인 경우 DB 조회 스킵
        if (payload.sub === HARDCODED_ADMIN_ID) {
            return {
                userId: payload.sub,
                email: payload.email,
                tier: payload.tier as UserTier,
                role: payload.role as UserRole,
                isApproved: true,
            };
        }

        // 일반 사용자: 프로필 조회 (deleted_at, is_approved 확인)
        const supabase = createAdminClient();
        const { data: profile } = await supabase
            .from('profiles')
            .select('tier, role, is_approved, deleted_at')
            .eq('id', payload.sub)
            .single();

        // 삭제되었거나 미승인 사용자
        if (!profile || profile.deleted_at || !profile.is_approved) {
            return null;
        }

        return {
            userId: payload.sub,
            email: payload.email,
            tier: profile.tier as UserTier,
            role: (profile.role || 'user') as UserRole,
            isApproved: profile.is_approved,
        };
    } catch (error) {
        console.error('Authentication error:', error);
        return null;
    }
}

/**
 * 인증 필수 API Route Wrapper
 * - 통일된 시그니처: (request, auth) => Promise<NextResponse>
 */
export function withAuth(
    handler: (
        request: NextRequest,
        auth: AuthResult
    ) => Promise<NextResponse>
) {
    return async (request: NextRequest): Promise<NextResponse> => {
        const auth = await authenticateRequest(request);

        if (!auth) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'AUTH_003',
                        message: '세션이 만료되었습니다. 다시 로그인해주세요.',
                    },
                },
                { status: 401 }
            );
        }

        return handler(request, auth);
    };
}

/**
 * Admin 전용 API Route Wrapper
 * - ENTERPRISE 티어만 접근 가능
 */
export function withAdminAuth(
    handler: (
        request: NextRequest,
        auth: AuthResult
    ) => Promise<NextResponse>
) {
    return async (request: NextRequest): Promise<NextResponse> => {
        const auth = await authenticateRequest(request);

        if (!auth) {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'AUTH_003',
                        message: '세션이 만료되었습니다. 다시 로그인해주세요.',
                    },
                },
                { status: 401 }
            );
        }

        // Admin 권한 확인
        if (auth.tier !== 'ENTERPRISE') {
            return NextResponse.json(
                {
                    success: false,
                    error: {
                        code: 'AUTH_007',
                        message: '관리자 권한이 필요합니다.',
                    },
                },
                { status: 403 }
            );
        }

        return handler(request, auth);
    };
}
