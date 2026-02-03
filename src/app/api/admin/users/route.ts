// src/app/api/admin/users/route.ts
// 관리자용 사용자 관리 API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAccessToken } from '@/lib/auth/tokens';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 관리자 권한 확인
async function verifyAdmin(request: NextRequest) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }

    const token = authHeader.substring(7);
    const payload = await verifyAccessToken(token);
    if (!payload) {
        return null;
    }

    // 관리자 역할 확인
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', payload.sub)
        .single();

    if (!profile || profile.role !== 'admin') {
        return null;
    }

    return payload;
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
