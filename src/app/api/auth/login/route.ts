
// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateAccessToken } from '@/lib/auth/tokens';
import { COOKIE_CONFIG, TOKEN_EXPIRY } from '@/lib/supabase/config';
import { LoginRequest, UserTier } from '@/types/auth';
import { generateSecureToken } from '@/lib/security/crypto';

// 하드코딩된 어드민 계정 (테스트용 - 나중에 Supabase RLS 수정 후 제거)
const HARDCODED_ADMIN = {
    email: 'admin@magneticsales.com',
    password: 'Admin123!',
    id: '00000000-0000-0000-0000-000000000001',
    fullName: 'Admin',
    tier: 'enterprise' as UserTier,
    role: 'admin' as const,
    isApproved: true,
    createdAt: new Date().toISOString()
};

export async function POST(request: NextRequest) {
    try {
        let body: LoginRequest;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_000', message: '잘못된 요청 형식입니다.' } },
                { status: 400 }
            );
        }
        const { email, password } = body;

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_001', message: '이메일과 비밀번호를 입력해주세요.' } },
                { status: 400 }
            );
        }

        // 하드코딩된 어드민 계정 체크
        if (email === HARDCODED_ADMIN.email && password === HARDCODED_ADMIN.password) {
            // Access Token 생성
            const accessToken = await generateAccessToken({
                userId: HARDCODED_ADMIN.id,
                email: HARDCODED_ADMIN.email,
                tier: HARDCODED_ADMIN.tier,
                role: HARDCODED_ADMIN.role
            });

            // 하드코딩된 어드민용 Refresh Token 생성 (prefix로 구분)
            const refreshToken = 'HARDCODED_ADMIN_' + generateSecureToken(64);

            const response = NextResponse.json({
                success: true,
                data: {
                    accessToken,
                    expiresIn: TOKEN_EXPIRY.ACCESS_TOKEN,
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

            response.cookies.set(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, {
                ...COOKIE_CONFIG.options,
                maxAge: COOKIE_CONFIG.maxAge.REFRESH_TOKEN,
            });

            return response;
        }

        // 다른 계정은 인증 실패
        return NextResponse.json(
            { success: false, error: { code: 'AUTH_002', message: '이메일 또는 비밀번호가 일치하지 않습니다.' } },
            { status: 401 }
        );

    } catch (error) {
        console.error('Login error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: { code: 'AUTH_999', message: '서버 오류가 발생했습니다.', debug: errorMessage } },
            { status: 500 }
        );
    }
}
