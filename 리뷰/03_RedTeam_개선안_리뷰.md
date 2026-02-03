# Red Team 개선안 리뷰

## 리뷰 개요

| 항목 | 내용 |
|------|------|
| 리뷰 일시 | 2025-12-15 |
| 대상 | Blue Team 개선안 v1 (02_BlueTeam_개선안_v1.md) |
| 리뷰어 | Red Team Code Validator v3.0 |
| 검토 방법론 | CWE Top 25 + OWASP Top 10 + 구현 실현성 분석 |

---

## Executive Summary

### 전체 평가: 부분 승인 (Conditional Approval)

Blue Team 개선안은 전반적으로 원본 이슈들을 인지하고 대응하려는 노력이 보이나, **다음과 같은 심각한 문제가 발견됨**:

| 문제 유형 | 개수 | 심각도 |
|-----------|------|--------|
| 원래 이슈 미해결 | 4 | CRITICAL |
| 새로운 보안 취약점 유발 | 3 | HIGH |
| 구현 현실성 문제 | 5 | MEDIUM |
| 누락된 고려사항 | 6 | MEDIUM |
| 예상 공수 과소평가 | 8 | LOW |

---

## 개선안 평가 요약

| 개선안 ID | 원래 이슈 해결 | 새 문제 유발 | 구현 현실성 | 종합 평가 |
|-----------|---------------|-------------|------------|----------|
| CRITICAL-API-001 (CORS) | Partial | Yes | Yes | **수정필요** |
| CRITICAL-API-002 (환경변수) | Yes | No | Yes | **승인** |
| CRITICAL-API-003 (토큰제한) | Partial | Yes | Partial | **재설계** |
| HIGH-SEC-001 (JWT만료) | Partial | Yes | Yes | **수정필요** |
| HIGH-SEC-002 (SQL Injection) | Partial | No | No | **재설계** |
| HIGH-PERF-001 (스트리밍) | Yes | No | Yes | **승인** |
| HIGH-DB-001 (approved 필드) | Yes | No | Yes | **승인** |
| HIGH-PERF-002 (타임아웃복구) | Partial | No | Yes | **수정필요** |
| HIGH-UX-001 (Rate Limiting) | Yes | No | Partial | **수정필요** |
| MEDIUM-API-001 (API 버전) | Yes | No | Yes | **승인** |
| MEDIUM-DB-002 (Soft Delete) | Partial | Yes | Yes | **수정필요** |
| MEDIUM-SEC-003 (XSS) | Yes | No | Yes | **승인** |
| MEDIUM-UX-002 (오프라인) | No | No | No | **재설계** |
| MEDIUM-UX-003 (스킵기본값) | Yes | No | Yes | **승인** |

---

## 1. 승인 가능한 개선안

### [CRITICAL-API-002] 환경변수 관리 - APPROVED

Blue Team의 Zod 스키마 기반 환경변수 검증 접근법은 적절함.

**인정 사항**:
- 타입 안전한 환경변수 접근
- 런타임 검증으로 배포 전 에러 발견
- `.env.example` 템플릿 제공으로 온보딩 용이

**추가 권장 (선택)**:
```typescript
// 민감 정보 마스킹 로그 추가
console.log('Environment loaded:', {
  ...Object.keys(parsed.data).reduce((acc, key) => ({
    ...acc,
    [key]: key.includes('KEY') || key.includes('SECRET') ? '***' : 'OK'
  }), {})
});
```

---

### [HIGH-PERF-001] 스트리밍 에러 핸들링 - APPROVED

재시도 로직, 타임아웃 처리, 사용자 친화적 에러 메시지 모두 적절함.

**인정 사항**:
- 지수 백오프 재시도 (1초, 2초, 3초)
- AbortController 기반 타임아웃
- HTTP 상태 코드별 에러 메시지 분기

---

### [HIGH-DB-001] approved 필드 기본값 - APPROVED

