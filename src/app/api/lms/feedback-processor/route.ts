// src/app/api/lms/feedback-processor/route.ts
// 프로덕션 피드백 처리 API - 즉시 202 응답 + after()에서 처리
import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAccessToken } from '@/lib/auth/tokens';
import Anthropic from '@anthropic-ai/sdk';
import nodemailer from 'nodemailer';
import mammoth from 'mammoth';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { FeedbackPdfDocument } from '@/lib/pdf/md-to-pdf';
import { registerFontsAsync } from '@/lib/pdf/register-fonts';

export const runtime = 'nodejs';
export const maxDuration = 800; // Vercel Pro: 최대 800초

import { validateInternalApiSecret } from '@/lib/security/crypto';

const MAX_CONCURRENT_JOBS = 5;

// POST /api/lms/feedback-processor
export async function POST(request: NextRequest) {
  // Auth: internal secret OR user JWT (no dev bypass)
  const internalSecretHeader = request.headers.get('x-internal-secret');
  const isInternalCall = validateInternalApiSecret(internalSecretHeader);
  let authUserId: string | null = null;

  if (!isInternalCall) {
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
    let jobId: string | undefined;
    let assignmentId: string | undefined;
    try {
      const body = await request.json();
      jobId = body.jobId;
      assignmentId = body.assignmentId;
    } catch {
      // body가 없는 경우 (프론트엔드 트리거) → pending job 자동 탐색
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
    let targetJobId: string | undefined = jobId;
    if (!targetJobId) {
      // assignmentId로 찾거나, 없으면 가장 오래된 pending job 선택
      const query = supabase
        .from('feedback_jobs')
        .select('id')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(1);

      if (assignmentId) {
        query.eq('assignment_id', assignmentId);
      }

      const { data: pendingJob } = await query.single();

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
        await processFeedback(supabase, targetJobId!, assignment, startTime);
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
              const buffer = Buffer.from(await fileData.arrayBuffer());
              let text = '';

              // Smart encoding detection: try UTF-8 first, fallback to EUC-KR/CP949
              const utf8Text = buffer.toString('utf-8');
              const koreanChars = (utf8Text.match(/[\uAC00-\uD7AF]/g) || []).length;
              const garbledChars = (utf8Text.match(/[\ufffd]/g) || []).length;
              const mojibakePattern = /[\u00C0-\u00FF]{3,}|[\u0080-\u00FF][\u00C0-\u00FF]/;
              const hasMojibake = mojibakePattern.test(utf8Text.substring(0, 500));

              if (koreanChars > 10 && garbledChars === 0 && !hasMojibake) {
                // Valid UTF-8 with Korean content
                text = utf8Text;
                console.log(`[Processor] File ${file.file_name}: UTF-8 detected (${koreanChars} Korean chars)`);
              } else {
                // Try EUC-KR/CP949 decoding
                try {
                  const iconv = require('iconv-lite');
                  const euckrText = iconv.decode(buffer, 'euc-kr');
                  const euckrKorean = (euckrText.match(/[\uAC00-\uD7AF]/g) || []).length;

                  if (euckrKorean > koreanChars) {
                    text = euckrText;
                    console.log(`[Processor] File ${file.file_name}: EUC-KR detected (${euckrKorean} Korean chars vs UTF-8 ${koreanChars})`);
                  } else {
                    text = utf8Text;
                    console.log(`[Processor] File ${file.file_name}: UTF-8 used (EUC-KR ${euckrKorean} chars not better)`);
                  }
                } catch {
                  text = utf8Text;
                  console.log(`[Processor] File ${file.file_name}: iconv-lite failed, using UTF-8`);
                }
              }

              // Remove BOM if present
              if (text.charCodeAt(0) === 0xFEFF) text = text.substring(1);

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
        } else if (ext === 'pdf' || mime === 'application/pdf') {
          // PDF: Gemini API로 텍스트 추출 (이미지/스캔 PDF 포함)
          try {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('assignment-files')
              .download(file.file_path);

            if (!downloadError && fileData) {
              const arrayBuffer = await fileData.arrayBuffer();
              const base64Data = Buffer.from(arrayBuffer).toString('base64');
              const geminiKey = process.env.GEMINI_API_KEY;

              if (geminiKey) {
                const geminiResp = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      contents: [{
                        parts: [
                          { text: 'This PDF is a student assignment submission in Korean. Extract ALL text content from every page of this PDF, preserving the structure (headings, paragraphs, lists, tables). Output the full extracted text in Korean. Do not summarize or omit anything.' },
                          { inlineData: { mimeType: 'application/pdf', data: base64Data } },
                        ],
                      }],
                      generationConfig: { maxOutputTokens: 32000, temperature: 0.1 },
                    }),
                  }
                );

                if (geminiResp.ok) {
                  const geminiData = await geminiResp.json();
                  const extractedText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  if (extractedText.trim().length > 50) {
                    textParts.push(`--- 파일: ${file.file_name} (PDF, Gemini 추출) ---\n${extractedText}`);
                    await supabase
                      .from('assignment_files')
                      .update({ extracted_text: extractedText.substring(0, 100000) })
                      .eq('id', file.id);
                    console.log(`[Processor] PDF ${file.file_name}: Gemini extracted ${extractedText.length} chars`);
                  } else {
                    textParts.push(`--- 파일: ${file.file_name} (PDF, Gemini 추출 실패 - 내용 없음) ---`);
                    console.warn(`[Processor] PDF ${file.file_name}: Gemini returned too short text`);
                  }
                } else {
                  const errText = await geminiResp.text().catch(() => 'unknown');
                  console.error(`[Processor] Gemini API error for ${file.file_name}: ${geminiResp.status} ${errText}`);
                  textParts.push(`--- 파일: ${file.file_name} (PDF, Gemini API 오류) ---`);
                }
              } else {
                textParts.push(`--- 파일: ${file.file_name} (PDF - GEMINI_API_KEY 미설정) ---`);
              }
            }
          } catch (pdfError) {
            console.error(`[Processor] PDF extract error (${file.file_name}):`, pdfError);
            textParts.push(`--- 파일: ${file.file_name} (PDF 텍스트 추출 실패) ---`);
          }
        } else {
          textParts.push(`--- 파일: ${file.file_name} (${mime}, ${Math.round((file.file_size || 0) / 1024)}KB) - 텍스트 추출 불가 ---`);
        }
      }

      fileContents = textParts.join('\n\n');
    }
  }

  // 2. 주차 정보 조회
  const { data: weekInfo } = await supabase
    .from('course_weeks')
    .select('week_number, title, assignment_type')
    .eq('id', assignment.week_id)
    .single();
  const weekNumber = weekInfo?.week_number || 1;

  // 3. RAG 데이터 로딩 (주차별 분기)
  let ragContext = '';

  if (weekNumber >= 2) {
    // 2회차+: pgvector 기반 시맨틱 RAG 검색 (seperma_5th_feedback_rag)
    ragContext = await loadRagViaSemanticSearch(content);
  } else {
    // 1회차: rag_chunks 기반 RAG (기존 로직)
    const { data: ragMappings } = await supabase
      .from('rag_week_mappings')
      .select('rag_dataset_id')
      .eq('week_id', assignment.week_id);

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
  }

  // 4. 마스터 프롬프트 로딩 (주차별 - prompt_versions 우선, system_settings 폴백)
  // Try week-specific key first, then fallback chain
  const weekKeys = [
    `feedback_master_prompt_week${weekNumber}`,
    weekNumber === 1 ? 'feedback_master_prompt' : `feedback_master_prompt_week${weekNumber}`,
    'feedback_master_prompt', // final fallback
  ];

  let masterPrompt = '';
  // First try prompt_versions table (new system)
  const { data: activePrompt } = await supabase
    .from('prompt_versions')
    .select('content')
    .eq('week_key', `week${weekNumber}`)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .single();

  if (activePrompt?.content) {
    masterPrompt = activePrompt.content;
    console.log(`[Processor] Loaded prompt from prompt_versions: week${weekNumber}`);
  } else {
    // Fallback to system_settings
    for (const key of weekKeys) {
      const { data: promptSetting } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', key)
        .single();
      if (promptSetting?.value) {
        masterPrompt = typeof promptSetting.value === 'string' ? promptSetting.value : JSON.stringify(promptSetting.value);
        console.log(`[Processor] Loaded prompt from system_settings: ${key}`);
        break;
      }
    }
    if (!masterPrompt) {
      masterPrompt = '비즈니스 아이템 기획서를 분석하여 상세한 피드백을 제공하세요.';
      console.warn('[Processor] No prompt found, using default');
    }
  }

  // 4-1. AI 모델/토큰 설정 로딩
  const { data: modelSetting } = await supabase
    .from('system_settings').select('value').eq('key', 'ai_model').single();
  const { data: tokenSetting } = await supabase
    .from('system_settings').select('value').eq('key', 'ai_max_tokens_feedback').single();

  const aiModel = (modelSetting?.value
    ? (typeof modelSetting.value === 'string' ? modelSetting.value : JSON.stringify(modelSetting.value))
    : 'claude-opus-4-6').replace(/"/g, '');
  const aiMaxTokens = tokenSetting?.value
    ? parseInt(String(tokenSetting.value).replace(/"/g, ''), 10) || 12000
    : 12000;

  // 5. 학생 제출물 포맷팅 (주차별 필드 라벨)
  let studentSubmission: string;

  if (isFileUpload && fileContents) {
    studentSubmission = fileContents;
  } else {
    const fieldLabelsWeek1: Record<string, string> = {
      business_item_name: '비즈니스 아이템명',
      target_customer: '타겟 고객',
      core_problem: '핵심 문제/니즈 (Before)',
      solution: '솔루션 (After)',
      product_pricing: '상품 구성 및 가격',
      sales_channel: '판매 채널',
      funnel_roadmap: '퍼널 로드맵',
      execution_plan: '실행 계획',
    };
    const fieldLabelsWeek2: Record<string, string> = {
      assignment1_customer_values: '과제 1: 고객 가치 50가지',
      assignment2_persona_canvas: '과제 2: 타겟 페르소나 캔버스',
      assignment3_goal_setting: '과제 3: 목표 설정',
    };
    const fieldLabelsWeek4: Record<string, string> = {
      basic_info: 'A-1. 기본 정보',
      page_purpose: 'A-2. 페이지 목적',
      customer_current: 'A-3. 고객 현재 상태',
      customer_future: 'A-4. 고객 이상적 미래',
      solution_intro: 'A-5. 솔루션 소개',
      headline: 'B-1. 헤드라인',
      subhead: 'B-2. 서브헤드',
      pain_section: 'B-3. 고통 섹션',
      transition_cta: 'B-4. 전환 CTA',
      solution_before_after: 'B-5. 솔루션 Before/After',
      value_stack: 'B-6. 가치 스택 + 가격표',
      faq: 'B-7. FAQ 선거절 처리',
      final_cta: 'B-8. 최종 CTA',
      social_proof: 'B-9. 사회적 증거/성공사례',
    };
    const fieldLabels = weekNumber >= 4
      ? { ...fieldLabelsWeek1, ...fieldLabelsWeek2, ...fieldLabelsWeek4 }
      : weekNumber >= 2
        ? { ...fieldLabelsWeek1, ...fieldLabelsWeek2 }
        : fieldLabelsWeek1;

    const excludeKeys = ['_submitMode', '_placeholder', 'submitMode', 'attachedFiles'];
    studentSubmission = Object.entries(content)
      .filter(([key]) => !excludeKeys.includes(key) && !key.startsWith('_'))
      .map(([key, value]) => `### ${fieldLabels[key] || key}\n${typeof value === 'string' ? value : JSON.stringify(value)}`)
      .join('\n\n');
  }

  // 5-2. 텍스트 추출 실패 검증: 의미있는 내용이 없으면 assignment를 draft로 복원 (횟수 차감 방지)
  const meaningfulContent = studentSubmission.replace(/---\s*파일:.*?---/g, '').replace(/텍스트 추출 (?:불가|실패|제한)/g, '').trim();
  if (meaningfulContent.length < 50) {
    console.warn(`[Processor] Extraction failed: only ${meaningfulContent.length} chars of meaningful content. Reverting assignment to draft.`);

    // Assignment를 draft로 복원 → 제출 횟수에서 제외됨
    await supabase.from('assignments').update({
      status: 'draft',
      submitted_at: null,
    }).eq('id', assignment.id);

    // Job을 failed로 마크
    await supabase.from('feedback_jobs').update({
      status: 'failed',
      error_message: '파일에서 텍스트를 추출할 수 없습니다. 다른 형식으로 다시 제출해주세요. (제출 횟수는 차감되지 않았습니다)',
      completed_at: new Date().toISOString(),
    }).eq('id', targetJobId);

    // 이메일 알림 (실패 안내)
    try {
      const smtpHost = process.env.SMTP_HOST?.trim();
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASSWORD?.trim();
      if (smtpHost && smtpUser && smtpPass) {
        const { data: profile } = await supabase.from('profiles').select('email, full_name').eq('id', assignment.user_id).single();
        if (profile?.email) {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: parseInt((process.env.SMTP_PORT || '587').trim()),
            secure: false,
            auth: { user: smtpUser, pass: smtpPass },
          });
          await transporter.sendMail({
            from: `"마그네틱 세일즈" <${process.env.SMTP_FROM?.trim() || smtpUser}>`,
            to: profile.email,
            subject: '[안내] 과제 파일 텍스트 인식 실패 - 다시 제출해주세요',
            html: `
              <div style="font-family: 'Pretendard', sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #1a1a2e; color: #e0e0e0; border-radius: 16px;">
                <h2 style="color: #f87171;">파일 텍스트 인식 실패 안내</h2>
                <p>안녕하세요 ${profile.full_name || '수강생'}님,</p>
                <p>제출하신 파일에서 텍스트를 추출할 수 없어 피드백 생성에 실패했습니다.</p>
                <div style="background: #2a2a4a; padding: 16px; border-radius: 12px; margin: 16px 0;">
                  <p style="color: #facc15; font-weight: bold;">제출 횟수는 차감되지 않았습니다.</p>
                  <p style="color: #b0b0b0;">아래 방법 중 하나로 다시 제출해주세요:</p>
                  <ul style="color: #b0b0b0;">
                    <li><b>직접 작성</b>으로 텍스트를 붙여넣기</li>
                    <li><b>.docx</b> 파일로 변환하여 제출</li>
                    <li><b>.txt</b> 파일로 변환하여 제출</li>
                    <li>PDF라면 텍스트가 포함된(스캔이 아닌) PDF로 제출</li>
                  </ul>
                </div>
              </div>`,
          });
          console.log(`[Processor] Extraction failure email sent to ${profile.email}`);
        }
      }
    } catch (emailErr) {
      console.error('[Processor] Extraction failure email error:', emailErr);
    }

    return; // 피드백 생성 중단
  }

  // 6. Claude API 호출 (주차별 피드백 형식)
  let feedbackFormat: string;
  if (weekNumber >= 4) {
    feedbackFormat = `## 피드백 형식
피드백은 마크다운 형식으로 작성하세요. 반드시 아래 구조를 빠짐없이 작성하세요. 30,000자 이상 상세하게 작성하세요.

# 세퍼마 5기 4회차 과제 피드백

## 수강생: [이름]
## 종합 점수: [X]/100

### 핵심 진단 (한 문장 직설적으로)
### 파트별 점수 테이블 (Part1~5)
### 강점 (Top 3)
### 개선 필요 (Top 3)
### 즉시 실행 액션 (D+3 이내)

## Part 1: 헤드라인+서브헤드 심층 분석
### 1-1. 3초 법칙 + 후킹 공식 검증 (수강생 원문 인용, 후킹 공식 적용 여부)
### 1-2. 역설계 6단계 반영 검증 (상품→니즈→잠재문제→관심사→해결질문→후킹 역순 추적)
### 1-3. 서브헤드 보완력 검증

## Part 2: 고통섹션 심층 분석
### 2-1. 감정 COI Level 판정 (Level 1~5)
### 2-2. 숫자 COI 활용 분석 (직접손실/기회비용/미래비용)
### 2-3. V자 곡선 밸리 깊이 분석
### 2-4. 가짜 해결책 구조 분석

## Part 3: 전환 CTA + 솔루션 Before/After 심층 분석
### 3-1. 전환 CTA 분석 (짧고 강렬한가, 배치 타이밍)
### 3-2. Before/After 분석 (도파민 화법 3요소, 낙차)
### 3-3. 성공 사례/사회적 증거 분석
### 3-4. "교육이 곧 세일즈" 원칙 검증

## Part 4: 가치스택+가격표+FAQ 심층 분석
### 4-1. 마그네틱 4단계 온라인 변환 검증 (가치누적/앵커링/가격제시/ROI)
### 4-2. 구매 의사결정 저울 검증 (니즈+가치 vs 가격+장벽)
### 4-3. FAQ 선거절처리 분석 (4대 거절 FAQ 변환)
### 4-4. 최종 CTA 분석 (명확성/긴급성/감정피크/택일형)

## Part 5: 종합 로드맵 + 마무리
- 핵심 레버리지 포인트
- 수강생 유형 판정 (초보/중급)
- 스크립트→페이지 매핑 일치도 총평
- 미끄럼틀 배치 + 이탈방지 테크닉 총평
- D+7 액션 플랜 (오늘/내일/D+3/D+5/D+7)
- 엘런의 마무리 한마디
- 핵심 금언 3개`;
  } else if (weekNumber >= 2) {
    feedbackFormat = `## 피드백 형식
피드백은 마크다운 형식으로 작성하세요. 반드시 아래 구조를 빠짐없이 작성하세요. 30,000자 이상 상세하게 작성하세요.

# 세퍼마 5기 2회차 과제 피드백

## 수강생: [이름]
## 종합 점수: [X]/100

### 핵심 진단 (한 문장 직설적으로)
### 과제별 점수 테이블 (과제1, 과제2, 과제3, 교차검증)
### 강점 (Top 3)
### 개선 필요 (Top 3)
### 즉시 실행 액션 (D+3 이내)

## Part 1: 고객 가치 50가지 심층 분석
### 1-1. 상품/서비스 정보 (1,000자+)
### 1-2. 기능적 가치 (PART A) 전수 분석 (5,000자+, 25개 전체 항목 개별 분석 테이블)
### 1-3. 정서적 가치 (PART B) 전수 분석 (5,000자+, 25개 전체 항목 개별 분석)
### 1-4. 변화 / COI / 금전적 가치 (PART C) 심층 분석 (3,000자+)

## Part 2: 타겟 페르소나 캔버스 심층 분석
### 2-1. 인구통계/상황 분석 (1,500자+, 5대 질문 테스트 포함)
### 2-2. 핵심 고통 3가지 (2,000자+, Level 판정)
### 2-3. 이상적 미래 (1,500자+, 감각적 묘사 등급)
### 2-4. 기능적/정서적 가치 Top 5 (1,500자+)
### 2-5. COI + 가치 금액 (1,500자+)
### 2-6. 활용 가이드 심층 분석 (2,000자+, 광고 카피 3개+, 랜딩페이지 흐름, 상담 스크립트)

## Part 3: 목표 설정 심층 분석 (2,000자+)

## Part 4: 교차 검증 종합 결과 (1,500자+)
- 과제 1 ↔ 과제 2 일관성
- 불일치 항목 긴급 수정 가이드

## Part 5: 종합 로드맵 + 마무리 (1,500자+)
- 핵심 레버리지 포인트
- D+7 액션 플랜
- 엘런의 마무리 한마디
- 핵심 금언 3개`;
  } else {
    feedbackFormat = `## 피드백 형식
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
  }

  const systemPrompt = `${masterPrompt}

---
## 참고 자료 (RAG Context)
${ragContext ? ragContext.substring(0, 80000) : '(참고 자료 없음)'}
---

위 참고 자료를 바탕으로 아래 학생의 과제를 분석하고 상세한 피드백을 제공하세요.

중요 규칙:
- 반드시 마크다운 형식의 피드백 텍스트만 출력하세요.
- tool_call, bash 코드, 파일 읽기 명령어, XML 태그 등을 절대 출력하지 마세요.
- "I'll start by reading..." 같은 행동 설명을 하지 말고, 바로 피드백 본문을 작성하세요.
- 첫 줄은 반드시 "#" 마크다운 제목으로 시작하세요.

${feedbackFormat}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const feedbackStartTime = Date.now();

  console.log(`[Processor] Week ${weekNumber}, Model: ${aiModel}, MaxTokens: ${aiMaxTokens}`);

  // 스트리밍 모드 사용 (장시간 요청에 필수)
  const stream = anthropic.messages.stream({
    model: aiModel,
    max_tokens: aiMaxTokens,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `## 수강생 과제 제출물\n\n${studentSubmission}`,
      },
    ],
  });

  const response = await stream.finalMessage();

  let feedbackText = response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');

  const generationTimeMs = Date.now() - feedbackStartTime;

  // 5-1. 피드백 품질 검증 (tool_call/코드 오염 방지)
  const corruptionMarkers = ['<tool_call>', '</tool_call>', '<tool_result>', '<name>Bash</name>', 'dns.setDefaultResultOrder', '<bash>'];
  const hasCorruption = corruptionMarkers.some(m => feedbackText.includes(m));
  if (hasCorruption) {
    console.error('[Processor] CORRUPTED: output contains tool_call artifacts, cleaning...');
    // Extract real feedback starting from first markdown heading
    const headingMatch = feedbackText.match(/\n(#{1,2}\s+(?:세퍼마|🎯|수강생|피드백|종합|Part|핵심).*)/m);
    if (headingMatch && headingMatch.index !== undefined) {
      feedbackText = feedbackText.substring(headingMatch.index).trim();
      console.warn('[Processor] Extracted clean section: ' + feedbackText.length + ' chars');
    } else {
      // Strip all tool artifacts
      feedbackText = feedbackText
        .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
        .replace(/<tool_result>[\s\S]*?<\/tool_result>/g, '')
        .replace(/<bash>[\s\S]*?<\/bash>/g, '')
        .replace(/<arguments>[\s\S]*?<\/arguments>/g, '')
        .replace(/I'll start by reading[\s\S]*?(?=\n#|\n\n#)/g, '')
        .replace(/Let me (?:first|start|check)[\s\S]*?(?=\n#|\n\n#)/g, '')
        .trim();
      console.warn('[Processor] Stripped artifacts: ' + feedbackText.length + ' chars');
    }
    if (feedbackText.length < 1000 || corruptionMarkers.some(m => feedbackText.includes(m))) {
      console.error('[Processor] Still corrupted after cleanup. Marking job as failed.');
      await supabase.from('feedback_jobs').update({
        status: 'failed', error_message: 'AI output corrupted (tool_call artifacts). Auto-retry needed.',
        completed_at: new Date().toISOString(),
      }).eq('id', targetJobId);
      return;
    }
  }

  // 6. 점수 추출 (다양한 포맷 지원)
  const scoreMatch = feedbackText.match(/(?:총점|종합\s*점수)[:\s]*(\d+)\s*[/\/]\s*100/);
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
      ai_model: aiModel,
      cost_usd: parseFloat((((response.usage?.input_tokens || 0) * 5 / 1000000) + ((response.usage?.output_tokens || 0) * 15 / 1000000)).toFixed(4)),
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
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASSWORD?.trim();
    const smtpFrom = process.env.SMTP_FROM?.trim();

    console.warn(`[Processor] SMTP check: host=${smtpHost ? 'SET' : 'MISSING'}, user=${smtpUser ? 'SET' : 'MISSING'}, pass=${smtpPass ? 'SET' : 'MISSING'}`);

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
          port: parseInt((process.env.SMTP_PORT || '587').trim()),
          secure: false,
          auth: { user: smtpUser, pass: smtpPass },
        });

        const baseUrl = process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const feedbackUrl = `${baseUrl}/lms/feedbacks/${feedback?.id}`;

        const scoreText = score !== null ? `총점: ${score}/100` : '';
        const summaryPreview = feedbackText.substring(0, 500).replace(/[#*_]/g, '');

        // 주차/과정 정보 조회 (PDF 제목용)
        const { data: weekInfo } = await supabase
          .from('course_weeks')
          .select('week_number, title')
          .eq('id', assignment.week_id)
          .single();
        const { data: courseInfo } = await supabase
          .from('courses')
          .select('title')
          .eq('id', assignment.course_id)
          .single();

        const weekNumber = weekInfo?.week_number || 1;
        const weekTitle = weekInfo?.title || '과제';
        const courseTitle = courseInfo?.title || '마그네틱 세일즈';
        const dateStr = new Date().toISOString().slice(0, 10);
        const filenameBase = `피드백_${weekNumber}주차_${dateStr}`;

        // PDF 생성 (비동기 폰트 등록 → Buffer 렌더링, 60초 타임아웃)
        let pdfBuffer: Buffer | null = null;
        try {
          console.warn('[Processor] Starting PDF generation...');
          await registerFontsAsync();
          console.warn('[Processor] Fonts registered, rendering PDF...');

          const pdfPromise = renderToBuffer(
            React.createElement(FeedbackPdfDocument, {
              markdown: feedbackText,
              title: `${weekNumber}주차 AI 피드백 리포트`,
              subtitle: `${courseTitle} - ${weekTitle}`,
              score,
              createdAt: new Date().toISOString(),
            })
          );

          // 60초 타임아웃
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('PDF render timeout (60s)')), 60000)
          );

          const pdfRaw = await Promise.race([pdfPromise, timeoutPromise]);
          pdfBuffer = Buffer.from(pdfRaw);
          console.warn(`[Processor] PDF generated: ${pdfBuffer.length} bytes`);
        } catch (pdfErr) {
          const errMsg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          const errStack = pdfErr instanceof Error ? pdfErr.stack : '';
          console.error(`[Processor] PDF generation failed: ${errMsg}`);
          console.error(`[Processor] PDF error stack: ${errStack}`);
          // DB에 PDF 실패 기록 (job은 계속 성공 처리 - 피드백 텍스트는 이미 저장됨)
          try {
            await supabase.from('feedback_jobs').update({
              error_message: `PDF failed: ${errMsg}`,
            }).eq('id', targetJobId);
          } catch { /* ignore */ }
        }

        // 첨부파일 구성
        const attachments: Array<{ filename: string; content: string | Buffer; contentType?: string }> = [
          {
            filename: `${filenameBase}.md`,
            content: feedbackText,
            contentType: 'text/markdown; charset=utf-8',
          },
        ];
        if (pdfBuffer) {
          attachments.push({
            filename: `${filenameBase}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        }

        const adminEmail = process.env.SMTP_TO?.trim();
        await transporter.sendMail({
          from: `"마그네틱 세일즈" <${smtpFrom || smtpUser}>`,
          to: recipientEmail,
          ...(adminEmail && adminEmail !== recipientEmail ? { cc: adminEmail } : {}),
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
                마그네틱 세일즈 마스터클래스 | ${pdfBuffer ? 'MD, PDF 파일이 첨부되어 있습니다' : 'MD 파일이 첨부되어 있습니다 (PDF는 홈페이지에서 다운로드 가능)'}
              </p>
            </div>
          `,
          attachments,
        });

        console.warn(`[Processor] Email sent to ${recipientEmail}${adminEmail ? `, cc: ${adminEmail}` : ''} with ${attachments.length} attachments`);

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
  console.warn(`[Processor] Feedback completed: jobId=${targetJobId}, score=${score}, elapsed=${elapsedMs}ms`);
}

// ===== 2회차+ pgvector 기반 시맨틱 RAG 검색 (병렬 최적화) =====
async function loadRagViaSemanticSearch(
  content: Record<string, unknown>
): Promise<string> {
  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!openaiKey || !supabaseUrl || !supabaseServiceKey) {
    console.warn('[RAG] Missing OPENAI_API_KEY or Supabase keys for semantic search, falling back to empty');
    return '';
  }

  // 2회차 과제 관련 핵심 검색 쿼리 (가이드 기반, 5개로 축소)
  const queries = [
    '고객 가치 기능적 정서적 구분 50가지 가치 스태킹',
    '페르소나 캔버스 인구통계 고통 이상적 미래 COI',
    'Before After 변화 감각적 묘사 목표 설정 선언문',
    '마그네틱 세일즈 타겟 고객 구체성 5대 질문 가치 제안',
    '광고 카피 랜딩페이지 상담 스크립트 트래픽 컨텐츠 활용',
  ];

  // 학생 제출물에서 키워드 추출 (1개 추가)
  const studentText = Object.values(content)
    .filter(v => typeof v === 'string')
    .join(' ')
    .substring(0, 500);
  if (studentText.length > 50) {
    queries.push(studentText.substring(0, 200));
  }

  const ragStart = Date.now();

  // 병렬 1: 모든 쿼리의 임베딩을 한번에 생성 (배치 API)
  let embeddings: number[][] = [];
  try {
    const embResp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: queries }),
    });

    if (embResp.ok) {
      const embData = await embResp.json();
      embeddings = (embData.data || [])
        .sort((a: { index: number }, b: { index: number }) => a.index - b.index)
        .map((d: { embedding: number[] }) => d.embedding);
    }
  } catch (err) {
    console.warn('[RAG] Batch embedding failed:', err);
    return '';
  }

  if (embeddings.length === 0) return '';

  // 병렬 2: 모든 pgvector 검색을 동시 실행
  const searchPromises = embeddings.map(async (embedding) => {
    try {
      const searchResp = await fetch(
        `${supabaseUrl}/rest/v1/rpc/search_seperma_feedback`,
        {
          method: 'POST',
          headers: {
            'apikey': supabaseServiceKey!,
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query_embedding: embedding,
            match_threshold: 0.7,
            match_count: 5,
          }),
        }
      );
      if (searchResp.ok) return await searchResp.json();
      return [];
    } catch {
      return [];
    }
  });

  const searchResults = await Promise.all(searchPromises);

  // 결과 통합 + 중복 제거
  const allResults: Array<{ category: string; content: string; similarity: number }> = [];
  const seenContent = new Set<string>();

  for (const results of searchResults) {
    if (!Array.isArray(results)) continue;
    for (const r of results) {
      if (!seenContent.has(r.content)) {
        seenContent.add(r.content);
        allResults.push({
          category: r.category || '',
          content: r.content || '',
          similarity: r.similarity || 0,
        });
      }
    }
  }

  // 유사도 기준 정렬, 상위 20개
  allResults.sort((a, b) => b.similarity - a.similarity);
  const topResults = allResults.slice(0, 20);

  console.warn(`[RAG] Semantic search: ${queries.length} queries → ${allResults.length} results → top ${topResults.length} (${Date.now() - ragStart}ms)`);

  return topResults
    .map(r => `[${r.category}] (유사도: ${(r.similarity * 100).toFixed(1)}%)\n${r.content}`)
    .join('\n\n---\n\n');
}

// GET: 대기열 상태 조회
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-internal-secret');
  if (!validateInternalApiSecret(authHeader)) {
    // JWT 인증 폴백
    const bearerHeader = request.headers.get('authorization');
    let authed = false;
    if (bearerHeader?.startsWith('Bearer ')) {
      try {
        const payload = await verifyAccessToken(bearerHeader.substring(7));
        if (payload?.sub) authed = true;
      } catch { /* JWT 실패 */ }
    }
    if (!authed) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
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
