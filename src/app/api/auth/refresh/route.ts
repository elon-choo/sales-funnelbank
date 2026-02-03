
// src/app/api/auth/refresh/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { rotateRefreshToken } from '@/lib/auth/rotation';
import { generateAccessToken } from '@/lib/auth/tokens';
import { COOKIE_CONFIG, TOKEN_EXPIRY } from '@/lib/supabase/config';
import { UserTier } from '@/types/auth';

export async function POST(request: NextRequest) {
    try {
        const refreshToken = request.cookies.get(COOKIE_CONFIG.REFRESH_TOKEN_NAME)?.value;

        if (!refreshToken) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_003', message: '세션이 만료되었습니다. (No Token)' } },
                { status: 401 }
            );
        }

        // Refresh Token Rotation
        const result = await rotateRefreshToken(refreshToken);

        if (!result.success || !result.userId) {
            // Rotation 실패 (재사용 감지, 만료 등) -> 쿠키 삭제 및 에러 반환
            const response = NextResponse.json(
                { success: false, error: { code: 'AUTH_006', message: '세션이 유효하지 않습니다.', detail: result.error } },
                { status: 401 }
            );
            response.cookies.delete(COOKIE_CONFIG.REFRESH_TOKEN_NAME);
            return response;
        }

        const supabase = createAdminClient();

        // 사용자 정보 로드
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', result.userId).single();

        if (!profile || !profile.is_approved || profile.deleted_at) {
            const response = NextResponse.json(
                { success: false, error: { code: 'AUTH_004', message: '유효하지 않은 계정입니다.' } },
                { status: 403 }
            );
            response.cookies.delete(COOKIE_CONFIG.REFRESH_TOKEN_NAME);
            return response;
        }

        // 새 Access Token 발급
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
                expiresIn: TOKEN_EXPIRY.ACCESS_TOKEN,
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

        // 새 Refresh Token 쿠키 설정
        if (result.newRefreshToken) {
            response.cookies.set(COOKIE_CONFIG.REFRESH_TOKEN_NAME, result.newRefreshToken, {
                ...COOKIE_CONFIG.options,
                maxAge: COOKIE_CONFIG.maxAge.REFRESH_TOKEN,
            });
        }

        return response;

    } catch (error) {
        console.error('Refresh error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'AUTH_999', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
