// src/lib/supabase/config.ts

/**
 * Supabase 및 Cookie 설정 상수
 * 환경별로 다른 설정 적용
 */

// 환경 확인
const isProduction = process.env.NODE_ENV === 'production';
const isDevelopment = process.env.NODE_ENV === 'development';

// Supabase URL (클라이언트/서버 공용)
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Cookie 설정
export const COOKIE_CONFIG = {
    REFRESH_TOKEN_NAME: 'refresh_token',

    // HttpOnly Cookie 옵션
    options: {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict' as const,
        path: '/api/auth',
        // 프로덕션에서만 도메인 설정 (서브도메인 공유용)
        ...(isProduction && process.env.COOKIE_DOMAIN && {
            domain: process.env.COOKIE_DOMAIN,
        }),
    },

    // 만료 시간 (초)
    maxAge: {
        REFRESH_TOKEN: 7 * 24 * 60 * 60, // 7일
    },
} as const;

// 토큰 만료 시간 (밀리초)
export const TOKEN_EXPIRY = {
    ACCESS_TOKEN: 24 * 60 * 60 * 1000,  // 24시간
    REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7일
    REFRESH_BUFFER: 60 * 1000,         // 1분 (만료 전 갱신 버퍼)
} as const;

// 환경변수 검증 (앱 시작 시 실행)
export function validateAuthEnv(): void {
    const required = [
        'NEXT_PUBLIC_SUPABASE_URL',
        'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_JWT_SECRET',
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(
            `Missing required environment variables: ${missing.join(', ')}\n` +
            'Please check your .env.local file.'
        );
    }

    // JWT Secret 길이 검증
    const jwtSecret = process.env.SUPABASE_JWT_SECRET!;
    if (jwtSecret.length < 32) {
        throw new Error(
            'SUPABASE_JWT_SECRET must be at least 32 characters long. ' +
            'Get it from Supabase Dashboard > Settings > API > JWT Secret'
        );
    }

    // Service Role Key가 NEXT_PUBLIC_로 시작하지 않는지 확인
    if (process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
        console.error(
            'CRITICAL: SUPABASE_SERVICE_ROLE_KEY should NOT have NEXT_PUBLIC_ prefix! ' +
            'This exposes your admin key to the client.'
        );
    }
}
