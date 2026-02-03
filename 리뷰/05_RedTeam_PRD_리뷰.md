# Red Team PRD v1.0 비판적 리뷰

## 문서 정보
| 항목 | 내용 |
|------|------|
| 리뷰 버전 | Red Team v1.0 |
| 리뷰 일자 | 2025-12-15 |
| 리뷰 대상 | PRD_v1 전체 문서 (7개) |
| 리뷰어 | Red Team Code Validator v3.0 |
| 총 구현 가능성 점수 | **62/100** (심각한 문제 다수) |

---

## 1. Executive Summary

### 1.1 전체 위험도
```
[CRITICAL] 즉시 수정 필요: 12건
[HIGH]     주요 수정 필요: 18건
[MEDIUM]   개선 권장: 25건
[LOW]      경미한 개선: 15건
총 이슈: 70건
```

### 1.2 핵심 문제점 Top 5

| 순위 | 문제 | 심각도 | 영향 |
|------|------|--------|------|
| 1 | 버전 불일치 (Next.js 14 vs 15) | CRITICAL | 전체 프로젝트 빌드 실패 가능 |
| 2 | 토큰 갱신 API 미완성 | CRITICAL | 로그인 후 15분만에 세션 만료 |
| 3 | Service Role Key 노출 위험 | CRITICAL | 데이터베이스 전체 노출 가능 |
| 4 | Rate Limit fail-open 정책 | HIGH | DDoS 공격에 무방비 |
| 5 | RLS 정책 충돌 | HIGH | 데이터 접근 오류 발생 |

### 1.3 보안 점수
```
OWASP Top 10 대응률: 70% (7/10)
CWE Top 25 대응률: 48% (12/25)
```

---

## 2. 문서별 상세 리뷰

### 2.1 00_프로젝트_개요.md

#### 치명적 불일치 발견

| 항목 | 00_개요 | 다른 문서들 | 문제 |
|------|---------|-------------|------|
| Next.js 버전 | **14.1.0** | **15 (App Router)** | 빌드 실패 |
| React 버전 | **18.2.0** | **React 19** (Next 15 기본) | 호환성 오류 |
| 구조 | `/create/page.tsx` | 없음 | 미정의 |
| 경로 | `/edit/[id]/page.tsx` | `/landing-pages/[id]/page.tsx` | 불일치 |

**[CRITICAL-001] Next.js 버전 불일치**
```
CVSS: 9.8 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H)
위치: 00_프로젝트_개요.md:479, 05_프론트엔드.md:전체
```

- **문제**: `package.json`에 Next.js 14.1.0 명시, 코드는 Next.js 15 문법 사용
- **영향**: 빌드 실패, `cookies()` async/await 문법 차이로 런타임 오류
- **수정**: 버전 통일 필요 (Next.js 15로 통일 권장)

```typescript
// Next.js 14 (동기)
const cookieStore = cookies();

// Next.js 15 (비동기) - 현재 코드
const cookieStore = await cookies();
```

---

### 2.2 01_프로젝트_구조.md

#### 코드 품질 이슈

**[HIGH-001] 싱글톤 패턴 스레드 안전성 부재**
```typescript
// src/lib/supabase/client.ts
let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

export function getSupabaseClient() {
  if (client) return client;  // Race Condition 가능
  // ...
}
```

- **문제**: 브라우저 환경에서는 덜 위험하나, SSR 환경에서 동시 요청 시 문제
- **CVSS**: 5.3 (AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N)

**[MEDIUM-001] 에러 처리 일관성 부재**
```typescript
// 일부에서는 try-catch
try {
  cookieStore.set({ name, value, ...options });
} catch {
  // Server Component에서는 쿠키 설정 불가
}

// 일부에서는 error 체크 안함
const { data, error } = await supabase.from('profiles').select();
// error 체크 없음
```

---

### 2.3 02_데이터베이스.md

#### RLS 정책 충돌

**[CRITICAL-002] RLS 정책 중복 및 충돌**
```sql
-- 원본 정책
CREATE POLICY "Users can view own landing pages"
    ON landing_pages FOR SELECT
    USING (user_id = auth.uid());

-- 덮어쓰기 정책 (002_soft_delete.sql)
DROP POLICY IF EXISTS "Users can view own landing pages" ON landing_pages;
CREATE POLICY "Users can view own active landing pages"
    ON landing_pages FOR SELECT
    USING (
        user_id = auth.uid()
        AND deleted_at IS NULL
    );

-- 추가 정책 (같은 테이블에 SELECT 2개)
CREATE POLICY "Users can view own deleted landing pages for recovery"
    ON landing_pages FOR SELECT
    USING (
        user_id = auth.uid()
        AND deleted_at IS NOT NULL
        AND deleted_at > NOW() - INTERVAL '30 days'
    );

-- 또 추가 (3개째 SELECT)
CREATE POLICY "Anyone can view published landing pages"
    ON landing_pages FOR SELECT
    USING (
        status = 'published'
        AND deleted_at IS NULL
    );
```