NOT NULL + DEFAULT false 제약조건 추가는 올바른 접근.

---

### [MEDIUM-API-001] API 버전 관리 - APPROVED

버전 없는 요청을 v1으로 리다이렉트하는 미들웨어 접근법 적절함.

---

### [MEDIUM-SEC-003] XSS 방어 - APPROVED

DOMPurify 설정이 합리적이나, **href 속성의 javascript: URL 필터링이 누락됨** (원본 이슈 HIGH-SEC-003).

```typescript
// Blue Team 코드에 추가 필요
ALLOWED_URI_REGEXP: /^(?:https?|mailto|tel):/i,  // javascript: 차단
```

---

### [MEDIUM-UX-003] 40질문 스킵 기본값 - APPROVED

질문별 기본값과 스킵 메시지 정의가 UX 측면에서 적절함.

---

## 2. 수정 필요한 개선안

### [CRITICAL-API-001] CORS 화이트리스트

**문제점 1: Staging 환경 와일드카드 취약점**

```typescript
staging: [
  'https://staging.magnetic-sales.com',
  'https://preview-*.vercel.app'  // 위험!
],
```

- `preview-*.vercel.app` 패턴은 **공격자가 `preview-malicious.vercel.app` 도메인 생성 가능**
- Vercel 무료 플랜에서 누구나 서브도메인 생성 가능
- **CVSS 6.5** (Medium) - AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N

**수정 요구**:
```typescript
staging: [
  'https://staging.magnetic-sales.com',
  // Vercel 배포 URL은 명시적으로 관리
  // process.env.VERCEL_URL 사용 또는 특정 프로젝트 ID 기반 패턴
  `https://${process.env.VERCEL_PROJECT_ID}-*.vercel.app`
],
```

**문제점 2: origin null 처리 누락**

```typescript
const origin = request.headers.get('origin') || '';
```

- 파일 프로토콜(`file://`)이나 브라우저 확장에서 origin이 null일 수 있음
- 빈 문자열로 대체 시 화이트리스트 검증 우회 가능

**수정 요구**:
```typescript
const origin = request.headers.get('origin');
if (!origin) {
  // CORS preflight가 아닌 경우 허용 (same-origin 요청)
  // 또는 명시적 차단
  return NextResponse.next(); // 또는 403
}
```

---

### [CRITICAL-API-003] AI 토큰 사용량 제한

**문제점 1: Race Condition in 토큰 집계**

```typescript
// 현재 구현
const { data: dailyData } = await supabase
  .from('ai_usage_logs')
  .select('input_tokens, output_tokens')
  .eq('user_id', this.userId)
  .gte('created_at', today);

const currentDailyUsage = (dailyData || []).reduce(...);
```

- 동시 요청 시 두 요청 모두 한도 미만으로 통과할 수 있음
- 예: 한도 50,000 토큰, 현재 사용량 45,000
  - 요청 A: 10,000 토큰 요청 -> 45,000 < 50,000 -> 통과
  - 요청 B: 10,000 토큰 요청 -> 45,000 < 50,000 -> 통과
  - 결과: 65,000 토큰 사용 (한도 초과)

**수정 요구**: 원자적 연산 사용

```sql
-- PostgreSQL Advisory Lock 또는 FOR UPDATE 사용
CREATE OR REPLACE FUNCTION check_and_record_usage(
  p_user_id UUID,
  p_estimated_tokens INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_current_usage INTEGER;
  v_daily_limit INTEGER;
  v_result JSONB;
BEGIN
  -- 행 레벨 락 획득
  SELECT COALESCE(SUM(input_tokens + output_tokens), 0)
  INTO v_current_usage
  FROM ai_usage_logs
  WHERE user_id = p_user_id
    AND created_at >= CURRENT_DATE
  FOR UPDATE;  -- 동시성 제어

  -- 한도 확인 (users 테이블에서 tier 기반 한도 조회 필요)
  v_daily_limit := 50000; -- 기본값, 실제로는 동적 조회

  IF v_current_usage + p_estimated_tokens > v_daily_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', v_daily_limit - v_current_usage
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', v_daily_limit - v_current_usage - p_estimated_tokens
  );
END;
$$ LANGUAGE plpgsql;
```

