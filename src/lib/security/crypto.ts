// src/lib/security/crypto.ts

import { timingSafeEqual } from 'crypto';

/**
 * 보안 토큰 생성 (Base64 URL-safe)
 * Edge Runtime 호환
 */
export function generateSecureToken(length: number = 64): string {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

/**
 * 토큰 해시 생성 (SHA-256)
 * - 원본 토큰은 저장하지 않고 해시만 저장
 * - Edge Runtime 호환 (crypto.subtle 사용)
 */
export async function hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Timing-Safe 문자열 비교
 * - Timing Attack 방지
 * - 두 문자열 길이가 다르면 false 반환
 */
export function timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
        return false;
    }

    const encoder = new TextEncoder();
    const bufA = encoder.encode(a);
    const bufB = encoder.encode(b);

    try {
        return timingSafeEqual(bufA, bufB);
    } catch {
        // Node.js crypto 사용 불가시 폴백 (덜 안전하지만 기능 유지)
        return a === b;
    }
}

/**
 * 에러 참조 ID 생성
 * - 사용자에게 표시하여 로그 추적에 사용
 */
export function generateErrorReference(): string {
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, '')
        .slice(0, 14);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `ERR-${timestamp}-${random}`;
}
