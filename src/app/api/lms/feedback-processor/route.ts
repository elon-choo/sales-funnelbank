// src/app/api/lms/feedback-processor/route.ts
// 프로덕션 피드백 처리 API - 즉시 202 응답 + after()에서 처리
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAccessToken } from '@/lib/auth/tokens';
import Anthropic from '@anthropic-ai/sdk';
import nodemailer from 'nodemailer';
import mammoth from 'mammoth';

export const runtime = 'nodejs';
export const maxDuration = 300; // Vercel Pro: 최대 5분 (긴 피드백 생성용)

const MAX_CONCURRENT_JOBS = 5;
const CRON_SECRET = (process.env.CRON_SECRET_FEEDBACK || '').trim();
const INTERNAL_API_SECRET = (process.env.INTERNAL_API_SECRET || CRON_SECRET).trim();

// POST /api/lms/feedback-processor
export async function POST(request: NextRequest) {
  // Auth: internal secret OR user JWT
  const internalSecretHeader = request.headers.get('x-internal-secret');
  const isInternalCall = internalSecretHeader === INTERNAL_API_SECRET;
  const isDev = process.env.NODE_ENV === 'development';
  let authUserId: string | null = null;

  if (!isDev && !isInternalCall) {
    // JWT 인증 시도
    const bearerHeader = request.headers.get('authorization');
    if (bearerHeader?.startsWith('Bearer ')) {
      const token = bearerHeader.substring(7);
      try {
        const payload = await verifyAccessToken(token);
        if (payload?.sub) {
          authUserId = payload.sub;
        }
      } catch {
        // JWT 검증 실패
      }
    }
    if (!authUserId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const body = await request.json();
    const { jobId, assignmentId } = body;

    if (!jobId && !assignmentId) {
      return NextResponse.json(
        { success: false, error: 'jobId 또는 assignmentId가 필요합니다' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 1. 동시 처리 제한 확인
    const { count: processingCount } = await supabase
      .from('feedback_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    if ((processingCount || 0) >= MAX_CONCURRENT_JOBS) {
      return NextResponse.json({
        success: true,
        data: { status: 'queued', message: '처리 대기열에 추가되었습니다.' },
      });
    }

    // 2. Job 선택
    let targetJobId = jobId;
    if (!targetJobId && assignmentId) {
      const { data: pendingJob } = await supabase
        .from('feedback_jobs')
        .select('id')
        .eq('assignment_id', assignmentId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1)
        .single();

      if (!pendingJob) {
        return NextResponse.json({ success: false, error: '처리할 작업이 없습니다' }, { status: 404 });
      }
      targetJobId = pendingJob.id;
    }

    // 3. Job 상태를 processing으로 변경 (atomic pick)
    const { data: job, error: pickError } = await supabase
      .from('feedback_jobs')
      .update({
        status: 'processing',
        started_at: new Date().toISOString(),
        attempts: 1,
      })
      .eq('id', targetJobId)
      .eq('status', 'pending')
      .select('*, assignments(id, user_id, course_id, week_id, content, version)')
      .single();

    if (pickError || !job) {
      return NextResponse.json({
        success: true,
        data: { status: 'already_processing', message: '이미 처리 중입니다' },
      });
    }

    // 4. 과제 정보 가져오기
    const assignment = (job as Record<string, unknown>).assignments as {
      id: string;
      user_id: string;
      course_id: string;
      week_id: string;
      content: Record<string, unknown>;
      version: number;
    };

    if (!assignment) {
      await supabase.from('feedback_jobs').update({
        status: 'failed',
        error_message: 'Assignment not found',
        completed_at: new Date().toISOString(),
      }).eq('id', targetJobId);

      return NextResponse.json({ success: false, error: 'Assignment not found' }, { status: 404 });
    }

    // JWT 인증인 경우 과제 소유권 확인
    if (authUserId && authUserId !== assignment.user_id) {
      // Job 상태 복구
      await supabase.from('feedback_jobs').update({
        status: 'pending',
        started_at: null,
        attempts: 0,
      }).eq('id', targetJobId);
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // ===== 즉시 202 응답 반환, 무거운 처리는 after()에서 실행 =====
    after(async () => {
      const startTime = Date.now();
      try {
        await processFeedback(supabase, targetJobId, assignment, startTime);
      } catch (err) {
        console.error('[Processor after()] Fatal error:', err);
        try {
          await supabase.from('feedback_jobs').update({
            status: 'failed',
            error_message: err instanceof Error ? err.message : 'Processing failed',
            completed_at: new Date().toISOString(),
          }).eq('id', targetJobId);
        } catch {
          // 최종 실패
        }
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: targetJobId,
        assignmentId: assignment.id,
        status: 'processing',
        message: '피드백 생성이 시작되었습니다',
      },
    }, { status: 202 });
  } catch (error) {
    console.error('[Processor] Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ===== 무거운 피드백 처리 로직 (after() 내에서 실행) =====
async function processFeedback(
  supabase: ReturnType<typeof createAdminClient>,
  targetJobId: string,
  assignment: {
    id: string;
    user_id: string;
    course_id: string;
    week_id: string;
    content: Record<string, unknown>;
    version: number;
  },
  startTime: number
) {
  // 1. 파일 첨부 과제인 경우 파일 내용 추출
  const content = assignment.content as Record<string, unknown>;
  const isFileUpload = content.submitMode === 'file' || content._submitMode === 'file' || content._placeholder;
  let fileContents = '';

  if (isFileUpload) {
    const attachedFiles = content.attachedFiles as Array<{ id: string }> | undefined;
    const fileIds = attachedFiles?.map(f => f.id).filter(Boolean);

    let files: Array<{
      id: string; file_name: string; file_path: string;
      mime_type: string | null; file_size: number | null; extracted_text: string | null;
    }> | null = null;

    if (fileIds && fileIds.length > 0) {
      const { data } = await supabase
        .from('assignment_files')
        .select('id, file_name, file_path, mime_type, file_size, extracted_text')
        .in('id', fileIds)
        .order('created_at', { ascending: true });
      files = data;
    }

    // fallback: assignment_id 기반 조회
    if (!files || files.length === 0) {
      const { data } = await supabase
        .from('assignment_files')
        .select('id, file_name, file_path, mime_type, file_size, extracted_text')
        .eq('assignment_id', assignment.id)
        .order('created_at', { ascending: true });
      files = data;
    }

    if (files && files.length > 0) {
      const textParts: string[] = [];

      for (const file of files) {
        if (file.extracted_text) {
          textParts.push(`--- 파일: ${file.file_name} ---\n${file.extracted_text}`);
          continue;
        }

        const ext = file.file_name?.split('.').pop()?.toLowerCase() || '';
        const mime = file.mime_type || '';

        const isTextFile = [
          'text/plain', 'text/markdown', 'text/x-markdown',
          'text/csv', 'text/html', 'application/json',
        ].includes(mime);
        const textExtensions = ['txt', 'md', 'csv', 'json', 'html', 'text'];
        const isTextExtension = textExtensions.includes(ext);

        const isDocx = ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        const isDoc = ext === 'doc' || mime === 'application/msword';

        if (isTextFile || isTextExtension) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('assignment-files')
              .download(file.file_path);

            if (!downloadError && fileData) {
              const text = await fileData.text();
              textParts.push(`--- 파일: ${file.file_name} ---\n${text}`);

              await supabase
                .from('assignment_files')
                .update({ extracted_text: text.substring(0, 100000) })
                .eq('id', file.id);
            }
          } catch (dlError) {
            console.error(`[Processor] File download error (${file.file_name}):`, dlError);
            textParts.push(`--- 파일: ${file.file_name} (다운로드 실패) ---`);
          }
        } else if (isDocx) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('assignment-files')
              .download(file.file_path);

            if (!downloadError && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
              const text = result.value;
              if (text && text.trim().length > 0) {
                textParts.push(`--- 파일: ${file.file_name} ---\n${text}`);
                await supabase
                  .from('assignment_files')
                  .update({ extracted_text: text.substring(0, 100000) })
                  .eq('id', file.id);
              } else {
                textParts.push(`--- 파일: ${file.file_name} (내용 없음) ---`);
              }
            }
          } catch (dlError) {
            console.error(`[Processor] DOCX extract error (${file.file_name}):`, dlError);
            textParts.push(`--- 파일: ${file.file_name} (DOCX 텍스트 추출 실패) ---`);
          }
        } else if (isDoc) {
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('assignment-files')
              .download(file.file_path);

            if (!downloadError && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
              const text = result.value;
              if (text && text.trim().length > 0) {
                textParts.push(`--- 파일: ${file.file_name} ---\n${text}`);
                await supabase
                  .from('assignment_files')
                  .update({ extracted_text: text.substring(0, 100000) })
                  .eq('id', file.id);
              } else {
                textParts.push(`--- 파일: ${file.file_name} (.doc 형식 - 텍스트 추출 제한) ---`);
              }
            }
          } catch (dlError) {
            console.error(`[Processor] DOC extract error (${file.file_name}):`, dlError);
            textParts.push(`--- 파일: ${file.file_name} (.doc 형식 - 텍스트 추출 실패) ---`);
          }
        } else {
          textParts.push(`--- 파일: ${file.file_name} (${mime}, ${Math.round((file.file_size || 0) / 1024)}KB) - 텍스트 추출 불가 ---`);
        }
      }

      fileContents = textParts.join('\n\n');
    }
  }

  // 2. RAG 데이터 로딩
  const { data: ragMappings } = await supabase
    .from('rag_week_mappings')
    .select('rag_dataset_id')
    .eq('week_id', assignment.week_id);

  let ragContext = '';
  if (ragMappings && ragMappings.length > 0) {
    const datasetIds = ragMappings.map(m => m.rag_dataset_id);
    const { data: chunks } = await supabase
      .from('rag_chunks')
      .select('content, category')
      .in('dataset_id', datasetIds)
      .order('chunk_index', { ascending: true });

    if (chunks) {
      ragContext = chunks.map(c => `[${c.category}]\n${c.content}`).join('\n\n---\n\n');
    }
  }

  // 3. 마스터 프롬프트 로딩
  const { data: promptSetting } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'feedback_master_prompt')
    .single();

  const masterPrompt = promptSetting?.value
    ? (typeof promptSetting.value === 'string' ? promptSetting.value : JSON.stringify(promptSetting.value))
    : '비즈니스 아이템 기획서를 분석하여 상세한 피드백을 제공하세요.';

  // 4. 학생 제출물 포맷팅
  let studentSubmission: string;

  if (isFileUpload && fileContents) {
    studentSubmission = fileContents;
  } else {
    const fieldLabels: Record<string, string> = {
      business_item_name: '비즈니스 아이템명',
      target_customer: '타겟 고객',
      core_problem: '핵심 문제/니즈 (Before)',
      solution: '솔루션 (After)',
      product_pricing: '상품 구성 및 가격',
      sales_channel: '판매 채널',
      funnel_roadmap: '퍼널 로드맵',
      execution_plan: '실행 계획',
    };

    const excludeKeys = ['_submitMode', '_placeholder', 'submitMode', 'attachedFiles'];
    studentSubmission = Object.entries(content)
      .filter(([key]) => !excludeKeys.includes(key) && !key.startsWith('_'))
      .map(([key, value]) => `### ${fieldLabels[key] || key}\n${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join('\n\n');
  }

  // 5. Claude API 호출
  const systemPrompt = `${masterPrompt}

---
## 참고 자료 (RAG Context)
${ragContext ? ragContext.substring(0, 80000) : '(참고 자료 없음)'}
---

위 참고 자료를 바탕으로 아래 학생의 과제를 분석하고 상세한 피드백을 제공하세요.

## 피드백 형식
피드백은 마크다운 형식으로 작성하세요. 반드시 아래 구조를 포함하세요:

1. **Executive Summary** (전체 평가 요약, 3-5문장)
2. **총점** (100점 만점, 형식: "총점: XX/100")
3. **항목별 상세 분석** (8개 항목 각각에 대해)
   - 현재 상태 진단
   - 문제점 지적
   - 구체적 개선안
   - 참고 예시
4. **퍼널 일관성 분석** (아이템-타겟-솔루션-가격-채널-퍼널 전체 흐름 검증)
5. **실행 로드맵** (우선순위별 4주 실행 계획)
6. **최종 한마디** (동기부여 + 핵심 메시지)`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const feedbackStartTime = Date.now();

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 12000,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 수강생 과제 제출물\n\n${studentSubmission}`,
      },
    ],
  });

  const feedbackText = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  const generationTimeMs = Date.now() - feedbackStartTime;

  // 6. 점수 추출
  const scoreMatch = feedbackText.match(/총점[:\s]*(\d+)\s*[/\/]\s*100/);
  const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

  // 7. 피드백 저장
  const { data: feedback, error: feedbackError } = await supabase
    .from('feedbacks')
    .insert({
      assignment_id: assignment.id,
      user_id: assignment.user_id,
      course_id: assignment.course_id,
      week_id: assignment.week_id,
      content: feedbackText,
      summary: feedbackText.substring(0, 500),
      scores: score ? { total: score } : null,
      version: 1,
      assignment_version: assignment.version,
      status: 'generated',
      tokens_input: response.usage?.input_tokens || 0,
      tokens_output: response.usage?.output_tokens || 0,
      generation_time_ms: generationTimeMs,
    })
    .select('id')
    .single();

  if (feedbackError) {
    throw new Error(`Feedback save error: ${feedbackError.message}`);
  }

  // 8. Job 완료, Assignment 상태 업데이트
  await Promise.all([
    supabase.from('feedback_jobs').update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    }).eq('id', targetJobId),

    supabase.from('assignments').update({
      status: 'feedback_ready',
    }).eq('id', assignment.id),
  ]);

  // 9. SMTP 이메일 발송
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM;

    if (smtpHost && smtpUser && smtpPass) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', assignment.user_id)
        .single();

      const recipientEmail = profile?.email;
      const recipientName = profile?.full_name || '수강생';

      if (recipientEmail) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: false,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const feedbackUrl = `${baseUrl}/lms/feedbacks/${feedback?.id}`;

        const scoreText = score !== null ? `총점: ${score}/100` : '';
        const summaryPreview = feedbackText.substring(0, 500).replace(/[#*_]/g, '');

        await transporter.sendMail({
          from: `"마그네틱 세일즈" <${smtpFrom || smtpUser}>`,
          to: recipientEmail,
          subject: `[피드백 완료] 과제 피드백이 생성되었습니다 ${scoreText}`,
          html: `
            <div style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 16px;">
              <div style="text-align: center; margin-bottom: 24px;">
                <h1 style="color: #a855f7; font-size: 24px; margin: 0;">AI 피드백 완료</h1>
              </div>
              <p style="color: #d0d0d0; font-size: 16px;">안녕하세요 ${recipientName}님,</p>
              <p style="color: #b0b0b0;">제출하신 과제에 대한 AI 피드백이 생성되었습니다.</p>
              ${score !== null ? `
              <div style="background: #2a2a4a; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
                <span style="font-size: 14px; color: #888;">총점</span>
                <p style="font-size: 48px; font-weight: bold; color: ${score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#f87171'}; margin: 8px 0;">${score}<span style="font-size: 20px; color: #888;">/100</span></p>
              </div>
              ` : ''}
              <div style="background: #2a2a4a; padding: 16px; border-radius: 12px; margin: 16px 0;">
                <p style="color: #b0b0b0; font-size: 14px; line-height: 1.6;">${summaryPreview}...</p>
              </div>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${feedbackUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #a855f7, #ec4899); color: white; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 16px;">
                  피드백 전문 보기
                </a>
              </div>
              <p style="color: #666; font-size: 12px; margin-top: 24px; text-align: center;">
                마그네틱 세일즈 마스터클래스
              </p>
            </div>
          `,
        });

        // feedbacks 테이블에 sent_at 기록
        await supabase.from('feedbacks').update({
          sent_at: new Date().toISOString(),
        }).eq('id', feedback?.id);
      }
    }
  } catch (emailError) {
    console.error('[Processor] Email send error:', emailError);
    // 이메일 실패해도 피드백은 이미 저장됨
  }

  const elapsedMs = Date.now() - startTime;
  console.log(`[Processor] Feedback completed: jobId=${targetJobId}, score=${score}, elapsed=${elapsedMs}ms`);
}

// GET: 대기열 상태 조회
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-internal-secret');
  const isInternalCall = authHeader === INTERNAL_API_SECRET;
  const isDev = process.env.NODE_ENV === 'development';

  if (!isDev && !isInternalCall) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const [pending, processing, completed, failed] = await Promise.all([
      supabase.from('feedback_jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('feedback_jobs').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
      supabase.from('feedback_jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed')
        .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      supabase.from('feedback_jobs').select('*', { count: 'exact', head: true }).eq('status', 'failed')
        .gte('completed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        queue: {
          pending: pending.count || 0,
          processing: processing.count || 0,
          maxConcurrent: MAX_CONCURRENT_JOBS,
        },
        last24h: {
          completed: completed.count || 0,
          failed: failed.count || 0,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