**문제점 2: 예상 토큰 계산 부정확**

```typescript
const estimatedInputTokens = JSON.stringify(messages).length / 4;
```

- Claude의 토크나이저는 단순 문자열 길이 / 4가 아님
- 한글의 경우 1자당 2-3토큰 소비 (영어는 ~0.25토큰/문자)
- 실제 사용량과 예상량 차이가 2-3배 발생 가능

**수정 요구**:
```typescript
// tiktoken 또는 claude-tokenizer 사용
import { countTokens } from '@anthropic-ai/tokenizer';

const estimatedInputTokens = countTokens(JSON.stringify(messages));
```

**문제점 3: FREE tier 한도가 너무 낮음**

```typescript
free: { daily: 50000, monthly: 500000 },
```

- 40개 질문 완료 시 예상 토큰: ~30,000-50,000 (Red Team 원본 리뷰 참조)
- FREE tier 사용자는 **하루에 1회 기획 대화만 가능**
- 오류로 재시작 시 당일 사용 불가

**수정 요구**: FREE tier 일일 한도 최소 100,000 토큰으로 상향

---

### [HIGH-SEC-001] JWT 토큰 만료/갱신

**문제점 1: Refresh Token 무제한 사용 가능**

```typescript
export async function refreshTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  const payload = await verifyToken(refreshToken);
  if (!payload) return null;

  // 새 토큰 쌍 발급 - Refresh Token도 새로 발급
  const newAccessToken = await generateAccessToken(payload);
  const newRefreshToken = await generateRefreshToken(payload);
  // ...
}
```

- Refresh Token 탈취 시 공격자가 무한정 새 토큰 발급 가능
- 원본 사용자가 로그아웃해도 탈취된 Refresh Token으로 계속 접근

**수정 요구**: Refresh Token Rotation + DB 저장

```typescript
// 1. Refresh Token을 DB에 저장
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  token_hash TEXT NOT NULL, -- bcrypt hash
  expires_at TIMESTAMPTZ NOT NULL,
  revoked BOOLEAN DEFAULT false,
  replaced_by UUID REFERENCES refresh_tokens(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

// 2. 갱신 시 기존 토큰 무효화 + 새 토큰 발급
export async function refreshTokens(refreshToken: string) {
  // DB에서 토큰 조회
  const { data: tokenRecord } = await supabase
    .from('refresh_tokens')
    .select('*')
    .eq('token_hash', hashToken(refreshToken))
    .single();

  if (!tokenRecord || tokenRecord.revoked) {
    // 토큰 재사용 감지 - 모든 세션 무효화
    if (tokenRecord?.revoked) {
      await revokeAllUserTokens(tokenRecord.user_id);
    }
    return null;
  }

  // 기존 토큰 무효화
  await supabase
    .from('refresh_tokens')
    .update({ revoked: true, replaced_by: newTokenId })
    .eq('id', tokenRecord.id);

  // 새 토큰 발급 및 저장
  // ...
}
```

**문제점 2: 클라이언트 토큰 저장 위치 불안전**

```typescript
persist(
  (set, get) => ({...}),
  {
    name: 'auth-storage',
    partialize: (state) => ({
      refreshToken: state.refreshToken, // localStorage에 저장됨!
    }),
  }
)
```

- Zustand persist는 기본적으로 localStorage 사용
- XSS 공격 시 localStorage의 Refresh Token 탈취 가능

**수정 요구**: Refresh Token은 HttpOnly 쿠키로 전환

```typescript
// API 응답에서 쿠키로 설정
response.cookies.set('refresh_token', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60, // 7일
  path: '/api/auth',
});
```

