
// src/app/api/auth/me/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateAccessToken } from '@/lib/auth/tokens';
import { rotateRefreshToken } from '@/lib/auth/rotation';
import { COOKIE_CONFIG, TOKEN_EXPIRY } from '@/lib/supabase/config';
import { UserTier } from '@/types/auth';

// 하드코딩된 어드민 계정 (login route와 동일)
const HARDCODED_ADMIN = {
    email: 'admin@magneticsales.com',
    id: '00000000-0000-0000-0000-000000000001',
    fullName: 'Admin',
    tier: 'enterprise' as UserTier,
    role: 'admin' as const,
    isApproved: true,
    createdAt: new Date().toISOString()
};

const HARDCODED_ADMIN_TOKEN_PREFIX = 'HARDCODED_ADMIN_';

/**
 * 세션 복구/정보 조회용 API
 * - 쿠키의 Refresh Token을 사용하여 새로운 Access Token과 유저 정보를 반환
 * - rotateRefreshToken 호출로 토큰 자동 갱신 (보안 강화)
 */
export async function GET(request: NextRequest) {
    try {
        const refreshToken = request.cookies.get(COOKIE_CONFIG.REFRESH_TOKEN_NAME)?.value;

        if (!refreshToken) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_003', message: '로그인이 필요합니다.' } },
                { status: 401 }
            );
        }

        // 하드코딩된 어드민 토큰 체크
        if (refreshToken.startsWith(HARDCODED_ADMIN_TOKEN_PREFIX)) {
            const newAccessToken = await generateAccessToken({
                userId: HARDCODED_ADMIN.id,
                email: HARDCODED_ADMIN.email,
                tier: HARDCODED_ADMIN.tier,
                role: HARDCODED_ADMIN.role
            });

            return NextResponse.json({
                success: true,
                data: {
                    accessToken: newAccessToken,
                    user: {
                        id: HARDCODED_ADMIN.id,
                        email: HARDCODED_ADMIN.email,
                        fullName: HARDCODED_ADMIN.fullName,
                        tier: HARDCODED_ADMIN.tier,
                        role: HARDCODED_ADMIN.role,
                        isApproved: HARDCODED_ADMIN.isApproved,
                        createdAt: HARDCODED_ADMIN.createdAt
                    }
                }
            });
        }

        // 일반 사용자: Refresh Token 검증 및 Rotation
        const result = await rotateRefreshToken(refreshToken);

        if (!result.success || !result.userId) {
            const response = NextResponse.json(
                { success: false, error: { code: 'AUTH_006', message: '세션이 만료되었습니다.' } },
                { status: 401 }
            );
            response.cookies.delete(COOKIE_CONFIG.REFRESH_TOKEN_NAME);
            return response;
        }

        const supabase = createAdminClient();
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', result.userId).single();

        if (!profile || !profile.is_approved || profile.deleted_at) {
            const response = NextResponse.json(
                { success: false, error: { code: 'AUTH_004', message: '유효하지 않은 계정입니다.' } },
                { status: 403 }
            );
            response.cookies.delete(COOKIE_CONFIG.REFRESH_TOKEN_NAME);
            return response;
        }

        // Access Token 발급
        const newAccessToken = await generateAccessToken({
            userId: profile.id,
            email: profile.email,
            tier: profile.tier as UserTier,
            role: profile.role || 'user'
        });

        const response = NextResponse.json({
            success: true,
            data: {
                accessToken: newAccessToken,
                user: {
                    id: profile.id,
                    email: profile.email,
                    fullName: profile.full_name,
                    tier: profile.tier,
                    role: profile.role || 'user',
                    isApproved: profile.is_approved,
                    createdAt: profile.created_at
                }
            }
        });

        if (result.newRefreshToken) {
            response.cookies.set(COOKIE_CONFIG.REFRESH_TOKEN_NAME, result.newRefreshToken, {
                ...COOKIE_CONFIG.options,
                maxAge: COOKIE_CONFIG.maxAge.REFRESH_TOKEN,
            });
        }

        return response;

    } catch (error) {
        console.error('Session check error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'AUTH_999', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
