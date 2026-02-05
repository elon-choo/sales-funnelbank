// Debug token structure
import dns from 'dns';
import { createClient } from '@supabase/supabase-js';
import * as jose from 'jose';

dns.setDefaultResultOrder('ipv4first');

const TEST_EMAIL = 'e2e_full_1770194404303@salesfunnelbank.com';
const TEST_PASSWORD = 'E2ETestPassword123!';
const JWT_SECRET = 'oKtWgCfd8xKnYjGuG/NnxCBI+puzGe8cKRD5fC+KeWG8L4esS9ADC3Pd+IzzFNPsi1cHrIkL9cjy6M6rjNSqvA==';

async function debug() {
  console.log('=== Token Debug ===\n');

  // 1. Get token from Supabase
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
  console.log('1. Access Token (first 50 chars):', token.substring(0, 50) + '...');
  console.log('   Token length:', token.length);

  // 2. Decode without verification (to see structure)
  const parts = token.split('.');
  const header = JSON.parse(atob(parts[0]));
  const payload = JSON.parse(atob(parts[1]));

  console.log('\n2. Token Header:', JSON.stringify(header, null, 2));
  console.log('\n3. Token Payload:', JSON.stringify(payload, null, 2));

  // 3. Try to verify with JWT secret
  console.log('\n4. Verification attempt with SUPABASE_JWT_SECRET:');
  try {
    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload: verifiedPayload } = await jose.jwtVerify(token, secret);
    console.log('   ✅ Verification SUCCESSFUL');
    console.log('   Verified payload:', JSON.stringify(verifiedPayload, null, 2));
  } catch (err) {
    console.log('   ❌ Verification FAILED:', err.message);
    console.log('   Error code:', err.code);
  }

  // 4. Try base64url decoding of the secret
  console.log('\n5. Trying base64url decoded secret:');
  try {
    // JWT secrets are often base64 encoded
    const decodedSecret = Buffer.from(JWT_SECRET, 'base64');
    const { payload: verifiedPayload } = await jose.jwtVerify(token, decodedSecret);
    console.log('   ✅ Verification SUCCESSFUL with base64 decoded secret');
    console.log('   Verified payload sub:', verifiedPayload.sub);
  } catch (err) {
    console.log('   ❌ Verification FAILED:', err.message);
  }
}

debug().catch(console.error);
