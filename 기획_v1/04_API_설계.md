# 마그네틱 세일즈 웹앱 - API 설계서

## 문서 정보
| 항목 | 내용 |
|------|------|
| 버전 | 1.0 |
| 작성일 | 2025-12-15 |
| 작성자 | API 문서화 전문가 (75_api_documentation_writer_v8) |
| 상태 | Draft |

---

## 1. API 아키텍처 개요

### 1.1 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────────┐
│                        프론트엔드 (React + Vite)                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌─────────────────────────────┐    ┌─────────────────────────────────┐
│   Supabase Client SDK       │    │     Supabase Edge Functions     │
│   (직접 호출)                │    │     (서버리스 API)              │
├─────────────────────────────┤    ├─────────────────────────────────┤
│ - Authentication (Auth)     │    │ - AI 대화 (Claude API)          │
│ - Database CRUD (PostgreSQL)│    │ - 랜딩페이지 HTML 생성          │
│ - Storage (이미지 업로드)   │    │ - 프롬프트 생성                 │
│ - Realtime (실시간 업데이트)│    │ - 세일즈 챗봇                   │
└─────────────────────────────┘    └─────────────────────────────────┘
                    │                               │
                    │                               │
                    ▼                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Supabase Backend Services                         │
├─────────────────────────────────────────────────────────────────────┤
│  PostgreSQL (RLS)  │  Auth Service  │  Storage  │  Edge Runtime     │
└─────────────────────────────────────────────────────────────────────┘
                                                    │
                                                    ▼
                                    ┌─────────────────────────────────┐
                                    │        Claude API (Anthropic)   │
                                    │   claude-3-5-sonnet-20241022    │
                                    └─────────────────────────────────┘
```

### 1.2 API 호출 방식 결정

| 기능 영역 | 호출 방식 | 이유 |
|-----------|-----------|------|
| 인증 (Auth) | Supabase Client 직접 호출 | SDK 기본 제공, RLS 자동 적용 |
| 데이터 CRUD | Supabase Client 직접 호출 | RLS 기반 권한 관리, 실시간 지원 |
| 이미지 업로드 | Supabase Storage 직접 호출 | SDK 기본 제공, CDN 자동 적용 |
| AI 대화 | Edge Function | API 키 보호, 시스템 프롬프트 은닉 |
| HTML 생성 | Edge Function | 복잡한 프롬프트 처리, 결과 검증 |

### 1.3 인증 방식

```
JWT 기반 인증 (Supabase Auth)

1. 로그인 요청 → Supabase Auth → JWT Access Token 발급
2. 클라이언트가 JWT를 Authorization 헤더에 포함
3. Supabase Client: 자동으로 JWT 관리
4. Edge Function: Authorization 헤더에서 JWT 추출 후 검증
```

**JWT 구조:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "authenticated",
  "user_metadata": {
    "is_approved": true,
    "approved_at": "2025-01-01T00:00:00Z"
  },
  "exp": 1234567890
}
```

---

## 2. 엔드포인트 목록

### 2.1 전체 엔드포인트 맵

