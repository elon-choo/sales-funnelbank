// scripts/setup-admin.js
// 어드민 계정 설정 스크립트
const { Client } = require('pg');
const dns = require('dns');
const crypto = require('crypto');

// IPv4 우선 설정 (WSL 호환)
dns.setDefaultResultOrder('ipv4first');

// 환경 변수에서 연결 정보 가져오기
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

async function setupAdmin() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('데이터베이스에 연결 중...');
        await client.connect();
        console.log('연결 성공!');

        // 1. role 컬럼 추가 (이미 존재하면 무시)
        console.log('\n1. role 컬럼 추가 중...');
        try {
            await client.query(`
                ALTER TABLE profiles
                ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' NOT NULL;
            `);
            console.log('   role 컬럼 추가 완료!');
        } catch (err) {
            if (err.code === '42701') {
                console.log('   role 컬럼이 이미 존재합니다.');
            } else {
                throw err;
            }
        }

        // 2. 어드민 계정 정보
        const adminEmail = 'admin@magneticsales.com';
        const adminPassword = 'Admin123!@#';
        const adminFullName = '관리자';

        // 3. 기존 어드민 계정 확인
        console.log('\n2. 기존 어드민 계정 확인 중...');
        const existingAdmin = await client.query(
            'SELECT id, email, role FROM profiles WHERE email = $1',
            [adminEmail]
        );

        if (existingAdmin.rows.length > 0) {
            console.log('   기존 어드민 계정 발견:', existingAdmin.rows[0].email);

            // 역할을 admin으로 업데이트
            await client.query(
                'UPDATE profiles SET role = $1, tier = $2, is_approved = $3 WHERE email = $4',
                ['admin', 'ENTERPRISE', true, adminEmail]
            );
            console.log('   어드민 권한으로 업데이트 완료!');
        } else {
            // 4. Supabase Auth에서 새 사용자 생성 필요
            console.log('   새 어드민 계정 생성이 필요합니다.');
            console.log('\n   Supabase Auth를 통해 사용자를 생성해야 합니다.');
            console.log('   다음 정보로 회원가입 후, 아래 쿼리를 실행하세요:');
            console.log(`   이메일: ${adminEmail}`);
            console.log(`   비밀번호: ${adminPassword}`);
            console.log(`   이름: ${adminFullName}`);
            console.log('\n   회원가입 후 실행할 쿼리:');
            console.log(`   UPDATE profiles SET role = 'admin', tier = 'ENTERPRISE', is_approved = true WHERE email = '${adminEmail}';`);
        }

        // 5. 현재 프로필 테이블 구조 확인
        console.log('\n3. profiles 테이블 구조 확인...');
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'profiles'
            ORDER BY ordinal_position;
        `);

        console.log('   현재 컬럼:');
        columns.rows.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable}, default: ${col.column_default || 'none'})`);
        });

        // 6. 모든 사용자 목록 표시
        console.log('\n4. 현재 등록된 사용자 목록:');
        const users = await client.query(
            'SELECT email, full_name, tier, role, is_approved, created_at FROM profiles ORDER BY created_at DESC LIMIT 10'
        );

        if (users.rows.length === 0) {
            console.log('   등록된 사용자가 없습니다.');
        } else {
            users.rows.forEach(user => {
                console.log(`   - ${user.email} (${user.full_name}) | tier: ${user.tier} | role: ${user.role || 'user'} | approved: ${user.is_approved}`);
            });
        }

        console.log('\n완료!');

    } catch (error) {
        console.error('오류 발생:', error.message);
        throw error;
    } finally {
        await client.end();
    }
}

setupAdmin().catch(console.error);
