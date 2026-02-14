// src/app/api/lms/test-email/route.ts
// SMTP 이메일 발송 테스트 엔드포인트 (디버깅용)
import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';

const INTERNAL_API_SECRET = (process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET_FEEDBACK || '').trim();

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('x-internal-secret');
  if (authHeader !== INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const diagnostics: Record<string, unknown> = {};

  try {
    // 1. 환경변수 체크
    diagnostics.SMTP_HOST = process.env.SMTP_HOST || '(NOT SET)';
    diagnostics.SMTP_PORT = process.env.SMTP_PORT || '(NOT SET)';
    diagnostics.SMTP_USER = process.env.SMTP_USER || '(NOT SET)';
    diagnostics.SMTP_PASSWORD = process.env.SMTP_PASSWORD ? `SET (${process.env.SMTP_PASSWORD.length} chars)` : '(NOT SET)';
    diagnostics.SMTP_FROM = process.env.SMTP_FROM || '(NOT SET)';
    diagnostics.SMTP_TO = process.env.SMTP_TO || '(NOT SET)';
    diagnostics.NODE_ENV = process.env.NODE_ENV;

    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASSWORD?.trim();
    const smtpFrom = process.env.SMTP_FROM?.trim();

    if (!smtpHost || !smtpUser || !smtpPass) {
      return NextResponse.json({
        success: false,
        error: 'SMTP env vars missing',
        diagnostics,
      }, { status: 500 });
    }

    // 2. Transporter 생성
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt((process.env.SMTP_PORT || '587').trim()),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // 3. SMTP 연결 확인
    const verifyResult = await transporter.verify();
    diagnostics.smtpVerify = verifyResult;

    // 4. 이메일 발송
    const targetEmail = (process.env.SMTP_TO || smtpFrom || smtpUser || '').trim();
    const result = await transporter.sendMail({
      from: `"마그네틱 세일즈" <${smtpFrom || smtpUser}>`,
      to: targetEmail,
      subject: `[테스트] Vercel SMTP 이메일 테스트 (${new Date().toISOString()})`,
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2>SMTP 이메일 테스트 성공</h2>
          <p>이 이메일은 Vercel 서버리스 함수에서 발송되었습니다.</p>
          <pre>${JSON.stringify(diagnostics, null, 2)}</pre>
        </div>
      `,
    });

    diagnostics.messageId = result.messageId;
    diagnostics.sentTo = targetEmail;

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      diagnostics,
    });
  } catch (error) {
    diagnostics.error = error instanceof Error ? error.message : String(error);
    diagnostics.stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnostics,
    }, { status: 500 });
  }
}