| 구분 | 메서드 | 경로 | 설명 | 인증 | 우선순위 |
|------|--------|------|------|------|----------|
| **인증** | | | | | |
| | POST | `/auth/v1/signup` | 회원가입 | X | P0 |
| | POST | `/auth/v1/token?grant_type=password` | 로그인 | X | P0 |
| | POST | `/auth/v1/logout` | 로그아웃 | O | P0 |
| | POST | `/auth/v1/recover` | 비밀번호 재설정 요청 | X | P1 |
| | PUT | `/auth/v1/user` | 비밀번호 변경 | O | P1 |
| **프로젝트** | | | | | |
| | GET | `/rest/v1/projects` | 프로젝트 목록 조회 | O | P0 |
| | POST | `/rest/v1/projects` | 프로젝트 생성 | O | P0 |
| | GET | `/rest/v1/projects?id=eq.{id}` | 프로젝트 상세 조회 | O | P0 |
| | PATCH | `/rest/v1/projects?id=eq.{id}` | 프로젝트 수정 | O | P0 |
| | DELETE | `/rest/v1/projects?id=eq.{id}` | 프로젝트 삭제 | O | P1 |
| **대화 기록** | | | | | |
| | GET | `/rest/v1/conversations` | 대화 목록 조회 | O | P0 |
| | POST | `/rest/v1/conversations` | 대화 생성 | O | P0 |
| | GET | `/rest/v1/messages?conversation_id=eq.{id}` | 메시지 조회 | O | P0 |
| | POST | `/rest/v1/messages` | 메시지 저장 | O | P0 |
| **AI 기능 (Edge Functions)** | | | | | |
| | POST | `/functions/v1/ai-chat` | AI 기획 도우미 대화 | O | P0 |
| | POST | `/functions/v1/generate-prompt` | 랜딩페이지 프롬프트 생성 | O | P0 |
| | POST | `/functions/v1/generate-landing` | 랜딩페이지 HTML 생성 | O | P0 |
| | POST | `/functions/v1/sales-chat` | 마그네틱 세일즈 챗봇 | O | P0 |
| **스토리지** | | | | | |
| | POST | `/storage/v1/object/images/{path}` | 이미지 업로드 | O | P0 |
| | GET | `/storage/v1/object/public/images/{path}` | 이미지 조회 | X | P0 |
| | DELETE | `/storage/v1/object/images/{path}` | 이미지 삭제 | O | P1 |
| **관리자** | | | | | |
| | GET | `/rest/v1/pending_users` | 승인 대기 사용자 조회 | O (관리자) | P0 |
| | PATCH | `/rest/v1/users?id=eq.{id}` | 사용자 승인 | O (관리자) | P0 |

---

## 3. Edge Functions 상세 정의

### 3.1 AI 기획 도우미 대화

#### `POST /functions/v1/ai-chat`

AI 기획 도우미와의 대화를 처리합니다. 마그네틱 세일즈 철학이 반영된 시스템 프롬프트를 사용합니다.

**요청 헤더:**
```http
POST /functions/v1/ai-chat HTTP/1.1
Host: {project-ref}.supabase.co
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**요청 본문 (Request Body):**
```json
{
  "conversation_id": "uuid-string",
  "message": "보험 설계사인데 고객 DB를 모으고 싶어요",
  "context": {
    "industry": "보험",
    "target_audience": "30-40대 가장",
    "current_step": 1
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| conversation_id | string (UUID) | O | 대화 세션 ID (없으면 신규 생성) |
| message | string | O | 사용자 메시지 (최대 2000자) |
| context | object | X | 대화 컨텍스트 정보 |
| context.industry | string | X | 사용자 업종 |
| context.target_audience | string | X | 타겟 고객층 |
| context.current_step | number | X | 현재 기획 단계 (1-5) |

**응답 본문 (Response Body) - 성공:**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_uuid",
    "response": "보험 설계사시군요! 마그네틱 세일즈의 핵심은 '끌어당김'입니다. 먼저 몇 가지 질문을 드릴게요...",
    "metadata": {
      "tokens_used": 245,
      "model": "claude-3-5-sonnet-20241022",
      "suggested_questions": [
        "주로 어떤 보험 상품을 판매하시나요?",
        "현재 고객 확보 방법은 무엇인가요?"
      ],
      "progress": {
        "current_step": 1,
        "total_steps": 5,
        "completed_items": ["업종 확인"]
      }
    }
  },
  "error": null
}
```

**응답 본문 (Response Body) - 스트리밍:**
```
event: message
data: {"delta": "보험 설계사시군요! "}

event: message
data: {"delta": "마그네틱 세일즈의 "}

event: message
data: {"delta": "핵심은 '끌어당김'입니다."}

event: done
data: {"message_id": "msg_uuid", "tokens_used": 245}
```

**에러 응답:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AI_RATE_LIMIT",
    "message": "AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
    "details": {
      "retry_after": 60
    }
  }
}
```

---

### 3.2 랜딩페이지 프롬프트 생성

#### `POST /functions/v1/generate-prompt`

대화 내용을 바탕으로 랜딩페이지 생성용 프롬프트를 자동 생성합니다.

