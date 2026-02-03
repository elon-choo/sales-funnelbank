// src/lib/auth/rotation.ts

import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
    generateSecureToken,
    hashToken,
} from '@/lib/security/crypto';
import { TOKEN_EXPIRY } from '@/lib/supabase/config';

interface RotationResult {
    success: boolean;
    newRefreshToken?: string;
    userId?: string;
    error?: 'not_found' | 'revoked' | 'expired' | 'reuse_detected';
}

/**
 * 모든 사용자 세션 무효화 (보안 위협 시)
 */
async function invalidateAllUserSessions(userId: string) {
    const supabase = createAdminClient();

    // Refresh Tokens 모두 폐기
    await supabase.from('refresh_tokens')
        .update({ revoked: true, revoked_at: new Date().toISOString() })
        .eq('user_id', userId);

    // User Sessions 모두 무효화
    await supabase.from('user_sessions')
        .update({ invalidated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('invalidated_at', null);
}

/**
 * Refresh Token Rotation
 * 1. 기존 토큰 검증
 * 2. 재사용 감지 시 모든 세션 무효화
 * 3. 기존 토큰 폐기
 * 4. 새 토큰 발급
 */
export async function rotateRefreshToken(
    currentToken: string
): Promise<RotationResult> {
    const supabase = createAdminClient();
    const tokenHash = await hashToken(currentToken);

    // 1. 토큰 조회
    const { data: tokenRecord, error } = await supabase
        .from('refresh_tokens')
        .select('*')
        .eq('token_hash', tokenHash)
        .single();

    if (error || !tokenRecord) {
        return { success: false, error: 'not_found' };
    }

    // 2. 토큰 재사용 감지 (CRITICAL)
    if (tokenRecord.revoked) {
        // 보안 위협: 해당 사용자의 모든 토큰/세션 즉시 무효화
        await invalidateAllUserSessions(tokenRecord.user_id);

        // 보안 감사 로그 (CRITICAL 레벨)
        await supabase.from('audit_logs').insert({
            user_id: tokenRecord.user_id,
            action: 'token_reuse_detected',
            details: {
                severity: 'critical',
                token_id: tokenRecord.id,
                original_revoked_at: tokenRecord.revoked_at,
            },
            severity: 'critical', // Added explicit column match just in case
            created_at: new Date().toISOString()
        });

        return { success: false, error: 'reuse_detected' };
    }

    // 3. 만료 확인
    if (new Date(tokenRecord.expires_at) < new Date()) {
        return { success: false, error: 'expired' };
    }

    // 4. 기존 토큰 폐기 (Rotation)
    await supabase
        .from('refresh_tokens')
        .update({
            revoked: true,
            revoked_at: new Date().toISOString(),
        })
        .eq('id', tokenRecord.id);

    // 5. 새 Refresh Token 발급
    const newRefreshToken = generateSecureToken(64);
    const newTokenHash = await hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH_TOKEN);

    await supabase.from('refresh_tokens').insert({
        user_id: tokenRecord.user_id,
        token_hash: newTokenHash,
        expires_at: newExpiresAt.toISOString(),
        revoked: false,
    });

    return {
        success: true,
        newRefreshToken,
        userId: tokenRecord.user_id,
    };
}

/**
 * 새 Refresh Token 생성 (로그인 시)
 */
export async function createRefreshToken(userId: string): Promise<string> {
    const supabase = createAdminClient();
    const newRefreshToken = generateSecureToken(64);
    const newTokenHash = await hashToken(newRefreshToken);
    const newExpiresAt = new Date(Date.now() + TOKEN_EXPIRY.REFRESH_TOKEN);

    await supabase.from('refresh_tokens').insert({
        user_id: userId,
        token_hash: newTokenHash,
        expires_at: newExpiresAt.toISOString(),
        revoked: false,
    });

    return newRefreshToken;
}
