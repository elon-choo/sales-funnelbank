// Direct API test with full error response
import dns from 'dns';
import { createClient } from '@supabase/supabase-js';

dns.setDefaultResultOrder('ipv4first');

const BASE_URL = 'https://sales-funnelbank.vercel.app';
const TEST_EMAIL = 'e2e_full_1770194404303@salesfunnelbank.com';
const TEST_PASSWORD = 'E2ETestPassword123!';

async function test() {
  console.log('=== Direct API Test ===\n');

  // 1. Login to get token
  console.log('1. Getting token from Supabase...');
  const supabase = createClient(
    'https://qynlsdgxpkxjhtbgiorc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5bmxzZGd4cGt4amh0Ymdpb3JjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3NjU0NTgsImV4cCI6MjA4MTM0MTQ1OH0.80JMaQBwns8yJ--V-dqGN3kW8fkmtrRBoR3Mg_WadvU'
  );

  const { data, error } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    console.log('Login failed:', error.message);
    return;
  }

  const token = data.session.access_token;
  console.log('   Token acquired:', token.substring(0, 30) + '...');

  // 2. Test chat sessions API directly
  console.log('\n2. Testing /api/chat/sessions POST...');
  const chatRes = await fetch(`${BASE_URL}/api/chat/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title: 'Test Session' })
  });
  const chatText = await chatRes.text();
  console.log('   Status:', chatRes.status);
  console.log('   Response:', chatText);

  // 3. Test LMS dashboard API
  console.log('\n3. Testing /api/lms/dashboard GET...');
  const lmsRes = await fetch(`${BASE_URL}/api/lms/dashboard`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const lmsText = await lmsRes.text();
  console.log('   Status:', lmsRes.status);
  console.log('   Response:', lmsText.substring(0, 500));

  // 4. Test /api/auth/me
  console.log('\n4. Testing /api/auth/me GET...');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const meText = await meRes.text();
  console.log('   Status:', meRes.status);
  console.log('   Response:', meText);

  // 5. Test /api/lp (this one worked)
  console.log('\n5. Testing /api/lp GET (should work)...');
  const lpRes = await fetch(`${BASE_URL}/api/lp`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  const lpText = await lpRes.text();
  console.log('   Status:', lpRes.status);
  console.log('   Response:', lpText.substring(0, 200) + '...');
}

test().catch(console.error);
