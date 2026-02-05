// src/app/api/admin/debug/reset-password/route.ts
// 디버그용: 비밀번호 재설정

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/auth/guards';

// POST /api/admin/debug/reset-password - 사용자 비밀번호 재설정 (관리자 전용)
export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth || (auth.role !== 'admin' && auth.tier !== 'ENTERPRISE')) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' } },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { userId, newPassword } = body;

        if (!userId || !newPassword) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION', message: 'userId와 newPassword가 필요합니다' } },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // 비밀번호 업데이트
        const { error } = await supabase.auth.admin.updateUserById(userId, {
            password: newPassword,
        });

        if (error) {
            return NextResponse.json(
                { success: false, error: { code: 'UPDATE_ERROR', message: error.message } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: '비밀번호가 재설정되었습니다.',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