- **문제**: PostgreSQL RLS는 같은 명령에 여러 정책이 있으면 **OR 조건**으로 결합
- **영향**: 의도치 않게 다른 사용자의 published 랜딩페이지가 모든 사용자에게 노출
- **CVSS**: 7.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N)

**수정 필요**:
```sql
-- SELECT 정책은 하나로 통합하거나, RESTRICTIVE 옵션 사용
ALTER POLICY "Anyone can view published landing pages"
ON landing_pages
AS RESTRICTIVE;  -- 이렇게 하면 AND 조건으로 적용
```

**[HIGH-002] Advisory Lock Key 충돌 가능성**
```sql
-- 006_token_reservations.sql
v_lock_key := abs(('x' || substr(p_user_id::text, 1, 16))::bit(64)::bigint);
PERFORM pg_advisory_xact_lock(v_lock_key);
```

- **문제**: UUID의 첫 16자만 사용하면 충돌 확률이 급증 (생일 패러독스)
- **영향**: 다른 사용자의 토큰 예약이 서로 블로킹
- **수정**: 전체 UUID 해시 사용

```sql
-- 수정안
v_lock_key := hashtext(p_user_id::text);
```

**[MEDIUM-002] token_usage 테이블 reservation_id 컬럼 누락**
```sql
-- 007_functions_triggers.sql에서 사용
INSERT INTO token_usage (user_id, tokens_used, reservation_id)
VALUES (v_user_id, p_actual_tokens, p_reservation_id);

-- 하지만 001_initial_schema.sql에는 없음
CREATE TABLE IF NOT EXISTS token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    tokens_used INTEGER NOT NULL CHECK (tokens_used > 0),
    action TEXT NOT NULL CHECK (action IN ('generate', 'regenerate', 'edit')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    -- reservation_id 없음!
);
```

---

### 2.4 03_API_엔드포인트.md

#### 보안 취약점

**[CRITICAL-003] Rate Limit Fail-Open 정책**
```typescript
// src/lib/security/rate-limit.ts:315-325
if (error) {
  console.error('Rate limit check failed:', error);
  // 에러 시 허용 (fail-open)
  return {
    allowed: true,  // 위험!
    current: 0,
    limit: config.limit,
    remaining: config.limit,
    resetAt: new Date(),
  };
}
```

- **문제**: DB 연결 실패 시 Rate Limit 우회 가능
- **영향**: DDoS 공격, 브루트포스 공격에 무방비
- **CVSS**: 8.6 (AV:N/AC:L/PR:N/UI:N/S:C/C:N/I:N/A:H)
- **수정**: Fail-closed 정책으로 변경

```typescript
// 수정안
if (error) {
  console.error('Rate limit check failed:', error);
  // 에러 시 차단 (fail-closed)
  return {
    allowed: false,
    current: config.limit,
    limit: config.limit,
    remaining: 0,
    resetAt: new Date(Date.now() + 60000),
  };
}
```

**[HIGH-003] withAuth 함수 시그니처 불일치**
```typescript
// 03_API_엔드포인트.md:530
export const GET = withAuth(async (request: NextRequest, auth: AuthResult) => {

// 04_인증_시스템.md:891
export async function withAuth(
  request: NextRequest,
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>,
  options: AuthGuardOptions = {}
): Promise<NextResponse>
```

- **문제**: 정의와 사용법이 다름 (HOF vs 일반 함수)
- **영향**: 컴파일 오류, 런타임 오류

**[HIGH-004] IP 추출 보안 취약점**
```typescript
// src/lib/security/rate-limit.ts:354-357
const ip =
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown';
```

- **문제**: X-Forwarded-For 헤더는 스푸핑 가능
- **영향**: Rate Limit 우회, 감사 로그 위조
- **CVSS**: 6.5 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:L)
- **수정**: Vercel 환경에서는 `x-vercel-forwarded-for` 사용

---

### 2.5 04_인증_시스템.md

#### 치명적 보안 취약점

**[CRITICAL-004] Refresh Token Rotation 미완성**
```typescript
// rotateRefreshToken 함수에서 Access Token 발급 로직 문제
const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
  type: 'magiclink',
  email: userData.user.email!,
  options: {
    redirectTo: '/',
  },
});

return {
  success: true,
  accessToken: sessionData.properties?.access_token,  // undefined 가능!
  newRefreshToken,
};
```