**요청 본문 (Request Body):**
```json
{
  "conversation_id": "uuid-string",
  "additional_requirements": "무료 상담 신청 버튼 강조",
  "template_type": "lead_capture"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| conversation_id | string (UUID) | O | 대화 세션 ID |
| additional_requirements | string | X | 추가 요구사항 |
| template_type | enum | X | 템플릿 유형 (lead_capture, sales, webinar) |

**응답 본문 (Response Body) - 성공:**
```json
{
  "success": true,
  "data": {
    "prompt_id": "prompt_uuid",
    "generated_prompt": "당신은 보험 설계사를 위한 랜딩페이지를 제작합니다...",
    "summary": {
      "industry": "보험",
      "target_audience": "30-40대 가장",
      "value_proposition": "가족 보장 플랜",
      "cta": "무료 상담 신청"
    },
    "required_images": [
      {
        "section": "hero",
        "description": "신뢰감 있는 가족 이미지",
        "recommended_size": "1920x1080"
      },
      {
        "section": "benefits",
        "description": "보장 혜택 아이콘 3개",
        "recommended_size": "200x200"
      }
    ],
    "estimated_sections": 5
  },
  "error": null
}
```

**에러 응답:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "PROMPT_INSUFFICIENT_DATA",
    "message": "대화 내용이 부족합니다. 최소 3회 이상의 대화가 필요합니다.",
    "details": {
      "required_messages": 3,
      "current_messages": 1
    }
  }
}
```

---

### 3.3 랜딩페이지 HTML 생성

#### `POST /functions/v1/generate-landing`

프롬프트와 이미지를 기반으로 완성된 랜딩페이지 HTML을 생성합니다.

**요청 본문 (Request Body):**
```json
{
  "project_id": "uuid-string",
  "prompt": "당신은 보험 설계사를 위한 랜딩페이지를 제작합니다...",
  "images": [
    {
      "section": "hero",
      "url": "https://xxx.supabase.co/storage/v1/object/public/images/hero.jpg"
    },
    {
      "section": "benefits",
      "url": "https://xxx.supabase.co/storage/v1/object/public/images/benefit1.png"
    }
  ],
  "options": {
    "style": "modern",
    "color_scheme": "blue",
    "include_google_form": true,
    "google_form_url": "https://forms.google.com/..."
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| project_id | string (UUID) | O | 프로젝트 ID |
| prompt | string | O | 생성 프롬프트 (최대 5000자) |
| images | array | O | 업로드된 이미지 목록 |
| images[].section | string | O | 이미지가 사용될 섹션 |
| images[].url | string (URL) | O | 이미지 URL |
| options | object | X | 생성 옵션 |
| options.style | enum | X | 스타일 (modern, classic, minimal) |
| options.color_scheme | string | X | 색상 테마 |
| options.include_google_form | boolean | X | 구글 폼 포함 여부 |
| options.google_form_url | string (URL) | X | 구글 폼 URL |

**응답 본문 (Response Body) - 성공:**
```json
{
  "success": true,
  "data": {
    "landing_page_id": "landing_uuid",
    "html": "<!DOCTYPE html><html>...",
    "preview_url": "https://xxx.supabase.co/storage/v1/object/public/pages/preview_uuid.html",
    "sections": [
      {
        "id": "hero",
        "title": "Hero Section",
        "editable": true
      },
      {
        "id": "benefits",
        "title": "혜택 섹션",
        "editable": true
      }
    ],
    "metadata": {
      "tokens_used": 3500,
      "generation_time_ms": 4500,
      "html_size_kb": 45
    }
  },
  "error": null
}
```

**스트리밍 응답 (실시간 생성):**
```
event: section
data: {"section": "hero", "html": "<section id='hero'>...", "progress": 20}

event: section
data: {"section": "benefits", "html": "<section id='benefits'>...", "progress": 40}

event: section
data: {"section": "testimonials", "html": "<section id='testimonials'>...", "progress": 60}

event: section
data: {"section": "cta", "html": "<section id='cta'>...", "progress": 80}

event: section
data: {"section": "footer", "html": "<footer>...", "progress": 100}

event: done
data: {"landing_page_id": "landing_uuid", "preview_url": "https://..."}
```

**에러 응답:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AI_GENERATION_FAILED",
    "message": "랜딩페이지 생성에 실패했습니다.",
    "details": {
      "reason": "Invalid image format",
      "failed_section": "hero"
    }
  }
}
```

