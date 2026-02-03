# Magnetic Sales WebApp - PRD 개요

## 문서 정보

| 항목 | 내용 |
|------|------|
| 문서 버전 | 1.0 |
| 작성일 | 2025-12-15 |
| 작성자 | AI Development Team |
| 상태 | Final |
| 기반 문서 | 기획_v2 (Red/Blue Team 승인 완료) |

---

## 1. 프로젝트 개요

### 1.1 제품 비전

**"AI 기반 마그네틱 세일즈 랜딩페이지 자동 생성 SaaS"**

비개발자도 40개 질문에 답변하면, AI가 검증된 마그네틱 세일즈 프레임워크를 적용하여 전환율 높은 랜딩페이지를 자동으로 생성해주는 서비스입니다.

### 1.2 핵심 가치 제안

| 가치 | 설명 | 측정 지표 |
|------|------|----------|
| **간편함** | 복잡한 기술 지식 없이 질문 답변만으로 완성 | 평균 완료 시간 < 30분 |
| **효과성** | 검증된 마그네틱 세일즈 18단계 프레임워크 적용 | 전환율 업계 평균 대비 2x |
| **경제성** | 전문 카피라이터 대비 90% 이상 비용 절감 | 제작 비용 < $50 |
| **보안성** | 엔터프라이즈급 보안 아키텍처 | OWASP Top 10 준수 |

### 1.3 타겟 사용자

```yaml
Primary:
  - 1인 창업자 / 프리랜서
  - 소규모 비즈니스 운영자 (직원 10명 미만)

Secondary:
  - 마케터 / 세일즈 담당자
  - 코칭/컨설팅 서비스 제공자
  - 온라인 교육 콘텐츠 크리에이터
```

---

## 2. 프로젝트 범위

### 2.1 MVP 기능 (Phase 1)

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 회원가입/로그인 | Supabase Auth + 관리자 수동 승인 | P0 |
| JWT Token Rotation | HttpOnly Cookie + Refresh Token Rotation | P0 |
| AI 질문/답변 | 40개 질문 단계별 진행 (6 Phase, 18 Step) | P0 |
| 랜딩페이지 생성 | DESIRE-MAGNETIC 공식 적용 | P0 |
| 랜딩페이지 편집 | TipTap WYSIWYG 에디터 | P0 |
| 미리보기/배포 | 고유 URL 생성 (slug 기반) | P0 |
| 대시보드 | 생성 이력, 토큰 사용량 표시 | P0 |
| Soft Delete + 복구 | 30일 이내 복구 기능 | P1 |
| 감사 로그 | 전체 이벤트 기록 | P1 |
| Rate Limiting | PostgreSQL 기반 요청 제한 | P1 |

### 2.2 Phase 2 기능 (추후 개발)

| 기능 | 설명 | 예상 일정 |
|------|------|----------|
| A/B 테스트 | 랜딩페이지 변형 테스트 | Q2 2025 |
| 분석 대시보드 | 방문자 통계, 전환 추적 | Q2 2025 |
| 커스텀 도메인 | 사용자 도메인 연결 | Q2 2025 |
| 팀 협업 | 멀티 사용자 지원 | Q3 2025 |
| API 공개 | 외부 연동 API | Q3 2025 |

### 2.3 제외 범위 (Out of Scope)

- 결제 시스템 (MVP에서 제외, 수동 결제 처리)
- 이메일 마케팅 자동화
- CRM 연동
- 모바일 앱

---

## 3. 기술 스택

### 3.1 프론트엔드

```typescript
// package.json 핵심 의존성
{
  "dependencies": {
    "next": "14.x",           // App Router 사용
    "react": "18.x",
    "typescript": "5.x",
    "tailwindcss": "3.x",
    "zustand": "4.x",         // 상태 관리
    "zod": "3.x",             // 스키마 검증
    "@tiptap/react": "2.x",   // WYSIWYG 에디터
    "dompurify": "3.x"        // XSS 방어 (v2 강화 설정)
  }
}
```

### 3.2 백엔드 (BaaS)

```yaml
Provider: Supabase
Database: PostgreSQL 15
  - Row Level Security (RLS)
  - Advisory Lock (토큰 동시성 제어)
  - Soft Delete 패턴
Auth: Supabase Auth
  - JWT 기반
  - 수동 승인 시스템
  - Refresh Token Rotation
Storage: Supabase Storage
  - 이미지 업로드
  - 사이즈 제한: 5MB
Rate Limiting: PostgreSQL 기반 (v2)
  - Upstash Redis에서 전환
  - check_rate_limit() 함수
```

### 3.3 AI

```yaml
Provider: Anthropic Claude API
Model: claude-3-5-sonnet-20241022
Features:
  - Streaming (SSE)
  - 2-Phase Token Management (Reserve -> Confirm)
  - Multi-layer Prompt Injection Defense
Token Limits:
  FREE: 100,000 tokens/day
  PRO: 500,000 tokens/day
  ENTERPRISE: 2,000,000 tokens/day
```

### 3.4 인프라

