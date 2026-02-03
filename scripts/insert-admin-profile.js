// scripts/insert-admin-profile.js
// profiles 테이블에 어드민 프로필 직접 삽입
const { Client } = require('pg');
const dns = require('dns');

dns.setDefaultResultOrder('ipv4first');
require('dotenv').config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

// 어드민 정보
const ADMIN_USER_ID = '2413c0d5-726c-4063-8225-68d318c8b447';
const ADMIN_EMAIL = 'admin@magneticsales.com';
const ADMIN_FULL_NAME = '관리자';

async function insertAdminProfile() {
    const client = new Client({
        connectionString: DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('데이터베이스 연결 중...');
        await client.connect();
        console.log('연결 성공!\n');

        // 기존 프로필 확인
        const existing = await client.query(
            'SELECT * FROM profiles WHERE id = $1',
            [ADMIN_USER_ID]
        );

        if (existing.rows.length > 0) {
            console.log('기존 프로필 발견. 업데이트 중...');
            await client.query(`
                UPDATE profiles
                SET role = 'admin', tier = 'ENTERPRISE', is_approved = true, full_name = $1
                WHERE id = $2
            `, [ADMIN_FULL_NAME, ADMIN_USER_ID]);
            console.log('프로필 업데이트 완료!');
        } else {
            console.log('프로필 없음. 새로 생성 중...');
            await client.query(`
                INSERT INTO profiles (id, email, full_name, tier, role, is_approved, agree_marketing)
                VALUES ($1, $2, $3, 'ENTERPRISE', 'admin', true, false)
            `, [ADMIN_USER_ID, ADMIN_EMAIL, ADMIN_FULL_NAME]);
            console.log('프로필 생성 완료!');
        }

        // 확인
        console.log('\n어드민 프로필 확인:');
        const result = await client.query(
            'SELECT id, email, full_name, tier, role, is_approved FROM profiles WHERE id = $1',
            [ADMIN_USER_ID]
        );
        console.log(result.rows[0]);

        console.log('\n===========================');
        console.log('어드민 계정 정보:');
        console.log('이메일: admin@magneticsales.com');
        console.log('비밀번호: Admin123!@#');
        console.log('===========================');

    } catch (error) {
        console.error('오류:', error.message);
    } finally {
        await client.end();
    }
}

insertAdminProfile();
