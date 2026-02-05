// E2E 테스트 계속 - 이미 승인된 사용자로 테스트
import dns from 'dns';

dns.setDefaultResultOrder('ipv4first');

const BASE_URL = 'https://sales-funnelbank.vercel.app';
const TEST_EMAIL = 'e2e_full_1770194404303@salesfunnelbank.com';
const TEST_PASSWORD = 'E2ETestPassword123!';

let authToken = '';
const testResults = {
  timestamp: new Date().toISOString(),
  email: TEST_EMAIL,
  steps: []
};

function logStep(step, status, details = {}) {
  testResults.steps.push({ step, status, ...details });
  const icon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${icon} ${step}${details.message ? ': ' + details.message : ''}`);
  if (details.error) console.log(`   → 에러: ${details.error}`);
}

async function apiCall(name, url, options = {}) {
  console.log(`\n🔄 ${name}...`);
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
        ...options.headers
      }
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch {}

    const icon = res.ok ? '✅' : '❌';
    console.log(`${icon} ${name}: ${res.status}`);
    if (json?.message) console.log(`   → ${json.message}`);
    if (json?.error?.message) console.log(`   → ${json.error.message}`);

    return { ok: res.ok, status: res.status, json, text };
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return { ok: false, error };
  }
}

async function runTest() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Sales Funnelbank E2E 테스트 (기존 승인된 사용자)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  이메일: ${TEST_EMAIL}`);
  console.log('═══════════════════════════════════════════════════════════');

  // ============================================================
  // 1. 로그인 테스트
  // ============================================================
  console.log('\n\n🔐 [1/7] 로그인 테스트');
  console.log('─'.repeat(50));

  const loginResult = await apiCall('로그인', `${BASE_URL}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });

  if (!loginResult.ok) {
    logStep('로그인', 'FAIL', { error: loginResult.json?.error?.message });
    console.log('전체 응답:', JSON.stringify(loginResult.json, null, 2));
    return testResults;
  }

  authToken = loginResult.json?.data?.session?.access_token;
  if (!authToken) {
    logStep('로그인', 'FAIL', { error: '토큰 없음' });
    return testResults;
  }

  console.log(`   → 토큰 획득: ${authToken.substring(0, 30)}...`);
  logStep('로그인', 'PASS', { message: '토큰 획득 성공' });

  // ============================================================
  // 2. 사용자 정보 조회
  // ============================================================
  console.log('\n\n👤 [2/7] 사용자 정보 조회');
  console.log('─'.repeat(50));

  const meResult = await apiCall('내 정보 조회', `${BASE_URL}/api/auth/me`);
  if (meResult.ok) {
    logStep('사용자 정보 조회', 'PASS');
    if (meResult.json?.data?.profile) {
      console.log(`   → 이름: ${meResult.json.data.profile.full_name}`);
      console.log(`   → 역할: ${meResult.json.data.profile.role}`);
    }
  } else {
    logStep('사용자 정보 조회', 'FAIL', { error: meResult.json?.error?.message });
  }

  // ============================================================
  // 3. 랜딩페이지 빌더 테스트
  // ============================================================
  console.log('\n\n🎨 [3/7] 랜딩페이지 빌더 테스트');
  console.log('─'.repeat(50));

  const lpListResult = await apiCall('랜딩페이지 목록', `${BASE_URL}/api/lp`);
  if (lpListResult.ok) {
    logStep('랜딩페이지 목록 조회', 'PASS');
  } else {
    logStep('랜딩페이지 목록 조회', 'FAIL', { error: lpListResult.json?.error?.message });
  }

  const timestamp = Date.now();
  const lpCreateResult = await apiCall('랜딩페이지 생성', `${BASE_URL}/api/lp/create`, {
    method: 'POST',
    body: JSON.stringify({
      title: `E2E 테스트 LP ${timestamp}`,
      description: '자동화 테스트로 생성된 페이지'
    })
  });

  if (lpCreateResult.ok && lpCreateResult.json?.data?.id) {
    const lpId = lpCreateResult.json.data.id;
    console.log(`   → 생성된 LP ID: ${lpId}`);
    logStep('랜딩페이지 생성', 'PASS', { lpId });

    const lpSaveResult = await apiCall('랜딩페이지 저장', `${BASE_URL}/api/builder/save`, {
      method: 'POST',
      body: JSON.stringify({
        id: lpId,
        sections: [
          { type: 'hero', title: '테스트 헤드라인', subtitle: '테스트 서브헤드라인', cta: '지금 시작하기' }
        ]
      })
    });

    if (lpSaveResult.ok) {
      logStep('랜딩페이지 저장', 'PASS');
    } else {
      logStep('랜딩페이지 저장', 'FAIL', { error: lpSaveResult.json?.error?.message });
    }
  } else {
    logStep('랜딩페이지 생성', 'FAIL', { error: lpCreateResult.json?.error?.message });
  }

  // ============================================================
  // 4. AI 챗봇 테스트
  // ============================================================
  console.log('\n\n💬 [4/7] AI 챗봇 테스트');
  console.log('─'.repeat(50));

  const chatSessionResult = await apiCall('챗봇 세션 생성', `${BASE_URL}/api/chat/sessions`, {
    method: 'POST',
    body: JSON.stringify({ title: `E2E 테스트 세션 ${timestamp}` })
  });

  if (chatSessionResult.ok && chatSessionResult.json?.data?.id) {
    const sessionId = chatSessionResult.json.data.id;
    console.log(`   → 세션 ID: ${sessionId}`);
    logStep('챗봇 세션 생성', 'PASS', { sessionId });

    console.log('   → AI 응답 대기 중 (최대 60초)...');
    const chatResult = await apiCall('AI 채팅 메시지', `${BASE_URL}/api/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, message: '안녕하세요, 간단히 자기소개 해주세요.' })
    });

    if (chatResult.ok) {
      logStep('AI 챗봇 응답', 'PASS');
      if (chatResult.json?.data?.content) {
        console.log(`   → AI 응답: ${chatResult.json.data.content.substring(0, 100)}...`);
      }
    } else {
      logStep('AI 챗봇 응답', 'WARN', { message: '타임아웃 또는 API 오류' });
    }
  } else {
    logStep('챗봇 세션 생성', 'FAIL', { error: chatSessionResult.json?.error?.message });
  }

  // ============================================================
  // 5. LMS 기능 테스트
  // ============================================================
  console.log('\n\n📚 [5/7] LMS 기능 테스트');
  console.log('─'.repeat(50));

  const dashboardResult = await apiCall('LMS 대시보드', `${BASE_URL}/api/lms/dashboard`);
  logStep('LMS 대시보드', dashboardResult.ok ? 'PASS' : 'FAIL',
    dashboardResult.ok ? {} : { error: dashboardResult.json?.error?.message });

  const coursesResult = await apiCall('코스 목록', `${BASE_URL}/api/lms/courses`);
  if (coursesResult.ok) {
    logStep('코스 목록 조회', 'PASS');
    console.log(`   → 총 ${coursesResult.json?.data?.length || 0}개 코스`);
  } else {
    logStep('코스 목록 조회', 'FAIL', { error: coursesResult.json?.error?.message });
  }

  const assignmentsResult = await apiCall('과제 목록', `${BASE_URL}/api/lms/assignments`);
  logStep('과제 목록 조회', assignmentsResult.ok ? 'PASS' : 'FAIL');

  const feedbacksResult = await apiCall('피드백 목록', `${BASE_URL}/api/lms/feedbacks`);
  logStep('피드백 목록 조회', feedbacksResult.ok ? 'PASS' : 'FAIL');

  const jobsResult = await apiCall('피드백 작업 목록', `${BASE_URL}/api/lms/jobs`);
  logStep('피드백 작업 목록', jobsResult.ok ? 'PASS' : 'FAIL');

  // ============================================================
  // 6. 기획 도우미 테스트
  // ============================================================
  console.log('\n\n📋 [6/7] 기획 도우미 테스트');
  console.log('─'.repeat(50));

  console.log('   → AI 기획 생성 대기 중 (최대 90초)...');
  const plannerResult = await apiCall('기획 생성', `${BASE_URL}/api/planner/generate`, {
    method: 'POST',
    body: JSON.stringify({
      topic: '마그네틱 세일즈 무료 강의',
      targetAudience: '온라인 사업을 시작하려는 초보자',
      goal: '유료 강의 판매'
    })
  });

  if (plannerResult.ok) {
    logStep('기획 도우미', 'PASS');
  } else {
    logStep('기획 도우미', 'WARN', { message: '타임아웃 또는 API 오류' });
  }

  // ============================================================
  // 7. 로그아웃 테스트
  // ============================================================
  console.log('\n\n🚪 [7/7] 로그아웃 테스트');
  console.log('─'.repeat(50));

  const logoutResult = await apiCall('로그아웃', `${BASE_URL}/api/auth/logout`, {
    method: 'POST'
  });
  logStep('로그아웃', logoutResult.ok || logoutResult.status === 200 ? 'PASS' : 'WARN');

  // ============================================================
  // 결과 요약
  // ============================================================
  console.log('\n\n═══════════════════════════════════════════════════════════');
  console.log('  E2E 테스트 결과 요약');
  console.log('═══════════════════════════════════════════════════════════\n');

  const passed = testResults.steps.filter(s => s.status === 'PASS').length;
  const failed = testResults.steps.filter(s => s.status === 'FAIL').length;
  const warned = testResults.steps.filter(s => s.status === 'WARN').length;
  const total = testResults.steps.length;

  console.log(`📊 총 테스트: ${total}개`);
  console.log(`✅ 통과: ${passed}개`);
  console.log(`❌ 실패: ${failed}개`);
  console.log(`⚠️  경고: ${warned}개`);
  console.log(`\n🎯 성공률: ${Math.round((passed / total) * 100)}%`);

  if (failed > 0) {
    console.log('\n❌ 실패한 테스트:');
    testResults.steps.filter(s => s.status === 'FAIL').forEach(s => {
      console.log(`   - ${s.step}: ${s.error || 'Unknown error'}`);
    });
  }

  console.log('\n═══════════════════════════════════════════════════════════');

  return testResults;
}

runTest()
  .then(results => {
    console.log('\n📁 테스트 완료');
  })
  .catch(err => {
    console.error('테스트 실행 오류:', err);
  });
