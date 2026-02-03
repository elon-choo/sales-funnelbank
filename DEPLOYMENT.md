# 세퍼마 LMS 배포 가이드

> **상태**: 배포 준비 완료 (CEO 승인 대기)
> **최종 업데이트**: 2026-02-03

---

## 1. 배포 전 체크리스트

### 1.1 코드 검증 ✅
- [x] TypeScript 타입 체크 통과
- [x] 47개 테스트 통과
- [x] TODO/FIXME 해결 완료
- [x] 보안 검증 (82/100점)

### 1.2 환경변수 준비

`.env.local` 또는 Vercel Environment Variables에 설정:

```bash
# === 필수 환경변수 ===

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...  # 서버 전용

# Anthropic API (AI 피드백)
ANTHROPIC_API_KEY=sk-ant-...

# Vercel Cron Secret
CRON_SECRET_FEEDBACK=랜덤_시크릿_32자이상

# Supabase Edge Function URL
SUPABASE_EDGE_FUNCTION_URL=https://[project-ref].supabase.co/functions/v1

# === 선택 환경변수 ===

# 앱 URL (인증 리다이렉트)
NEXT_PUBLIC_APP_URL=https://your-domain.com

# Sentry (에러 모니터링)
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# Redis (세션 캐싱, 선택)
REDIS_URL=redis://...
```

### 1.3 Supabase 설정

#### 데이터베이스 마이그레이션
```bash
# Supabase CLI 설치
npm install -g supabase

# 로그인
supabase login

# 마이그레이션 실행 (프로덕션)
supabase db push --project-ref [your-project-ref]
```

#### Edge Function 배포
```bash
# Edge Function 배포
supabase functions deploy generate-feedback --project-ref [your-project-ref]

# 환경변수 설정
supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref [your-project-ref]
supabase secrets set CRON_SECRET_FEEDBACK=... --project-ref [your-project-ref]
```

#### Storage 버킷 설정
```sql
-- Supabase SQL Editor에서 실행
INSERT INTO storage.buckets (id, name, public)
VALUES ('assignment-files', 'assignment-files', false);

-- RLS 정책 (011_storage_setup.sql 참조)
```

---

## 2. Vercel 배포

### 2.1 Vercel 프로젝트 생성

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. "Add New Project" 클릭
3. Git 저장소 연결 (GitHub/GitLab)
4. Framework Preset: **Next.js**

### 2.2 환경변수 설정

Vercel Dashboard > Project Settings > Environment Variables:

| 변수명 | Environment |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | Production (Encrypted) |
| `ANTHROPIC_API_KEY` | Production (Encrypted) |
| `CRON_SECRET_FEEDBACK` | Production (Encrypted) |
| `SUPABASE_EDGE_FUNCTION_URL` | Production |

### 2.3 빌드 설정

Vercel Dashboard > Project Settings > Build & Development:

```yaml
Framework Preset: Next.js
Build Command: npm run build
Output Directory: .next
Install Command: npm install
```

### 2.4 Cron 설정

`vercel.json`이 이미 설정되어 있음:

```json
{
  "crons": [{
    "path": "/api/cron/process-feedback",
    "schedule": "* * * * *"
  }]
}
```

**주의**: Vercel Pro 플랜 이상에서만 Cron 지원 (무료 플랜은 1일 1회)

### 2.5 도메인 연결

1. Vercel Dashboard > Project Settings > Domains
2. 커스텀 도메인 추가 (예: `lms.yourdomain.com`)
3. DNS 설정:
   - CNAME: `cname.vercel-dns.com` (서브도메인)
   - A: `76.76.21.21` (루트 도메인)

---

## 3. 프로덕션 보안 설정

### 3.1 CORS 설정

Supabase Dashboard > Project Settings > API:
- Allowed Origins: `https://your-domain.com`

### 3.2 Rate Limiting

Vercel에서 기본 Rate Limiting 적용됨.
추가 설정 필요 시 Vercel Enterprise 또는 Cloudflare 사용.

### 3.3 HTTP 보안 헤더

`next.config.ts`에 이미 설정됨:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### 3.4 Supabase RLS 확인

모든 테이블에 RLS 정책 활성화 확인:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

---

## 4. 배포 후 검증

### 4.1 헬스체크

```bash
# API 헬스체크
curl https://your-domain.com/api/health

# LMS API 테스트
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/lms/dashboard
```

### 4.2 Cron 동작 확인

Vercel Dashboard > Project > Cron Jobs에서:
- 1분마다 실행 로그 확인
- 에러 발생 시 알림 설정

### 4.3 AI 피드백 테스트

1. 학생 계정으로 로그인
2. 과제 제출
3. 피드백 생성 확인 (1-2분 소요)
4. 비용 추적 확인 (관리자 대시보드)

---

## 5. 모니터링

### 5.1 Vercel Analytics

- Core Web Vitals 모니터링
- 에러 트래킹
- 성능 메트릭

### 5.2 Sentry 연동 (권장)

```bash
# Sentry 패키지 설치
npm install @sentry/nextjs

# 설정
npx @sentry/wizard@latest -i nextjs
```

### 5.3 AI 비용 모니터링

관리자 대시보드에서 확인:
- 월별 AI 비용
- 모델별 사용량
- 예산 초과 알림 설정 (system_settings)

---

## 6. 롤백 절차

### 6.1 Vercel 롤백

```bash
# 이전 배포로 롤백
vercel rollback [deployment-url]

# 또는 Vercel Dashboard에서 클릭 롤백
```

### 6.2 데이터베이스 롤백

```bash
# Supabase 마이그레이션 롤백
supabase db reset --project-ref [your-project-ref]

# 특정 버전으로 복원 (백업 필요)
```

---

## 7. 비용 예측

### 7.1 Vercel

| 플랜 | 월 비용 | 특징 |
|------|---------|------|
| Hobby | 무료 | Cron 1회/일 |
| Pro | $20/사용자 | Cron 무제한 |

### 7.2 Supabase

| 플랜 | 월 비용 | 특징 |
|------|---------|------|
| Free | 무료 | 500MB DB, 2GB Storage |
| Pro | $25 | 8GB DB, 100GB Storage |

### 7.3 AI 비용 (Anthropic)

| 모델 | 피드백당 비용 | 월 예상 (1000건) |
|------|--------------|-----------------|
| Claude Sonnet 4 | $0.27 | $270 |
| Claude Opus 4.5 | $1.35 | $1,350 |

**예산 상한**: $800/월 (system_settings에서 관리)

---

## 8. 긴급 연락처

- **Vercel 지원**: support@vercel.com
- **Supabase 지원**: support@supabase.io
- **Anthropic 지원**: support@anthropic.com

---

*이 문서는 배포 담당자를 위한 가이드입니다.*
*실제 배포는 CEO 승인 후 진행합니다.*
