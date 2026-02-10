// src/lib/auth/tokens.ts

import 'server-only';

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { createClient } from '@supabase/supabase-js';
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
 * - 24시간 만료
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
        .setExpirationTime('24h')
        .setIssuer('magnetic-sales-webapp')
        .setAudience('magnetic-sales-api')
        .sign(secret);
}

/**
 * 자체 발급 JWT 검증 (jose 사용)
 */
export async function verifyCustomJWT(
    token: string
): Promise<TokenPayload | null> {
    try {
        const secret = getJWTSecret();
        const { payload } = await jwtVerify(token, secret, {
            issuer: 'magnetic-sales-webapp',
            audience: 'magnetic-sales-api',
        });

        if (!payload.sub || !payload.email) {
            return null;
        }

        return {
            sub: payload.sub,
            email: payload.email as string,
            tier: (payload.tier as UserTier) || 'FREE',
            role: (payload.role as UserRole) || 'user',
            iat: payload.iat || 0,
            exp: payload.exp || 0,
        };
    } catch {
        // 자체 JWT가 아니면 null 반환 (Supabase 토큰일 수 있음)
        return null;
    }
}

/**
 * Access Token 검증
 * - 1. 자체 발급 JWT 먼저 검증 (빠름)
 * - 2. 실패 시 Supabase Auth getUser() 시도
 */
export async function verifyAccessToken(
    token: string
): Promise<TokenPayload | null> {
    // 1. 자체 발급 JWT 검증 시도
    const customPayload = await verifyCustomJWT(token);
    if (customPayload) {
        return customPayload;
    }

    // 2. Supabase Auth 토큰 검증
    try {
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

        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.error('Supabase token verification failed:', error?.message);
            return null;
        }

        return {
            sub: user.id,
            email: user.email || '',
            tier: 'FREE' as UserTier, // 프로필에서 별도 조회 필요
            role: 'user' as UserRole, // 프로필에서 별도 조회 필요
            iat: 0,
            exp: 0,
        };
    } catch (error) {
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