```yaml
Hosting: Vercel
  - Edge Network CDN
  - Serverless Functions
  - Preview Deployments
Monitoring:
  - Vercel Analytics
  - Sentry (Error Tracking)
  - Slack Webhook (보안 알림)
CI/CD:
  - GitHub Actions
  - Vercel 자동 배포
```

---

## 4. 보안 아키텍처 (v2)

### 4.1 해결된 CRITICAL 이슈

| ID | 이슈 | v1 문제점 | v2 해결책 |
|----|------|-----------|-----------|
| CRITICAL-API-001 | CORS 와일드카드 | Origin 스푸핑 가능 | 명시적 도메인 화이트리스트 + Sec-Fetch-Site 검증 |
| CRITICAL-API-003 | AI 토큰 Race Condition | 음수 토큰 가능 | PostgreSQL Advisory Lock (`pg_advisory_xact_lock`) |
| CRITICAL-UX-001 | 세션 관리 미흡 | 승인 취소 후 서비스 이용 가능 | `approval_changed_at` 기반 전체 세션 무효화 |
| CRITICAL-DB-001 | Hard Delete | 실수 복구 불가 | Soft Delete (`deleted_at`) + 30일 복구 기간 |

### 4.2 보안 정책 요약

```yaml
Authentication:
  Access Token 만료: 15분
  Refresh Token 만료: 7일
  Refresh Token 저장: HttpOnly Cookie
  Token Rotation: 적용 (재사용 감지)

Authorization:
  CORS Origin: 명시적 화이트리스트 (와일드카드 금지)
  Rate Limit: 엔드포인트별 차등 적용
  RLS: 모든 테이블 활성화 + deleted_at 조건

Data Protection:
  삭제 데이터 복구: 30일 이내 가능
  감사 로그: 전체 이벤트 기록 (90일 보관)
  Prompt Injection 방어: 3레이어 (입력/시스템/출력)
```

---

## 5. 데이터베이스 스키마 요약

### 5.1 테이블 목록

| 테이블명 | 설명 | v2 변경 |
|----------|------|---------|
| `profiles` | 사용자 프로필 | `deleted_at` 추가 |
| `landing_pages` | 랜딩페이지 | `deleted_at` 추가 |
| `qa_sessions` | Q&A 세션 | `deleted_at` 추가 |
| `token_usage` | 토큰 사용 기록 | - |
| `token_reservations` | 토큰 예약 (2-Phase) | **신규** |
| `refresh_tokens` | Refresh Token 관리 | **신규** |
| `audit_logs` | 감사 로그 | **신규** |
| `user_sessions` | 세션 관리 | **신규** |
| `rate_limits` | Rate Limit 카운터 | **신규** |

### 5.2 ER 다이어그램 (핵심)

```
profiles (1) ----< (N) landing_pages
    |
    +----< (N) refresh_tokens
    |
    +----< (N) qa_sessions
    |
    +----< (N) token_usage / token_reservations
    |
    +----< (N) audit_logs / user_sessions
```

---

## 6. API 엔드포인트 요약

### 6.1 인증 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/auth/signup` | 회원가입 |
| POST | `/api/auth/login` | 로그인 (HttpOnly Cookie 발급) |
| POST | `/api/auth/refresh` | 토큰 갱신 (Rotation) |
| POST | `/api/auth/logout` | 로그아웃 |
| POST | `/api/auth/logout-all` | 전체 로그아웃 |

### 6.2 AI API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/ai/chat` | AI 대화 (SSE) |
| POST | `/api/ai/generate` | 랜딩페이지 생성 |
| GET | `/api/ai/tokens` | 토큰 사용량 조회 |

### 6.3 랜딩페이지 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/lp` | 목록 조회 |
| POST | `/api/lp` | 생성 |
| GET | `/api/lp/:id` | 상세 조회 |
| PATCH | `/api/lp/:id` | 수정 |
| DELETE | `/api/lp/:id` | Soft Delete |
| POST | `/api/lp/:id/restore` | 복구 |
| POST | `/api/lp/:id/publish` | 발행 |

---

## 7. 프로젝트 일정

### 7.1 Phase별 일정

| Phase | 기간 | 주요 작업 | 산출물 |
|-------|------|----------|--------|
| **Phase 1** | Week 1 | 보안 기반 구축 | CORS, JWT Cookie, Token Rotation, Rate Limiting |
| **Phase 2** | Week 2 | 데이터베이스 | Soft Delete, 신규 테이블, RLS 업데이트, Advisory Lock |
| **Phase 3** | Week 3 | AI 통합 | Prompt Injection 방어, 2-Phase 토큰, 출력 검증 |
| **Phase 4** | Week 4 | 테스트 및 배포 | 보안 테스트, 성능 테스트, UAT, 문서화 |

### 7.2 총 예상 일정

| 구분 | 예상 기간 |
|------|----------|
| Red Team 추정 | 32일 |
| Blue Team 추정 | 18.5일 |
| **합의 일정** | **25일 (버퍼 포함)** |

### 7.3 마일스톤