---

### 3.4 마그네틱 세일즈 챗봇

#### `POST /functions/v1/sales-chat`

마그네틱 세일즈 기법 상담 및 세일즈 스크립트 피드백을 제공합니다.

**요청 본문 (Request Body):**
```json
{
  "conversation_id": "uuid-string",
  "message": "콜드콜 스크립트 피드백 부탁드려요",
  "mode": "feedback",
  "attachment": {
    "type": "script",
    "content": "안녕하세요, 저는 OO보험의 김철수입니다..."
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| conversation_id | string (UUID) | O | 대화 세션 ID |
| message | string | O | 사용자 메시지 |
| mode | enum | X | 모드 (chat, feedback, coaching) |
| attachment | object | X | 첨부 자료 |
| attachment.type | enum | X | 첨부 유형 (script, recording_transcript) |
| attachment.content | string | X | 첨부 내용 |

**응답 본문 (Response Body) - 성공:**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_uuid",
    "response": "스크립트를 분석해보겠습니다. 마그네틱 세일즈 관점에서...",
    "feedback": {
      "overall_score": 72,
      "strengths": [
        "친근한 인사로 시작",
        "명확한 자기소개"
      ],
      "improvements": [
        {
          "original": "좋은 상품 소개드리려고 연락드렸습니다",
          "suggestion": "고객님의 가족 보장에 대해 함께 고민해보고 싶어서 연락드렸습니다",
          "reason": "상품 중심이 아닌 고객 가치 중심으로 전환"
        }
      ],
      "magnetic_tips": [
        "첫 15초에 고객의 관심을 '끌어당기는' 질문을 던지세요",
        "거절 처리보다 공감으로 대화를 이어가세요"
      ]
    },
    "metadata": {
      "tokens_used": 680,
      "model": "claude-3-5-sonnet-20241022"
    }
  },
  "error": null
}
```

---

## 4. Supabase 직접 호출 API

### 4.1 인증 (Authentication)

#### 4.1.1 회원가입

```typescript
// Supabase Client SDK
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure_password',
  options: {
    data: {
      full_name: '홍길동',
      phone: '010-1234-5678',
      industry: '보험',
      referral_code: 'MAGNETIC2025'
    }
  }
})
```

**응답:**
```json
{
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "user_metadata": {
      "full_name": "홍길동",
      "phone": "010-1234-5678",
      "industry": "보험",
      "is_approved": false
    }
  },
  "session": null
}
```

> **주의:** `is_approved: false` 상태에서는 로그인 후에도 대시보드 접근이 제한됩니다.

#### 4.1.2 로그인

```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure_password'
})
```

**응답:**
```json
{
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "user_metadata": {
      "is_approved": true
    }
  },
  "session": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "xxx",
    "expires_in": 3600,
    "token_type": "bearer"
  }
}
```

#### 4.1.3 로그아웃

```typescript
const { error } = await supabase.auth.signOut()
```

#### 4.1.4 현재 사용자 조회

```typescript
const { data: { user } } = await supabase.auth.getUser()
```

#### 4.1.5 비밀번호 재설정 요청

```typescript
const { data, error } = await supabase.auth.resetPasswordForEmail(
  'user@example.com',
  { redirectTo: 'https://app.magnetic-sales.com/reset-password' }
)
```

---

### 4.2 데이터베이스 CRUD

#### 4.2.1 프로젝트 (projects)

**목록 조회:**
```typescript
const { data, error } = await supabase
  .from('projects')
  .select(`
    *,
    landing_pages (id, preview_url, published_url, created_at)
  `)
  .order('updated_at', { ascending: false })
```

**생성:**
```typescript
const { data, error } = await supabase
  .from('projects')
  .insert({
    name: '보험 고객 DB 수집 랜딩페이지',
    description: '30-40대 가장 대상 보험 상담 신청 페이지',
    status: 'planning'
  })
  .select()
  .single()
```

**수정:**
```typescript
const { data, error } = await supabase
  .from('projects')
  .update({
    name: '수정된 프로젝트명',
    status: 'building'
  })
  .eq('id', projectId)
  .select()
  .single()
```