---

### [HIGH-PERF-002] 랜딩페이지 생성 타임아웃

**문제점: 5분 타임아웃은 UX에 부정적**

```typescript
// 최대 5분 타임아웃
const timeoutId = setTimeout(() => {
  clearInterval(pollInterval);
  onError('생성 시간이 초과되었습니다. 다시 시도해주세요.');
}, 300000);
```

- 원본 요구사항: "60초 이내 생성"
- 5분 대기는 사용자 이탈 유발
- 타임아웃 후 이미 진행 중인 백그라운드 작업은 계속 실행됨 (리소스 낭비)

**수정 요구**:
```typescript
// 1. 90초 타임아웃으로 축소
const timeoutId = setTimeout(() => {
  clearInterval(pollInterval);
  // 백그라운드 작업도 취소
  fetch(`/api/jobs/${jobId}/cancel`, { method: 'POST' });
  onError('생성 시간이 초과되었습니다. 입력 내용을 줄여서 다시 시도해주세요.');
}, 90000);

// 2. 진행률 기반 동적 타임아웃
if (job.progress > 50 && Date.now() - startTime > 60000) {
  // 50% 이상 진행된 경우 추가 30초 부여
  extendTimeout(30000);
}
```

---

### [HIGH-UX-001] Rate Limiting

**문제점 1: Upstash 의존성 비용**

```typescript
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL!,
  token: process.env.UPSTASH_REDIS_TOKEN!,
});
```

- Upstash Redis는 유료 서비스
- MVP 단계에서 추가 비용 발생
- 원본 기획에서 Supabase만 사용하기로 결정

**수정 요구**: Supabase 기반 Rate Limiting 대안 제시

```typescript
// Supabase 함수 기반 Rate Limiting
export async function checkRateLimit(
  userId: string,
  endpoint: string,
  limit: number,
  windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: userId,
    p_endpoint: endpoint,
    p_limit: limit,
    p_window_ms: windowMs,
  });

  if (error) {
    // fail-closed: 에러 시 차단
    return { allowed: false, remaining: 0 };
  }

  return data;
}

-- PostgreSQL 함수
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit INTEGER,
  p_window_ms INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - (p_window_ms || ' milliseconds')::INTERVAL;

  SELECT COUNT(*) INTO v_count
  FROM api_requests
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND created_at >= v_window_start;

  IF v_count >= p_limit THEN
    RETURN jsonb_build_object('allowed', false, 'remaining', 0);
  END IF;

  -- 요청 기록
  INSERT INTO api_requests (user_id, endpoint, created_at)
  VALUES (p_user_id, p_endpoint, NOW());

  RETURN jsonb_build_object('allowed', true, 'remaining', p_limit - v_count - 1);
END;
$$ LANGUAGE plpgsql;
```

**문제점 2: 익명 사용자 식별 미흡**

```typescript
const identifier =
  request.headers.get('x-user-id') ||
  request.ip ||
  request.headers.get('x-forwarded-for') ||
  'anonymous';
```

- VPN/프록시 사용 시 같은 IP로 여러 사용자 차단
- x-forwarded-for 헤더는 조작 가능
- 'anonymous' fallback은 모든 익명 요청이 같은 버킷 공유

**수정 요구**:
```typescript
const identifier = (() => {
  // 1. 인증된 사용자: user_id 사용
  if (request.headers.get('x-user-id')) {
    return `user:${request.headers.get('x-user-id')}`;
  }

  // 2. 익명 사용자: IP + User-Agent fingerprint
  const ip = request.ip || request.headers.get('x-real-ip') || 'unknown';
  const ua = request.headers.get('user-agent') || 'unknown';
  const fingerprint = crypto.createHash('sha256')
    .update(`${ip}:${ua}`)
    .digest('hex')
    .slice(0, 16);

  return `anon:${fingerprint}`;
})();
```

---

### [MEDIUM-DB-002] 소프트 삭제

