// src/app/api/admin/users/[id]/approve/route.ts
// 사용자 승인 API

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAccessToken } from '@/lib/auth/tokens';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ id: string }>;
}

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

// POST /api/admin/users/[id]/approve - 사용자 승인
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        const admin = await verifyAdmin(request);
        if (!admin) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' } },
                { status: 403 }
            );
        }

        const { data: user, error } = await supabase
            .from('profiles')
            .update({
                is_approved: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('User approve error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '승인 처리 실패' } },
                { status: 500 }
            );
        }

        // 감사 로그
        await supabase.from('audit_logs').insert({
            user_id: admin.sub,
            action: 'approve_user',
            severity: 'info',
            details: { approved_user_id: id, approved_email: user.email }
        });

        return NextResponse.json({
            success: true,
            data: { user },
            message: '사용자가 승인되었습니다.'
        });
    } catch (error) {
        console.error('User approve error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}

// DELETE /api/admin/users/[id]/approve - 승인 취소
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

        const admin = await verifyAdmin(request);
        if (!admin) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' } },
                { status: 403 }
            );
        }

        const { data: user, error } = await supabase
            .from('profiles')
            .update({
                is_approved: false,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('User reject error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '승인 취소 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { user },
            message: '사용자 승인이 취소되었습니다.'
        });
    } catch (error) {
        console.error('User reject error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