```
Week 1 (Day 1-7):
├── Day 1-2: 프로젝트 초기 설정, 환경 구성
├── Day 3-4: CORS 미들웨어, Rate Limiting 구현
└── Day 5-7: JWT HttpOnly Cookie, Token Rotation

Week 2 (Day 8-14):
├── Day 8-9: DB 마이그레이션 (Soft Delete, 신규 테이블)
├── Day 10-11: RLS 정책 업데이트
└── Day 12-14: 인증 플로우 완성

Week 3 (Day 15-21):
├── Day 15-16: AI API 통합 (Claude)
├── Day 17-18: 2-Phase 토큰 관리
└── Day 19-21: Prompt Injection 방어

Week 4 (Day 22-25):
├── Day 22: 보안 테스트
├── Day 23: 성능 테스트
├── Day 24: UAT
└── Day 25: 프로덕션 배포
```

---

## 8. 팀 구성 및 역할

### 8.1 권장 팀 구성

| 역할 | 인원 | 주요 업무 |
|------|------|----------|
| Tech Lead | 1명 | 아키텍처 설계, 코드 리뷰, 보안 검토 |
| Frontend Developer | 1-2명 | Next.js, React, UI/UX 구현 |
| Backend Developer | 1명 | Supabase, API, 보안 구현 |
| QA Engineer | 1명 | 테스트 계획, 보안 테스트 |
| DevOps | 0.5명 | CI/CD, 배포, 모니터링 |

### 8.2 최소 구성 (Solo Developer)

```yaml
필수_역량:
  - Next.js 14 (App Router) 경험
  - Supabase (PostgreSQL, Auth, RLS) 이해
  - TypeScript 숙련
  - 보안 기본 지식 (OWASP Top 10)

예상_일정_조정:
  - 권장 일정: 25일
  - Solo Developer: 40-50일 (버퍼 포함)
```

---

## 9. 성공 지표 (KPI)

### 9.1 기술 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 페이지 로드 시간 | < 2초 | Vercel Analytics |
| API 응답 시간 | < 500ms (p95) | Vercel Functions |
| 에러율 | < 0.1% | Sentry |
| 보안 취약점 | 0 CRITICAL | OWASP ZAP |

### 9.2 비즈니스 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 랜딩페이지 생성 완료율 | > 70% | DB 집계 |
| 평균 생성 시간 | < 30분 | 세션 분석 |
| 월간 활성 사용자 (MAU) | TBD | 사용자 분석 |
| 유료 전환율 | TBD | 결제 데이터 |

---

## 10. 위험 요소 및 대응

### 10.1 기술적 위험

| 위험 | 영향 | 확률 | 대응 방안 |
|------|------|------|----------|
| Claude API 장애 | High | Low | 재시도 로직, 사용자 알림 |
| Supabase 장애 | Critical | Very Low | 읽기 전용 모드 전환 |
| 토큰 고갈 | Medium | Medium | 사용량 알림, 자동 제한 |

### 10.2 보안 위험

| 위험 | 대응 방안 | 모니터링 |
|------|----------|----------|
| Prompt Injection | 3레이어 방어 | 출력 검증 로그 |
| 토큰 탈취 | Rotation + 재사용 감지 | audit_logs |
| Rate Limit 우회 | IP + User ID 복합 제한 | rate_limits 테이블 |

---

## 11. PRD 문서 목록

| 번호 | 파일명 | 설명 |
|------|--------|------|
| 00 | `00_PRD_개요.md` | 프로젝트 개요, 범위, 기술 스택 (본 문서) |
| 01 | `01_프로젝트_구조.md` | 폴더 구조, 네이밍 컨벤션, 모듈 분리 |
| 02 | `02_DB_마이그레이션.md` | Supabase 테이블 생성 SQL, RLS, 인덱스, 시드 데이터 |
| 03 | `03_API_명세.md` | 모든 API 엔드포인트, Request/Response 타입, 에러 코드 |
| 04 | `04_인증_시스템.md` | Supabase Auth, JWT 토큰 관리, 세션 관리, 승인 시스템 |
| 05 | `05_AI_통합.md` | Claude API 연동, 프롬프트 관리, 스트리밍, 토큰 사용량 추적 |
| 06 | `06_프론트엔드.md` | 페이지 컴포넌트, 상태 관리 (Zustand), 라우팅, UI 컴포넌트 |
| 07 | `07_보안_체크리스트.md` | 보안 기능, 코드 레벨 보안 패턴, 환경 변수 |
| 08 | `08_테스트_전략.md` | 단위 테스트, 통합 테스트, E2E 테스트 케이스 |
| 09 | `09_배포_가이드.md` | Vercel 배포, 환경 변수, CI/CD 파이프라인 |

---

## 12. 승인 및 변경 이력

### 12.1 승인 이력

| 일자 | 버전 | 검토자 | 결과 |
|------|------|--------|------|
| 2025-12-15 | v1.0 | CTO | 승인 |

### 12.2 변경 이력

| 버전 | 일자 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| v1.0 | 2025-12-15 | 초기 문서 작성 | AI Team |

---

**다음 문서: [01_프로젝트_구조.md](./01_프로젝트_구조.md)**
