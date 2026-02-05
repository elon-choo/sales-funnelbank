// src/app/api/admin/debug/users/route.ts
// 디버그용: Supabase Auth와 Profiles 상태 비교

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/auth/guards';

// GET /api/admin/debug/users - Supabase Auth 사용자와 profiles 비교
export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth || (auth.role !== 'admin' && auth.tier !== 'ENTERPRISE')) {
            return NextResponse.json(
                { success: false, error: { code: 'FORBIDDEN', message: '관리자 권한이 필요합니다' } },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const email = searchParams.get('email');

        const supabase = createAdminClient();

        // 1. Supabase Auth 사용자 목록 조회
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers({
            perPage: 100,
        });

        if (authError) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_ERROR', message: authError.message } },
                { status: 500 }
            );
        }

        // 2. Profiles 테이블 조회
        const { data: profiles, error: profileError } = await supabase
            .from('profiles')
            .select('id, email, full_name, is_approved, tier, role, created_at')
            .is('deleted_at', null);

        if (profileError) {
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: profileError.message } },
                { status: 500 }
            );
        }

        // 3. 비교 분석
        const authUserMap = new Map(authUsers.users.map(u => [u.id, u]));
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const comparison = [];

        // Auth에 있는 모든 사용자 확인
        for (const authUser of authUsers.users) {
            const profile = profileMap.get(authUser.id);

            // email 필터 적용
            if (email && authUser.email !== email) continue;

            comparison.push({
                id: authUser.id,
                email: authUser.email,
                auth: {
                    email_confirmed: authUser.email_confirmed_at ? true : false,
                    created_at: authUser.created_at,
                    last_sign_in: authUser.last_sign_in_at,
                },
                profile: profile ? {
                    full_name: profile.full_name,
                    is_approved: profile.is_approved,
                    tier: profile.tier,
                    role: profile.role,
                } : null,
                status: profile
                    ? (profile.is_approved ? 'READY_TO_LOGIN' : 'PENDING_APPROVAL')
                    : 'MISSING_PROFILE',
            });
        }

        // Profiles에만 있고 Auth에 없는 사용자 (비정상)
        for (const profile of profiles || []) {
            if (!authUserMap.has(profile.id)) {
                if (email && profile.email !== email) continue;

                comparison.push({
                    id: profile.id,
                    email: profile.email,
                    auth: null,
                    profile: {
                        full_name: profile.full_name,
                        is_approved: profile.is_approved,
                        tier: profile.tier,
                        role: profile.role,
                    },
                    status: 'ORPHAN_PROFILE',
                });
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                totalAuthUsers: authUsers.users.length,
                totalProfiles: profiles?.length || 0,
                users: comparison,
            }
        });
    } catch (error) {
        console.error('Debug users error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