**문제점: RLS 정책 미수정**

```sql
-- Blue Team 제안
CREATE VIEW active_landing_pages AS
SELECT * FROM landing_pages WHERE deleted_at IS NULL;
```

- VIEW 생성만으로는 기존 RLS 정책이 적용되지 않음
- 삭제된 데이터도 여전히 직접 쿼리로 접근 가능

**수정 요구**: RLS 정책에 soft delete 조건 추가

```sql
-- 기존 RLS 정책 수정
DROP POLICY IF EXISTS "Users can view own landing pages" ON landing_pages;

CREATE POLICY "Users can view own active landing pages"
  ON landing_pages
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND deleted_at IS NULL  -- 소프트 삭제 조건 추가
  );

-- 삭제된 항목 조회는 별도 정책
CREATE POLICY "Users can view own deleted landing pages"
  ON landing_pages
  FOR SELECT
  USING (
    user_id = auth.uid()
    AND deleted_at IS NOT NULL
    AND deleted_at > NOW() - INTERVAL '30 days'  -- 30일 이내만
  );
```

---

## 3. 재설계 필요한 개선안

### [HIGH-SEC-002] SQL Injection 방어

**근본적 문제: 불필요한 추상화 + 실효성 부족**

Blue Team의 `SafeQueryBuilder` 클래스는:

1. **Supabase가 이미 Prepared Statement 사용**
   - Supabase SDK는 내부적으로 parameterized query 사용
   - 추가 래퍼 클래스는 복잡성만 증가

2. **화이트리스트 유지보수 부담**
   ```typescript
   const columnWhitelist: Record<string, string[]> = {
     users: ['id', 'email', 'name', 'approved', 'created_at'],
     // 테이블/컬럼 추가마다 수동 업데이트 필요
   };
   ```
   - 스키마 변경 시 화이트리스트 동기화 필수
   - 누락 시 정상 기능 실패

3. **실제 SQL Injection 위험 지점 미식별**
   - Raw SQL 사용처 (있다면) 미파악
   - RPC 함수 내부 동적 쿼리 검토 없음

**재설계 방향**:

```typescript
// 1. Supabase SDK 만 사용 (이미 안전)
const { data } = await supabase
  .from('projects')
  .select('*')
  .eq('user_id', userId)
  .ilike('title', `%${keyword}%`);  // 이미 parameterized

// 2. Raw SQL 필요 시 RPC 함수로 캡슐화
-- DB에 함수 정의
CREATE FUNCTION search_projects(
  p_user_id UUID,
  p_keyword TEXT
) RETURNS SETOF projects AS $$
  SELECT * FROM projects
  WHERE user_id = p_user_id
    AND title ILIKE '%' || p_keyword || '%';
$$ LANGUAGE SQL SECURITY DEFINER;

// 3. 입력 검증은 Zod로 통합
const searchSchema = z.object({
  keyword: z.string().max(100).regex(/^[\w\s가-힣]+$/),
});
```

---

### [MEDIUM-UX-002] 오프라인 지원

**근본적 문제: MVP 범위 초과 + 기술적 복잡도**

1. **원본 요구사항에 오프라인 지원 없음**
   - 00_요구사항_정의서.md 확인 결과 오프라인 기능 요구 없음
   - MVP 범위 확대로 일정 지연 위험

2. **AI 기반 앱에서 오프라인 의미 제한적**
   - AI 기획 도우미, 랜딩페이지 생성 모두 서버 의존
   - 오프라인에서 핵심 기능 사용 불가

3. **구현 복잡도 과소평가**
   - Service Worker + IndexedDB + Sync 로직
   - 예상 공수 2일은 비현실적 (최소 5일)

**재설계 방향**:

