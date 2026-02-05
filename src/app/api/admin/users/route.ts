// src/app/api/admin/users/route.ts
// 관리자용 사용자 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { authenticateRequest } from '@/lib/auth/guards';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 관리자 권한 확인 (authenticateRequest 사용하여 하드코딩 토큰 지원)
async function verifyAdmin(request: NextRequest) {
    const auth = await authenticateRequest(request);
    if (!auth) {
        return null;
    }

    // 관리자 역할 확인 (admin role 또는 ENTERPRISE tier)
    if (auth.role !== 'admin' && auth.tier !== 'ENTERPRISE') {
        return null;
    }

    return auth;
}

// GET /api/admin/users - 사용자 목록 조회
export async function GET(request: NextRequest) {
    try {
        const admin = await verifyAdmin(request);
        if (!admin) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' } },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // pending, approved, all

        let query = supabase
            .from('profiles')
            .select('id, email, full_name, tier, role, is_approved, created_at, updated_at')
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (status === 'pending') {
            query = query.eq('is_approved', false);
        } else if (status === 'approved') {
            query = query.eq('is_approved', true);
        }

        const { data: users, error } = await query;

        if (error) {
            console.error('Users fetch error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '사용자 조회 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { users }
        });
    } catch (error) {
        console.error('Admin users error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
