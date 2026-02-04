// src/lib/auth/tokens.ts

import 'server-only';

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { TokenPayload, UserTier, UserRole } from '@/types/auth';

// JWT Secret을 Uint8Array로 변환 (jose 요구사항)
function getJWTSecret(): Uint8Array {
    const secret = process.env.SUPABASE_JWT_SECRET;
    if (!secret) {
        throw new Error('SUPABASE_JWT_SECRET is not defined');
    }
    return new TextEncoder().encode(secret);
}

/**
 * Access Token 생성
 * - 15분 만료
 * - HS256 알고리즘
 */
export async function generateAccessToken(payload: {
    userId: string;
    email: string;
    tier: UserTier;
    role: UserRole;
}): Promise<string> {
    const secret = getJWTSecret();

    return new SignJWT({
        sub: payload.userId,
        email: payload.email,
        tier: payload.tier,
        role: payload.role,
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .setIssuer('magnetic-sales-webapp')
        .setAudience('magnetic-sales-api')
        .sign(secret);
}

/**
 * Access Token 검증
 * - Supabase JWT 토큰 검증 (SUPABASE_JWT_SECRET 사용)
 * - 만료, 서명 검증
 */
export async function verifyAccessToken(
    token: string
): Promise<TokenPayload | null> {
    try {
        const secret = getJWTSecret();

        // Supabase 토큰 검증 (issuer/audience 체크 제거 - Supabase 토큰 호환)
        const { payload } = await jwtVerify(token, secret);

        // Supabase 토큰은 sub에 user ID, email은 별도 필드
        return {
            sub: payload.sub as string,
            email: (payload.email as string) || '',
            tier: (payload.tier as UserTier) || 'FREE',
            role: (payload.role as UserRole) || 'user',
            iat: payload.iat as number,
            exp: payload.exp as number,
        };
    } catch (error) {
        // 토큰 만료, 서명 불일치 등
        console.error('Token verification failed:', error);
        return null;
    }
}

/**
 * Supabase Auth Token에서 정보 추출 (검증은 Supabase가 수행)
 */
export function extractTokenInfo(
    supabasePayload: JWTPayload
): Pick<TokenPayload, 'sub' | 'email'> | null {
    if (!supabasePayload.sub || !supabasePayload.email) {
        return null;
    }

    return {
        sub: supabasePayload.sub,
        email: supabasePayload.email as string,
    };
}