```markdown
## MVP 범위에서 제외

오프라인 지원은 Phase 2로 연기하고,
MVP에서는 다음만 구현:

1. 네트워크 상태 감지 및 안내
   - 오프라인 시 "인터넷 연결이 필요합니다" 안내

2. 입력 중 데이터 로컬 백업 (브라우저 세션 내)
   - sessionStorage 활용
   - 새로고침/복귀 시 복원

3. Phase 2 로드맵에 PWA 전환 계획 추가
```

---

## 4. 새롭게 발견된 이슈

### [NEW-CRITICAL-001] Red Team 원본 이슈 4건 미대응

Blue Team 개선안에서 다음 CRITICAL 이슈들이 **완전히 누락됨**:

| 원본 이슈 ID | 내용 | 현재 상태 |
|-------------|------|----------|
| CRITICAL-UX-001 | 승인 전후 세션 관리 취약 | **미대응** |
| CRITICAL-DB-001 | 소프트 삭제 미구현 | 부분 대응 (RLS 누락) |
| CRITICAL-DB-002 | 감사 로그(Audit Log) 부재 | **미대응** |
| CRITICAL-AI-001 | 프롬프트 인젝션 방어 미구현 | **미대응** |

**즉시 추가 필요**:

```typescript
// 1. 승인 상태 변경 시 세션 무효화
async function onApprovalChange(userId: string, approved: boolean) {
  // 모든 기존 세션/토큰 무효화
  await supabase
    .from('refresh_tokens')
    .update({ revoked: true })
    .eq('user_id', userId);

  // 새 JWT 발급 강제
  await supabase.auth.admin.signOut(userId);
}

// 2. 감사 로그 테이블 (원본 리뷰에서 제안한 그대로)
CREATE TABLE audit_logs (...);

// 3. 프롬프트 인젝션 방어
function sanitizeUserInput(input: string): string {
  const dangerousPatterns = [
    /ignore\s+(previous|all)\s+instructions/i,
    /system\s+prompt/i,
    /reveal\s+your\s+instructions/i,
  ];
  for (const pattern of dangerousPatterns) {
    if (pattern.test(input)) {
      throw new Error('Invalid input detected');
    }
  }
  return input;
}
```

---

### [NEW-HIGH-001] 예상 공수 대폭 과소평가

| 개선안 | Blue Team 예상 | Red Team 재평가 | 차이 |
|--------|---------------|-----------------|------|
| CRITICAL-API-003 (토큰제한) | 1일 | 3일 | +200% |
| HIGH-SEC-001 (JWT) | 1일 | 2.5일 | +150% |
| HIGH-PERF-002 (비동기큐) | 2일 | 4일 | +100% |
| MEDIUM-UX-002 (오프라인) | 2일 | 5일+ | +150% |
| 총계 | 18.5일 | **32일 (6.5주)** | +73% |

**원인 분석**:
- 테스트 코드 작성 시간 미반영
- 코드 리뷰/수정 사이클 미반영
- 인프라 설정 (Upstash, Vercel 환경변수 등) 미반영
- 문서화 시간 미반영

---

### [NEW-HIGH-002] 기술 스택 불일치

Blue Team 개선안에서 사용된 기술이 원본 기획과 불일치:

| 원본 기획 | Blue Team 제안 | 문제 |
|-----------|---------------|------|
| Supabase만 사용 | Upstash Redis 추가 | 비용 증가, 복잡도 증가 |
| Next.js App Router | 미명시 | 라우팅 패턴 혼란 |
| Vercel 배포 | Vercel Edge Config 언급 | Pro 플랜 필요 |

**권장**: 기술 스택 결정 문서(02_기술스택_결정.md) 참조하여 일관성 유지

---

### [NEW-MEDIUM-001] 에러 코드 체계 부재 지속

Blue Team이 LOW-DOC-001을 "0.5일 공수로 에러 코드 체계화"라고 했으나, **실제 체계 제안 없음**.

**즉시 정의 필요**:

