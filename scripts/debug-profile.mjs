// Debug profile query
import dns from 'dns';
import pg from 'pg';

dns.setDefaultResultOrder('ipv4first');

const pool = new pg.Pool({
  host: 'aws-1-ap-northeast-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.qynlsdgxpkxjhtbgiorc',
  password: 'V75ATnUjz8.A@T5',
  ssl: { rejectUnauthorized: false }
});

async function debug() {
  console.log('=== Profile Debug ===\n');

  try {
    const client = await pool.connect();

    // 1. Check profiles table structure
    console.log('1. Profiles 테이블 컬럼 확인:');
    const columnsResult = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position
    `);
    console.log('   컬럼 목록:');
    columnsResult.rows.forEach(row => {
      console.log(`   - ${row.column_name}: ${row.data_type}`);
    });

    // 2. Check if lms_role column exists
    const hasLmsRole = columnsResult.rows.some(r => r.column_name === 'lms_role');
    console.log(`\n2. lms_role 컬럼 존재: ${hasLmsRole ? '✅ YES' : '❌ NO'}`);

    // 3. Check test user profile
    const userId = 'e0fb6f22-e075-45e7-be46-30b46bb82148';
    console.log(`\n3. 테스트 사용자 프로필 (${userId}):`);
    const profileResult = await client.query(
      'SELECT * FROM profiles WHERE id = $1',
      [userId]
    );
    if (profileResult.rows[0]) {
      console.log('   프로필:', JSON.stringify(profileResult.rows[0], null, 2));
    } else {
      console.log('   ❌ 프로필 없음');
    }

    client.release();
  } catch (error) {
    console.error('오류:', error.message);
  }

  await pool.end();
}

debug();
