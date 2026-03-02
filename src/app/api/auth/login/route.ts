
// src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { COOKIE_CONFIG } from '@/lib/supabase/config';
import { createRefreshToken } from '@/lib/auth/rotation';
import { generateAccessToken } from '@/lib/auth/tokens';
import { LoginRequest, UserTier } from '@/types/auth';

// In-memory rate limiter (IP 기반, 5회/10분)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10분

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = loginAttempts.get(ip);
    if (!entry || now > entry.resetAt) {
        loginAttempts.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }
    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return false;
    }
    return true;
}

// 오래된 엔트리 정리 (5분마다)
setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of loginAttempts) {
        if (now > entry.resetAt) loginAttempts.delete(key);
    }
}, 5 * 60 * 1000);

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                   request.headers.get('x-real-ip') ||
                   'unknown';
        if (!checkRateLimit(ip)) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_010', message: '로그인 시도가 너무 많습니다. 10분 후 다시 시도해주세요.' } },
                { status: 429 }
            );
        }

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

        // Supabase Auth 로그인
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError || !authData.session) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_002', message: '이메일 또는 비밀번호가 일치하지 않습니다.' } },
                { status: 401 }
            );
        }

        // 프로필 조회 (승인 여부 확인)
        const adminClient = createAdminClient();
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (profileError || !profile) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_003', message: '프로필을 찾을 수 없습니다.' } },
                { status: 404 }
            );
        }

        // 승인 여부 확인
        if (!profile.is_approved) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_004', message: '관리자 승인 대기 중입니다. 승인 후 로그인 가능합니다.' } },
                { status: 403 }
            );
        }

        // 로그인 성공 - 감사 로그
        await adminClient.from('audit_logs').insert({
            user_id: authData.user.id,
            action: 'login',
            severity: 'info',
            details: { email },
        });

        // 자체 토큰 시스템 사용 (Supabase Auth 토큰 대신)
        const accessToken = await generateAccessToken({
            userId: authData.user.id,
            email: authData.user.email!,
            tier: profile.tier as UserTier,
            role: profile.role || 'user',
        });

        // 자체 Refresh Token 생성 (refresh_tokens 테이블에 저장됨)
        const refreshToken = await createRefreshToken(authData.user.id);

        // 응답 생성 (프론트엔드 LoginResponse 타입에 맞춤)
        const response = NextResponse.json({
            success: true,
            data: {
                accessToken: accessToken,
                expiresIn: 86400, // 24시간 (자체 토큰 만료 시간)
                user: {
                    id: authData.user.id,
                    email: authData.user.email,
                    fullName: profile.full_name,
                    tier: profile.tier,
                    role: profile.role,
                    courseType: profile.course_type || 'SALES_FUNNEL',
                    isApproved: profile.is_approved,
                    createdAt: profile.created_at
                }
            }
        });

        // 자체 Refresh Token을 HttpOnly 쿠키로 설정
        response.cookies.set(COOKIE_CONFIG.REFRESH_TOKEN_NAME, refreshToken, {
            ...COOKIE_CONFIG.options,
            maxAge: COOKIE_CONFIG.maxAge.REFRESH_TOKEN,
        });

        return response;

    } catch (error) {
        console.error('Login error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: { code: 'AUTH_999', message: '서버 오류가 발생했습니다.', debug: errorMessage } },
            { status: 500 }
        );
    }
}
