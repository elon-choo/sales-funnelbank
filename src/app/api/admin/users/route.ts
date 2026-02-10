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

// PATCH /api/admin/users - 사용자 과정/기수 변경
export async function PATCH(request: NextRequest) {
    try {
        const admin = await verifyAdmin(request);
        if (!admin) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' } },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { userId, courseType, courseId } = body;

        if (!userId) {
            return NextResponse.json(
                { success: false, error: { code: 'VALIDATION_ERROR', message: 'userId는 필수입니다' } },
                { status: 400 }
            );
        }

        // 1. course_type 업데이트
        if (courseType) {
            const { error: profileError } = await supabase
                .from('profiles')
                .update({ course_type: courseType, updated_at: new Date().toISOString() })
                .eq('id', userId);

            if (profileError) {
                return NextResponse.json(
                    { success: false, error: { code: 'DB_ERROR', message: '과정 변경 실패: ' + profileError.message } },
                    { status: 500 }
                );
            }
        }

        // 2. 기수(코스) 등록/변경
        if (courseId) {
            // 기존 활성 등록 비활성화
            await supabase
                .from('course_enrollments')
                .update({ status: 'dropped' })
                .eq('user_id', userId)
                .eq('status', 'active');

            // 새 기수 등록
            const { error: enrollError } = await supabase
                .from('course_enrollments')
                .upsert({
                    user_id: userId,
                    course_id: courseId,
                    status: 'active',
                    enrolled_at: new Date().toISOString(),
                }, { onConflict: 'user_id,course_id' });

            if (enrollError) {
                return NextResponse.json(
                    { success: false, error: { code: 'DB_ERROR', message: '기수 등록 실패: ' + enrollError.message } },
                    { status: 500 }
                );
            }
        }

        return NextResponse.json({ success: true, data: { message: '업데이트 완료' } });
    } catch (error) {
        console.error('Admin users PATCH error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
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
            .select('id, email, full_name, tier, role, course_type, is_approved, created_at, updated_at')
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

        // 코스 목록 조회 (기수 선택용)
        const { data: courses } = await supabase
            .from('courses')
            .select('id, title, status')
            .order('created_at', { ascending: false });

        // 수강 등록 현황 조회
        const { data: enrollments } = await supabase
            .from('course_enrollments')
            .select('user_id, course_id, status')
            .eq('status', 'active');

        return NextResponse.json({
            success: true,
            data: { users, courses: courses || [], enrollments: enrollments || [] }
        });
    } catch (error) {
        console.error('Admin users error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
