const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_JWT_SECRET',
    'ANTHROPIC_API_KEY',
];

// Check environment variables
let missing = [];
for (const v of requiredVars) {
    if (!process.env[v]) {
        missing.push(v);
    }
}

if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

// Check JWT Secret length
const jwtSecret = process.env.SUPABASE_JWT_SECRET;
if (jwtSecret && jwtSecret.length < 32) {
    console.error('SUPABASE_JWT_SECRET must be at least 32 characters long');
    process.exit(1);
}

// Check Service Role Key prefix
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (serviceRoleKey && serviceRoleKey.startsWith('NEXT_PUBLIC_')) {
    console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY starts with NEXT_PUBLIC_. This is insecure!');
}

console.log('Environment variables validated successfully.');
