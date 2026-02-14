// src/lib/auth/guards.ts

import 'server-only';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCustomJWT } from '@/lib/auth/tokens';
import type { AuthResult, UserTier, UserRole } from '@/types/auth';

// 하드코딩된 어드민 ID (login/me route와 동일)
const HARDCODED_ADMIN_ID = '2413c0d5-726c-4063-8225-68d318c8b447';

/**
 * API Route에서 인증 확인
 * - Supabase Auth Token 직접 검증
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

    // 하드코딩 어드민 토큰 체크 (백업용)
    if (token === 'HARDCODED_ADMIN_TOKEN') {
        return {
            userId: HARDCODED_ADMIN_ID,
            email: 'admin@magneticsales.com',
            tier: 'ENTERPRISE' as UserTier,
            role: 'admin' as UserRole,
            isApproved: true,
        };
    }

    try {
        // 1. 자체 발급 JWT 검증 시도 (빠름)
        const customPayload = await verifyCustomJWT(token);
        if (customPayload) {
            // 하드코딩된 어드민 ID인 경우
            if (customPayload.sub === HARDCODED_ADMIN_ID) {
                return {
                    userId: HARDCODED_ADMIN_ID,
                    email: customPayload.email,
                    tier: 'ENTERPRISE' as UserTier,
                    role: 'admin' as UserRole,
                    isApproved: true,
                };
            }

            // 일반 사용자: JWT에서 정보 추출 + DB 검증
            const adminClient = createAdminClient();
            const { data: profile } = await adminClient
                .from('profiles')
                .select('tier, role, is_approved, deleted_at')
                .eq('id', customPayload.sub)
                .single();

            if (!profile || profile.deleted_at || !profile.is_approved) {
                return null;
            }

            return {
                userId: customPayload.sub,
                email: customPayload.email,
                tier: profile.tier as UserTier,
                role: (profile.role || 'user') as UserRole,
                isApproved: profile.is_approved,
            };
        }

        // 2. Supabase Auth 토큰 검증 (Supabase가 발급한 토큰인 경우)
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                },
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error('Supabase auth error:', authError?.message);
            return null;
        }

        // 하드코딩된 어드민인 경우 DB 조회 스킵
        if (user.id === HARDCODED_ADMIN_ID) {
            return {
                userId: user.id,
                email: user.email || '',
                tier: 'ENTERPRISE' as UserTier,
                role: 'admin' as UserRole,
                isApproved: true,
            };
        }

        // 일반 사용자: 프로필 조회 (deleted_at, is_approved 확인)
        const adminClient = createAdminClient();
        const { data: profile } = await adminClient
            .from('profiles')
            .select('tier, role, is_approved, deleted_at')
            .eq('id', user.id)
            .single();

        // 삭제되었거나 미승인 사용자
        if (!profile || profile.deleted_at || !profile.is_approved) {
            return null;
        }

        return {
            userId: user.id,
            email: user.email || '',
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