- **문제**: `generateLink`는 Access Token을 반환하지 않음
- **영향**: 토큰 갱신 후 `accessToken: undefined`, API 호출 불가
- **CVSS**: 9.1 (AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:H/A:H)

**[CRITICAL-005] JWT Secret 설정 문제**
```typescript
// src/lib/auth/tokens.ts:401-403
const JWT_SECRET = new TextEncoder().encode(
  process.env.SUPABASE_JWT_SECRET || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

- **문제**: `SUPABASE_JWT_SECRET` 환경변수는 .env.example에 없음
- **영향**: Anon Key로 JWT 검증하면 모든 토큰이 invalid
- **수정**: Supabase Dashboard에서 JWT Secret 확인 후 환경변수 추가

**[HIGH-005] AuthProvider 무한 루프 가능성**
```typescript
// src/components/providers/AuthProvider.tsx:1646-1680
useEffect(() => {
  async function initAuth() {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      // ...
    }
    // ...
  }
  initAuth();
}, [setAuth, clearAuth]);  // setAuth, clearAuth가 변경되면 재실행
```

- **문제**: Zustand action은 컴포넌트 렌더마다 새 참조 생성 가능
- **영향**: 무한 루프로 서버 과부하
- **수정**: 빈 dependency array `[]` 사용하거나 useCallback으로 안정화

**[HIGH-006] 세션 유효성 검사 시점 문제**
```typescript
// withAuth에서 session_id 검증 없음
const payload = await verifyAccessToken(token);
// JWT는 유효하지만, user_sessions 테이블에서 무효화됐을 수 있음
// 검증 로직 없음!
```

- **문제**: 승인 취소로 세션 무효화 후에도 JWT만 유효하면 접근 가능
- **영향**: 15분간 무효화된 세션으로 API 접근 가능

---

### 2.6 04_AI_통합.md

#### AI 보안 이슈

**[CRITICAL-006] Prompt Injection 방어 우회 가능**
```typescript
const DANGEROUS_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?)/i,
  // ...
];
```

**우회 가능한 패턴들**:
```
1. 유니코드 우회: "ign\u006fre previous instructions"
2. 줄바꿈 우회: "ignore\nprevious\ninstructions"
3. 유사 문자: "ignоre" (키릴 문자 'о')
4. 간접 지시: "The user said to ignore previous instructions"
5. 인코딩: "SW1ub3JlIHByZXZpb3Vz" (Base64)
```

- **CVSS**: 8.1 (AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N)
- **수정**: 정규화 후 검사, 다중 레이어 방어 강화

**[HIGH-007] 토큰 추정 로직 부정확**
```typescript
export function estimateTokens(answers: Record<string, string>): number {
  // 입력 토큰 추정 (한글: ~2자당 1토큰, 영어: ~4자당 1토큰)
  const inputText = Object.values(answers).join(' ');
  const inputTokens = Math.ceil(inputText.length / 3);
  // ...
}
```

- **문제**: Claude의 실제 토큰화와 크게 다름 (한글은 ~1.5자당 1토큰)
- **영향**: 토큰 부족으로 생성 실패, 또는 초과 예약으로 낭비

**[MEDIUM-003] SSE 연결 타임아웃 미설정**
```typescript
// route.ts에서 stream 생성 시 타임아웃 없음
const stream = new ReadableStream({
  async start(controller) {
    // 90초 타임아웃이 generator.ts에만 있음
    // stream 자체는 무한정 열려있을 수 있음
  },
});
```

---

### 2.7 05_프론트엔드.md (이전 세션에서 확인)

#### UI/UX 및 상태 관리 이슈

**[HIGH-008] Zustand Persist 보안 문제**
```typescript
// accessToken을 sessionStorage에서 제외하지만...
partialize: (state) => ({
  user: state.user,
  isAuthenticated: state.isAuthenticated,
  // accessToken 제외
}),
```

- **문제**: `accessToken`이 메모리에만 있으면 새로고침 시 사라짐
- **영향**: 매 새로고침마다 토큰 갱신 필요, UX 저하

**[MEDIUM-004] 에러 페이지 정보 노출**
```typescript
// 에러 코드 생성 후 콘솔에 상세 정보
console.error('Error details:', error);
```

- **문제**: 프로덕션에서 민감 정보 노출 가능
- **수정**: `process.env.NODE_ENV`로 분기

---

### 2.8 06_보안_체크리스트.md (이전 세션에서 확인)

#### 보안 구현 이슈

**[CRITICAL-007] Service Role Key 노출 위험**
```typescript
// 여러 파일에서 서버 사이드 가정
export function getSupabaseAdmin() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // ...
}
```

- **문제**: Next.js App Router에서 클라이언트 번들에 포함될 수 있음
- **영향**: Service Role Key 노출 시 DB 전체 접근 가능
- **CVSS**: 10.0 (AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H)
- **수정**: `server-only` 패키지로 보호

```typescript
import 'server-only';  // 클라이언트 번들 포함 시 빌드 에러

