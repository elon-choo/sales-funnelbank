// scripts/create-admin-user.js
// Supabase Admin API를 사용하여 어드민 계정 생성
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 어드민 계정 정보
const ADMIN_EMAIL = 'admin@magneticsales.com';
const ADMIN_PASSWORD = 'Admin123!@#';
const ADMIN_FULL_NAME = '관리자';

async function createAdminUser() {
    console.log('어드민 계정 생성 시작...\n');

    // 1. Supabase Auth Admin API로 사용자 생성
    console.log('1. Supabase Auth에서 사용자 생성 중...');

    const createUserResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
        },
        body: JSON.stringify({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            user_metadata: {
                full_name: ADMIN_FULL_NAME
            }
        })
    });

    const createResult = await createUserResponse.json();

    if (!createUserResponse.ok) {
        if (createResult.msg?.includes('already been registered') || createResult.code === 'email_exists') {
            console.log('   사용자가 이미 존재합니다. 기존 사용자 정보를 업데이트합니다.');

            // 기존 사용자 찾기
            const listResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?filter=email.eq.${encodeURIComponent(ADMIN_EMAIL)}`, {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_SERVICE_KEY,
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`
                }
            });

            const users = await listResponse.json();
            if (users.users && users.users.length > 0) {
                const userId = users.users[0].id;
                console.log(`   기존 사용자 ID: ${userId}`);

                // profiles 테이블 업데이트
                await updateProfile(userId);
            }
        } else {
            console.error('   사용자 생성 실패:', createResult);
            return;
        }
    } else {
        console.log('   사용자 생성 성공!');
        console.log(`   User ID: ${createResult.id}`);

        // 2. profiles 테이블에 어드민 정보 추가/업데이트
        await updateProfile(createResult.id);
    }

    console.log('\n어드민 계정 생성 완료!');
    console.log('===========================');
    console.log(`이메일: ${ADMIN_EMAIL}`);
    console.log(`비밀번호: ${ADMIN_PASSWORD}`);
    console.log('===========================');
}

async function updateProfile(userId) {
    console.log('\n2. profiles 테이블 업데이트 중...');

    // Supabase REST API로 profiles 업데이트
    const upsertResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({
            role: 'admin',
            tier: 'ENTERPRISE',
            is_approved: true,
            full_name: ADMIN_FULL_NAME
        })
    });

    if (!upsertResponse.ok) {
        // PATCH 실패시 INSERT 시도
        console.log('   기존 프로필 없음. 새 프로필 생성 중...');

        const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_SERVICE_KEY,
                'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                id: userId,
                email: ADMIN_EMAIL,
                full_name: ADMIN_FULL_NAME,
                role: 'admin',
                tier: 'ENTERPRISE',
                is_approved: true,
                agree_marketing: false
            })
        });

        if (!insertResponse.ok) {
            const error = await insertResponse.text();
            console.error('   프로필 생성 실패:', error);
            return;
        }
        console.log('   프로필 생성 성공!');
    } else {
        console.log('   프로필 업데이트 성공!');
    }
}

createAdminUser().catch(console.error);
