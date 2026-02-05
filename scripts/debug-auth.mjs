// Debug auth - check if user exists in auth.users
import dns from 'dns';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';

dns.setDefaultResultOrder('ipv4first');

const TEST_EMAIL = 'e2e_full_1770194404303@salesfunnelbank.com';
const TEST_PASSWORD = 'E2ETestPassword123!';

// Supabase 연결 정보
const pool = new pg.Pool({
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.qynlsdgxpkxjhtbgiorc',
  password: 'V75ATnUjz8.A@T5',
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  console.log('=== Auth Debug ===\n');

  try {
    const client = await pool.connect();

    // 1. Check profiles table
    console.log('1. Profiles 테이블 확인:');
    const profileResult = await client.query(
      'SELECT id, email, is_approved, role FROM profiles WHERE email = $1',
      [TEST_EMAIL]
    );
    console.log('   프로필:', profileResult.rows[0] || 'NOT FOUND');

    // 2. Check auth.users table
    console.log('\n2. Auth.users 테이블 확인:');
    const authResult = await client.query(
      'SELECT id, email, email_confirmed_at, created_at FROM auth.users WHERE email = $1',
      [TEST_EMAIL]
    );
    console.log('   Auth User:', authResult.rows[0] || 'NOT FOUND');

    client.release();

    // 3. Try Supabase signInWithPassword
    console.log('\n3. Supabase signInWithPassword 테스트:');
    const supabase = createClient(
      'https://qynlsdgxpkxjhtbgiorc.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5bmxzZGd4cGt4amh0Ymdpb3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjU0NTgsImV4cCI6MjA4MTM0MTQ1OH0.80JMaQBwns8yJ--V-dqGN3kW8fkmtrRBoR3Mg_WadvU'
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (error) {
      console.log('   에러:', error.message);
      console.log('   상세:', error);
    } else {
      console.log('   성공! 세션:', data.session ? 'EXISTS' : 'NULL');
      console.log('   유저:', data.user?.email);
    }

  } catch (error) {
    console.error('오류:', error.message);
  }

  await pool.end();
}

debug();