**삭제:**
```typescript
const { error } = await supabase
  .from('projects')
  .delete()
  .eq('id', projectId)
```

#### 4.2.2 대화 (conversations)

**생성:**
```typescript
const { data, error } = await supabase
  .from('conversations')
  .insert({
    project_id: projectId,
    type: 'planning', // 'planning' | 'sales_chat'
    title: '랜딩페이지 기획 대화'
  })
  .select()
  .single()
```

**메시지 목록 조회:**
```typescript
const { data, error } = await supabase
  .from('messages')
  .select('*')
  .eq('conversation_id', conversationId)
  .order('created_at', { ascending: true })
```

#### 4.2.3 랜딩페이지 (landing_pages)

**조회:**
```typescript
const { data, error } = await supabase
  .from('landing_pages')
  .select('*')
  .eq('project_id', projectId)
  .single()
```

**HTML 업데이트:**
```typescript
const { data, error } = await supabase
  .from('landing_pages')
  .update({
    html_content: updatedHtml,
    updated_at: new Date().toISOString()
  })
  .eq('id', landingPageId)
```

---

### 4.3 스토리지 (Storage)

#### 4.3.1 이미지 업로드

```typescript
// 파일 업로드
const { data, error } = await supabase.storage
  .from('images')
  .upload(
    `${userId}/${projectId}/${fileName}`,
    file,
    {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    }
  )

// 공개 URL 가져오기
const { data: { publicUrl } } = supabase.storage
  .from('images')
  .getPublicUrl(`${userId}/${projectId}/${fileName}`)
```

#### 4.3.2 이미지 삭제

```typescript
const { error } = await supabase.storage
  .from('images')
  .remove([`${userId}/${projectId}/${fileName}`])
```

#### 4.3.3 이미지 목록 조회

```typescript
const { data, error } = await supabase.storage
  .from('images')
  .list(`${userId}/${projectId}`, {
    limit: 100,
    offset: 0,
    sortBy: { column: 'created_at', order: 'desc' }
  })
```

---

## 5. 응답 표준 형식

### 5.1 성공 응답

```json
{
  "success": true,
  "data": {
    // 실제 데이터
  },
  "error": null,
  "meta": {
    "timestamp": "2025-01-15T12:00:00Z",
    "request_id": "req_uuid"
  }
}
```

### 5.2 에러 응답

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 친화적 에러 메시지",
    "details": {
      // 추가 에러 정보 (개발 디버깅용)
    }
  },
  "meta": {
    "timestamp": "2025-01-15T12:00:00Z",
    "request_id": "req_uuid"
  }
}
```

### 5.3 페이지네이션 응답

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 150,
      "page": 1,
      "per_page": 20,
      "total_pages": 8,
      "has_next": true,
      "has_prev": false
    }
  },
  "error": null
}
```

---

## 6. 에러 코드 정의

### 6.1 인증 관련 (AUTH_XXX)

| 코드 | HTTP 상태 | 메시지 | 설명 |
|------|-----------|--------|------|
| AUTH_INVALID_CREDENTIALS | 401 | 이메일 또는 비밀번호가 올바르지 않습니다 | 로그인 실패 |
| AUTH_EMAIL_NOT_VERIFIED | 401 | 이메일 인증이 필요합니다 | 이메일 미인증 |
| AUTH_NOT_APPROVED | 403 | 관리자 승인 대기 중입니다 | 승인 미완료 |
| AUTH_TOKEN_EXPIRED | 401 | 세션이 만료되었습니다. 다시 로그인해주세요 | JWT 만료 |
| AUTH_UNAUTHORIZED | 401 | 인증이 필요합니다 | 인증 헤더 없음 |
| AUTH_FORBIDDEN | 403 | 접근 권한이 없습니다 | 권한 부족 |

### 6.2 프로젝트 관련 (PROJ_XXX)

| 코드 | HTTP 상태 | 메시지 | 설명 |
|------|-----------|--------|------|
| PROJ_NOT_FOUND | 404 | 프로젝트를 찾을 수 없습니다 | 존재하지 않는 프로젝트 |
| PROJ_LIMIT_EXCEEDED | 403 | 프로젝트 생성 한도를 초과했습니다 | 무료 플랜 제한 |
| PROJ_INVALID_STATUS | 400 | 유효하지 않은 프로젝트 상태입니다 | 잘못된 상태 전환 |
| PROJ_DELETE_FAILED | 500 | 프로젝트 삭제에 실패했습니다 | 삭제 실패 |

