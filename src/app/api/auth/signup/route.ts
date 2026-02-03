
// src/app/api/auth/signup/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SignupRequest } from '@/types/auth';

export async function POST(request: NextRequest) {
    try {
        const body: SignupRequest = await request.json();
        const { email, password, fullName, agreeTerms, agreePrivacy, agreeMarketing } = body;

        // 유효성 검사
        if (!email || !password || !fullName || !agreeTerms || !agreePrivacy) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_001', message: '필수 항목이 누락되었습니다.' } },
                { status: 400 }
            );
        }

        const supabase = createAdminClient();

        // 1. Supabase Auth 회원가입
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // v2.0: 이메일 확인 자동 완료 처리 (관리자 승인제로 대체)
            user_metadata: { full_name: fullName },
        });

        if (authError) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_002', message: authError.message } },
                { status: 400 }
            );
        }

        if (!authData.user) {
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_002', message: '회원가입 실패' } },
                { status: 500 }
            );
        }

        // 2. Profiles 테이블에 추가
        const { error: profileError } = await supabase.from('profiles').insert({
            id: authData.user.id,
            email,
            full_name: fullName,
            tier: 'FREE',
            role: 'user',
            is_approved: false, // 관리자 승인 필요
            agree_marketing: !!agreeMarketing,
        });

        if (profileError) {
            // 롤백: Auth 유저 삭제
            await supabase.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json(
                { success: false, error: { code: 'AUTH_002', message: '프로필 생성 실패' } },
                { status: 500 }
            );
        }

        // 3. 감사 로그
        await supabase.from('audit_logs').insert({
            user_id: authData.user.id,
            action: 'signup',
            severity: 'info',
            details: { email, full_name: fullName },
        });

        return NextResponse.json({
            success: true,
            message: '회원가입이 완료되었습니다. 관리자 승인 후 로그인 가능합니다.',
        });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'AUTH_999', message: '서버 오류가 발생했습니다.' } },
            { status: 500 }
        );
    }
}