```typescript
// src/lib/errors/codes.ts
export const ERROR_CODES = {
  // 인증 (1xxx)
  AUTH_INVALID_CREDENTIALS: { code: 1001, message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
  AUTH_NOT_APPROVED: { code: 1002, message: '계정 승인 대기 중입니다.' },
  AUTH_SESSION_EXPIRED: { code: 1003, message: '세션이 만료되었습니다. 다시 로그인해주세요.' },

  // AI (2xxx)
  AI_RATE_LIMITED: { code: 2001, message: '일일 사용량 한도에 도달했습니다.' },
  AI_CONTEXT_TOO_LONG: { code: 2002, message: '대화가 너무 깁니다. 새 대화를 시작해주세요.' },
  AI_GENERATION_FAILED: { code: 2003, message: 'AI 응답 생성에 실패했습니다.' },

  // 프로젝트 (3xxx)
  PROJ_NOT_FOUND: { code: 3001, message: '프로젝트를 찾을 수 없습니다.' },
  PROJ_LIMIT_EXCEEDED: { code: 3002, message: '프로젝트 생성 한도에 도달했습니다.' },

  // 일반 (9xxx)
  GENERAL_VALIDATION_ERROR: { code: 9001, message: '입력값이 올바르지 않습니다.' },
  GENERAL_INTERNAL_ERROR: { code: 9999, message: '서버 오류가 발생했습니다.' },
} as const;
```

---

## 5. 최종 권장사항

### 즉시 조치 필요 (Phase 0 - 48시간 내)

1. **CRITICAL 누락 이슈 4건 대응 계획 수립**
   - 승인 세션 관리
   - 감사 로그
   - 프롬프트 인젝션 방어
   - 소프트 삭제 RLS

2. **CORS 와일드카드 패턴 제거**
   - `preview-*.vercel.app` -> 명시적 URL

3. **토큰 제한 Race Condition 수정**
   - DB 레벨 원자적 연산 도입

### 단기 조치 (Week 1)

1. **Refresh Token 보안 강화**
   - HttpOnly 쿠키 전환
   - Token Rotation 구현

2. **Rate Limiting 재설계**
   - Supabase 기반으로 변경 (Upstash 제거)

3. **예상 공수 재산정**
   - 32일 (6.5주) 기준으로 일정 조정

### 중기 조치 (Week 2-4)

1. **오프라인 지원 Phase 2로 연기**
   - MVP 범위에서 제외
   - 네트워크 상태 안내만 구현

2. **SQL Injection 방어 단순화**
   - SafeQueryBuilder 제거
   - Supabase SDK 직접 사용 + Zod 검증

3. **문서 정합성 확보**
   - 에러 코드 체계 정의
   - 기술 스택 문서 동기화

---

## 결론

| 항목 | 평가 |
|------|------|
| Blue Team 노력 인정 | 23개 개선안 중 6개 승인 (26%) |
| 수정 필요 | 7개 (30%) |
| 재설계 필요 | 3개 (13%) |
| 미대응 CRITICAL | 4건 (즉시 대응 필요) |
| 예상 공수 차이 | +73% (18.5일 -> 32일) |

**종합 판정**: **조건부 승인 (Conditional Approval)**

Blue Team은 다음을 완료한 후 2차 리뷰 요청해야 함:
1. 누락된 CRITICAL 4건 대응안 추가
2. 수정 필요 항목 7건 반영
3. 재설계 항목 3건 새 설계안 제출
4. 예상 공수 현실화 (32일 기준)

---

## 문서 정보

| 항목 | 내용 |
|------|------|
| 작성일 | 2025-12-15 |
| 작성자 | Red Team Code Validator v3.0 |
| 리뷰 대상 | Blue Team 개선안 v1 |
| 발견 이슈 | 신규 3건, 수정 필요 7건, 재설계 필요 3건 |
| 다음 단계 | Blue Team 2차 개선안 제출 대기 |

---

*"Finding vulnerabilities before attackers do"*

*Red Team Code Validator v3.0 - Elite Security Expert System*
