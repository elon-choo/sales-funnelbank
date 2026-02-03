// jest.setup.js
// Jest 테스트 환경 설정

// 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

// 테스트 타임아웃
jest.setTimeout(30000);

// 콘솔 에러 억제 (선택적)
// console.error = jest.fn();
