
// src/app/api/auth/logout/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { COOKIE_CONFIG } from '@/lib/supabase/config';
import { hashToken } from '@/lib/security/crypto';

export async function POST(request: NextRequest) {
    try {
        const refreshToken = request.cookies.get(COOKIE_CONFIG.REFRESH_TOKEN_NAME)?.value;

        if (refreshToken) {
            const supabase = createAdminClient();
            const tokenHash = await hashToken(refreshToken);

            // 토큰 만료 처리 (DB)
            await supabase.from('refresh_tokens')
                .update({
                    revoked: true,
                    revoked_at: new Date().toISOString()
                })
                .eq('token_hash', tokenHash);

            // 로그인한 사용자 정보가 있다면 감사 로그 추가 (선택사항, jwt 파싱 필요할 수 있음)
        }

        const response = NextResponse.json({
            success: true,
            message: '로그아웃 되었습니다.'
        });

        // 쿠키 삭제
        response.cookies.delete(COOKIE_CONFIG.REFRESH_TOKEN_NAME);

        return response;

    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'AUTH_999', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