### 6.3 AI 관련 (AI_XXX)

| 코드 | HTTP 상태 | 메시지 | 설명 |
|------|-----------|--------|------|
| AI_RATE_LIMIT | 429 | AI 호출 한도를 초과했습니다 | Rate Limit 초과 |
| AI_GENERATION_FAILED | 500 | AI 응답 생성에 실패했습니다 | Claude API 에러 |
| AI_CONTENT_FILTERED | 400 | 부적절한 콘텐츠가 감지되었습니다 | 콘텐츠 필터링 |
| AI_CONTEXT_TOO_LONG | 400 | 대화 내용이 너무 깁니다 | 컨텍스트 초과 |
| AI_INVALID_PROMPT | 400 | 유효하지 않은 프롬프트입니다 | 프롬프트 검증 실패 |

### 6.4 스토리지 관련 (STORAGE_XXX)

| 코드 | HTTP 상태 | 메시지 | 설명 |
|------|-----------|--------|------|
| STORAGE_FILE_TOO_LARGE | 400 | 파일 크기가 10MB를 초과합니다 | 파일 크기 제한 |
| STORAGE_INVALID_TYPE | 400 | 지원하지 않는 파일 형식입니다 | 허용되지 않은 MIME 타입 |
| STORAGE_QUOTA_EXCEEDED | 403 | 저장 공간이 부족합니다 | 스토리지 한도 초과 |
| STORAGE_UPLOAD_FAILED | 500 | 파일 업로드에 실패했습니다 | 업로드 에러 |

### 6.5 일반 에러 (GENERAL_XXX)

| 코드 | HTTP 상태 | 메시지 | 설명 |
|------|-----------|--------|------|
| GENERAL_VALIDATION_ERROR | 400 | 입력값이 올바르지 않습니다 | 유효성 검사 실패 |
| GENERAL_NOT_FOUND | 404 | 요청한 리소스를 찾을 수 없습니다 | 리소스 없음 |
| GENERAL_INTERNAL_ERROR | 500 | 서버 오류가 발생했습니다 | 내부 서버 에러 |
| GENERAL_SERVICE_UNAVAILABLE | 503 | 서비스를 일시적으로 사용할 수 없습니다 | 서비스 불가 |

---

## 7. Rate Limiting 정책

### 7.1 AI API 호출 제한

| 엔드포인트 | 제한 | 단위 | 초과 시 |
|-----------|------|------|--------|
| `/functions/v1/ai-chat` | 60 | 요청/시간/사용자 | 429 반환 |
| `/functions/v1/generate-prompt` | 20 | 요청/시간/사용자 | 429 반환 |
| `/functions/v1/generate-landing` | 10 | 요청/시간/사용자 | 429 반환 |
| `/functions/v1/sales-chat` | 60 | 요청/시간/사용자 | 429 반환 |

### 7.2 일반 API 제한

| 타입 | 제한 | 단위 |
|------|------|------|
| 인증 API | 10 | 요청/분/IP |
| Database 읽기 | 1000 | 요청/분/사용자 |
| Database 쓰기 | 100 | 요청/분/사용자 |
| Storage 업로드 | 30 | 요청/분/사용자 |

### 7.3 Rate Limit 헤더

```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1705312800
Retry-After: 120
```