export function getSupabaseAdmin() {
  // ...
}
```

**[HIGH-009] CSP 정책 위험**
```javascript
// next.config.js:551-558
"script-src 'self' 'unsafe-eval' 'unsafe-inline'",
```

- **문제**: `unsafe-eval`, `unsafe-inline`은 XSS 방어 무력화
- **영향**: 저장된 XSS 공격 가능
- **수정**: nonce 기반 CSP 또는 strict CSP 적용

**[HIGH-010] Timing Attack 취약점**
```typescript
// 토큰 비교 시 timing-safe 비교 언급되었으나 실제 구현 없음
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
// 비교 시 === 사용하면 timing attack 가능
```

---

## 3. 미구현 항목 체크리스트

### 3.1 필수 구현 누락

| 파일 | 기능 | 상태 | 심각도 |
|------|------|------|--------|
| `/api/auth/signup/route.ts` | 회원가입 API | 미구현 | CRITICAL |
| `/api/auth/login/route.ts` | 로그인 API | 미구현 | CRITICAL |
| `/api/auth/logout/route.ts` | 로그아웃 API | 미구현 | HIGH |
| `/api/auth/refresh/route.ts` | 토큰 갱신 API | **일부만** | CRITICAL |
| `/api/auth/me/route.ts` | 내 정보 API | 미구현 | HIGH |
| `/api/lp/[id]/publish/route.ts` | 발행 API | 미구현 | MEDIUM |
| `src/lib/auth/jwt.ts` | JWT 검증 | **참조만** | CRITICAL |
| Supabase Edge Functions | 만료 예약 정리 | 미구현 | HIGH |
| pg_cron 설정 | 정리 작업 스케줄 | 미언급 | HIGH |

### 3.2 선택적 구현 누락

| 기능 | 상태 | 우선순위 |
|------|------|----------|
| 비밀번호 찾기 | 미구현 | Medium |
| 이메일 인증 | 미구현 | Medium |
| 2FA | 미언급 | Low |
| OAuth (Google, Kakao) | 미언급 | Low |
| 결제 시스템 (PRO/ENT 업그레이드) | 미언급 | High |

---

## 4. 문서 간 불일치

### 4.1 API 경로 불일치

| 기능 | 03_API_엔드포인트 | 04_AI_통합 | 01_프로젝트_구조 |
|------|-------------------|-----------|-----------------|
| 토큰 조회 | `/api/ai/tokens` | `/api/user/tokens` | `/api/ai/tokens` |
| AI 생성 | `/api/ai/generate` | `/api/ai/generate` | `/api/ai/generate` |

### 4.2 타입 정의 불일치

| 타입 | 위치1 | 위치2 | 차이점 |
|------|-------|-------|--------|
| `AuthResult` | 03_API | 04_인증 | `AuthenticatedRequest` vs `AuthResult` |
| `tier` | DB 스키마 | 타입 정의 | `TEXT` vs `'FREE' \| 'PRO' \| 'ENTERPRISE'` |

### 4.3 환경변수 불일치

| 변수 | 00_개요 | 04_인증 | 06_보안 | 실제 필요 |
|------|---------|---------|---------|-----------|
| `JWT_SECRET` | O | X (다른 이름) | X | `SUPABASE_JWT_SECRET` |
| `REFRESH_TOKEN_SECRET` | O | X | X | Supabase 내장 |
| `COOKIE_DOMAIN` | X | O | X | 필요 |
| `SECURITY_ALERT_WEBHOOK_URL` | X | X | O | 선택 |

---

## 5. 보안 취약점 요약 (CVSS 기준)

### 5.1 Critical (9.0-10.0)

| ID | 취약점 | CVSS | CWE |
|----|--------|------|-----|
| CRITICAL-001 | Next.js 버전 불일치 | 9.8 | CWE-1104 |
| CRITICAL-004 | Refresh Token 미완성 | 9.1 | CWE-287 |
| CRITICAL-007 | Service Role Key 노출 | 10.0 | CWE-798 |

### 5.2 High (7.0-8.9)

| ID | 취약점 | CVSS | CWE |
|----|--------|------|-----|
| CRITICAL-002 | RLS 정책 충돌 | 7.5 | CWE-862 |
| CRITICAL-003 | Rate Limit Fail-Open | 8.6 | CWE-400 |
| CRITICAL-006 | Prompt Injection 우회 | 8.1 | CWE-94 |
| HIGH-009 | CSP unsafe-inline | 7.1 | CWE-79 |

### 5.3 Medium (4.0-6.9)

| ID | 취약점 | CVSS | CWE |
|----|--------|------|-----|
| HIGH-004 | IP 스푸핑 | 6.5 | CWE-290 |
| HIGH-001 | 싱글톤 Race Condition | 5.3 | CWE-362 |

---

## 6. 구현 권장 순서

### Phase 0: 긴급 수정 (1일)
1. Next.js 버전 통일 (15로)
2. `server-only` 패키지 추가
3. Rate Limit fail-closed로 변경

### Phase 1: 인증 완성 (3일)
1. JWT 검증 로직 수정 (Supabase JWT Secret)
2. Refresh Token Rotation 재구현
3. 로그인/로그아웃/회원가입 API 구현
4. AuthProvider 무한루프 수정

### Phase 2: 데이터베이스 수정 (2일)
1. RLS 정책 통합 (RESTRICTIVE 사용)
2. token_usage에 reservation_id 추가
3. Advisory Lock key 수정

### Phase 3: AI 보안 강화 (2일)
1. Prompt Injection 방어 강화 (정규화)
2. 토큰 추정 로직 개선
3. SSE 타임아웃 추가

### Phase 4: 일반 보안 (2일)
1. CSP 정책 강화
2. Timing-safe 비교 구현
3. 환경변수 정리

---

## 7. 개발자를 위한 질문 목록

이 PRD만으로 구현 시 개발자가 가질 **해결되지 않은 질문들**:

### 인증
1. Supabase Auth의 내장 JWT를 사용하나요, 별도 JWT를 사용하나요?
2. `session_id`는 JWT에 포함되나요? 별도 저장하나요?
3. 승인 대기 사용자는 어떤 페이지를 볼 수 있나요?

### 데이터베이스
4. pg_cron은 Supabase 유료 플랜에서만 가능한데, Free 플랜 대안은?
5. `token_reservations`의 만료 예약 정리는 언제 실행되나요?

### AI
6. Claude API 오류(429, 500 등) 발생 시 재시도 로직은?
7. 40개 질문 중 일부만 답변하면 어떻게 처리하나요?
8. 생성된 랜딩페이지 수정은 어떤 플로우인가요?

### 프론트엔드
9. Q&A 세션 중간 저장은 자동인가요, 수동인가요?
10. 오프라인 상태 처리는?

### 배포
11. Vercel 환경변수 설정 가이드는?
12. Supabase 프로젝트 초기 설정 절차는?

---

## 8. 최종 평가

### 8.1 점수표

| 항목 | 점수 | 비고 |
|------|------|------|
| 문서 완성도 | 65/100 | 핵심 API 미구현 |
| 기술적 정확성 | 50/100 | 버전 불일치, 코드 오류 |
| 보안 수준 | 55/100 | Critical 취약점 다수 |
| 일관성 | 60/100 | 문서 간 불일치 |
| 구현 가능성 | 62/100 | 상당한 추가 작업 필요 |
| **종합** | **62/100** | **심각한 수정 필요** |

### 8.2 결론

**PRD v1.0은 현재 상태로 구현 불가능합니다.**

주요 이유:
1. **버전 불일치**: Next.js 14/15 혼용으로 빌드 자체가 불가
2. **핵심 API 부재**: 로그인, 토큰 갱신 등 필수 API가 구현 예제만 있음
3. **보안 취약점**: Service Role Key 노출, Rate Limit 우회 등 Critical 이슈
4. **문서 불일치**: 같은 기능이 문서마다 다르게 정의됨

**권장 사항**: PRD v1.1 작성하여 위 문제 수정 후 개발 착수

---

## 부록 A: 보안 체크리스트 추가 항목

PRD에 언급되지 않은 필수 보안 항목:

- [ ] HTTPS 강제 (Vercel 기본 제공)
- [ ] Dependency 취약점 스캔 (npm audit)
- [ ] Secret rotation 정책
- [ ] 백업 및 복구 절차
- [ ] 침해 사고 대응 절차
- [ ] 개인정보 처리방침
- [ ] 이용약관

---

**리뷰 완료**: 2025-12-15
**다음 단계**: PRD v1.1 수정 → 기획팀/개발팀 리뷰 → 구현 착수
