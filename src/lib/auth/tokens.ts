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
 * - Supabase Auth getUser() 사용 (가장 안정적)
 * - 만료, 서명 검증은 Supabase가 처리
 */
export async function verifyAccessToken(
    token: string
): Promise<TokenPayload | null> {
    try {
        // Supabase에서 직접 토큰 검증
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