### 7.4 Rate Limit 응답

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "AI_RATE_LIMIT",
    "message": "AI 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.",
    "details": {
      "limit": 60,
      "remaining": 0,
      "reset_at": "2025-01-15T13:00:00Z",
      "retry_after": 120
    }
  }
}
```

---

## 8. Edge Function 구현 예시

### 8.1 ai-chat 함수 구조

```typescript
// supabase/functions/ai-chat/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import Anthropic from "https://esm.sh/@anthropic-ai/sdk"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. JWT 인증 검증
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'AUTH_UNAUTHORIZED', message: '인증이 필요합니다' }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Supabase 클라이언트 초기화 (사용자 토큰 사용)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // 3. 사용자 정보 확인
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'AUTH_TOKEN_EXPIRED', message: '세션이 만료되었습니다' }
        }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. 승인 여부 확인
    if (!user.user_metadata?.is_approved) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: 'AUTH_NOT_APPROVED', message: '관리자 승인 대기 중입니다' }
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 5. 요청 본문 파싱
    const { conversation_id, message, context } = await req.json()

    // 6. 이전 대화 기록 조회 (컨텍스트 구성)
    const { data: messages } = await supabaseClient
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: true })
      .limit(20)

    // 7. Claude API 호출
    const anthropic = new Anthropic({
      apiKey: Deno.env.get('CLAUDE_API_KEY'),
    })

    const systemPrompt = `당신은 마그네틱 세일즈 마스터클래스의 AI 기획 도우미입니다.

## 핵심 원칙
- 마그네틱 세일즈의 철학: "밀어붙이지 않고 끌어당기는 세일즈"
- 고객의 가치와 문제 해결에 집중
- 신뢰 구축이 먼저, 세일즈는 그 다음

## 대화 목표
사용자가 효과적인 랜딩페이지를 만들 수 있도록 다음 정보를 수집합니다:
1. 업종 및 서비스
2. 타겟 고객층
3. 제공하는 가치
4. 고객의 문제점/니즈
5. 차별화 포인트

## 대화 스타일
- 친근하고 전문적인 톤
- 한 번에 1-2개의 질문만
- 구체적인 예시 제공
- 마그네틱 세일즈 팁 자연스럽게 공유`

    const claudeMessages = [
      ...(messages?.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content
      })) || []),
      { role: 'user' as const, content: message }
    ]

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: claudeMessages,
    })

    const assistantMessage = response.content[0].type === 'text'
      ? response.content[0].text
      : ''

    // 8. 메시지 저장
    const { data: savedUserMsg } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id,
        role: 'user',
        content: message
      })
      .select()
      .single()

    const { data: savedAssistantMsg } = await supabaseClient
      .from('messages')
      .insert({
        conversation_id,
        role: 'assistant',
        content: assistantMessage
      })
      .select()
      .single()

    // 9. 성공 응답
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          message_id: savedAssistantMsg?.id,
          response: assistantMessage,
          metadata: {
            tokens_used: response.usage.input_tokens + response.usage.output_tokens,
            model: 'claude-3-5-sonnet-20241022'
          }
        },
        error: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: {
          code: 'GENERAL_INTERNAL_ERROR',
          message: '서버 오류가 발생했습니다',
          details: { message: error.message }
        }
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

---

## 9. 보안 고려사항

### 9.1 API 키 관리

```
절대 금지:
- 클라이언트 코드에 Claude API 키 노출
- 환경변수를 클라이언트 번들에 포함
- API 키를 localStorage/sessionStorage에 저장

올바른 방법:
- Edge Function 환경변수로만 관리
- Supabase Dashboard > Edge Functions > Secrets 설정
```

### 9.2 Row Level Security (RLS)

```sql
-- projects 테이블 RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- 본인 프로젝트만 조회 가능
CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

-- 본인만 프로젝트 생성 가능
CREATE POLICY "Users can create own projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 본인만 프로젝트 수정 가능
CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

-- 본인만 프로젝트 삭제 가능
CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);
```

### 9.3 입력값 검증

```typescript
// Edge Function에서의 입력값 검증 예시
import { z } from 'https://esm.sh/zod'

const AiChatSchema = z.object({
  conversation_id: z.string().uuid(),
  message: z.string().min(1).max(2000),
  context: z.object({
    industry: z.string().optional(),
    target_audience: z.string().optional(),
    current_step: z.number().min(1).max(5).optional()
  }).optional()
})

// 요청 검증
const validationResult = AiChatSchema.safeParse(requestBody)
if (!validationResult.success) {
  return new Response(
    JSON.stringify({
      success: false,
      error: {
        code: 'GENERAL_VALIDATION_ERROR',
        message: '입력값이 올바르지 않습니다',
        details: validationResult.error.issues
      }
    }),
    { status: 400 }
  )
}
```

---

## 10. 프론트엔드 통합 예시

### 10.1 API 서비스 레이어

```typescript
// src/services/api.ts
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

export const aiService = {
  async chat(conversationId: string, message: string, context?: object) {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          conversation_id: conversationId,
          message,
          context
        })
      }
    )

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.error.message)
    }

    return result.data
  },

  async generateLanding(projectId: string, prompt: string, images: any[], options?: object) {
    const { data: { session } } = await supabase.auth.getSession()

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-landing`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          project_id: projectId,
          prompt,
          images,
          options
        })
      }
    )

    return response.json()
  }
}

export const projectService = {
  async list() {
    const { data, error } = await supabase
      .from('projects')
      .select('*, landing_pages(id, preview_url)')
      .order('updated_at', { ascending: false })

    if (error) throw error
    return data
  },

  async create(name: string, description?: string) {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name, description, status: 'planning' })
      .select()
      .single()

    if (error) throw error
    return data
  }
}
```

### 10.2 React Query 통합

```typescript
// src/hooks/useAiChat.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { aiService } from '../services/api'

export function useAiChat(conversationId: string) {
  const queryClient = useQueryClient()

  const sendMessage = useMutation({
    mutationFn: ({ message, context }: { message: string, context?: object }) =>
      aiService.chat(conversationId, message, context),
    onSuccess: () => {
      queryClient.invalidateQueries(['messages', conversationId])
    }
  })

  return { sendMessage }
}
```

---

## 11. 문서 버전 관리

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|-----------|--------|
| 1.0 | 2025-12-15 | 초안 작성 | API 문서화 전문가 |

---

## 12. 부록

### 12.1 TypeScript 타입 정의

```typescript
// src/types/api.ts

// API 응답 기본 형식
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: ApiError | null
  meta?: {
    timestamp: string
    request_id: string
  }
}

export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
}

// AI Chat
export interface AiChatRequest {
  conversation_id: string
  message: string
  context?: {
    industry?: string
    target_audience?: string
    current_step?: number
  }
}

export interface AiChatResponse {
  message_id: string
  response: string
  metadata: {
    tokens_used: number
    model: string
    suggested_questions?: string[]
    progress?: {
      current_step: number
      total_steps: number
      completed_items: string[]
    }
  }
}

// Generate Landing
export interface GenerateLandingRequest {
  project_id: string
  prompt: string
  images: {
    section: string
    url: string
  }[]
  options?: {
    style?: 'modern' | 'classic' | 'minimal'
    color_scheme?: string
    include_google_form?: boolean
    google_form_url?: string
  }
}

export interface GenerateLandingResponse {
  landing_page_id: string
  html: string
  preview_url: string
  sections: {
    id: string
    title: string
    editable: boolean
  }[]
  metadata: {
    tokens_used: number
    generation_time_ms: number
    html_size_kb: number
  }
}

// Project
export interface Project {
  id: string
  user_id: string
  name: string
  description?: string
  status: 'planning' | 'building' | 'published' | 'archived'
  created_at: string
  updated_at: string
  landing_pages?: LandingPage[]
}

export interface LandingPage {
  id: string
  project_id: string
  html_content: string
  preview_url: string
  published_url?: string
  created_at: string
  updated_at: string
}

// Conversation & Message
export interface Conversation {
  id: string
  project_id: string
  user_id: string
  type: 'planning' | 'sales_chat'
  title: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  metadata?: Record<string, any>
  created_at: string
}
```

### 12.2 관련 문서 링크

| 문서 | 경로 |
|------|------|
| 요구사항 정의서 | `로드맵/00_요구사항_정의서.md` |
| 기술스택 결정 | `로드맵/02_기술스택_결정.md` |
| 상세페이지 빌더 분석 | `참고자료_분석/04_상세페이지빌더_분석.md` |
| DB 스키마 설계 | `기획_v1/03_DB_설계.md` (예정) |
| AI 프롬프트 설계 | `기획_v1/05_AI_프롬프트_설계.md` (예정) |
| 보안/인증 설계 | `기획_v1/06_보안_인증.md` (예정) |

---

*이 문서는 마그네틱 세일즈 웹앱 개발팀의 API 설계 가이드라인입니다.*
