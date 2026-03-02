// src/app/api/auth/forgot-password/route.ts
// 비밀번호 찾기: 이메일로 리셋 링크 발송

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateSecureToken, hashToken } from '@/lib/security/crypto';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const maxDuration = 30;

// Rate limit: IP당 5회/10분
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10분

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT) {
    return false;
  }

  entry.count++;
  return true;
}

// 동일 응답 (이메일 열거 공격 방지)
const SUCCESS_RESPONSE = {
  success: true,
  message: '등록된 이메일이라면 비밀번호 재설정 링크가 발송되었습니다.',
};

export async function POST(request: NextRequest) {
  try {
    // Rate limit 체크
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { success: false, error: { code: 'RATE_LIMIT', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' } },
        { status: 429 }
      );
    }

    const body = await request.json();
    const email = body.email?.trim()?.toLowerCase();

    if (!email) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: '이메일을 입력해주세요.' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // profiles에서 유저 확인
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    // 유저가 없어도 동일한 성공 응답 반환 (이메일 열거 방지)
    if (!profile) {
      return NextResponse.json(SUCCESS_RESPONSE);
    }

    // 토큰 생성 + 해시
    const rawToken = generateSecureToken(48);
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간

    // 기존 미사용 토큰 만료 처리
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', profile.id)
      .is('used_at', null);

    // 새 토큰 저장
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: profile.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Token insert error:', insertError);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
        { status: 500 }
      );
    }

    // 리셋 링크 생성
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://sales-funnelbank.vercel.app';
    const resetUrl = `${siteUrl}/reset-password?token=${rawToken}`;

    // SMTP 설정
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPass = process.env.SMTP_PASSWORD?.trim();
    const smtpFrom = process.env.SMTP_FROM?.trim();

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.error('SMTP not configured');
      return NextResponse.json(SUCCESS_RESPONSE); // SMTP 미설정이어도 동일 응답
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt((process.env.SMTP_PORT || '587').trim()),
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const userName = profile.full_name || '수강생';

    await transporter.sendMail({
      from: `"마그네틱 세일즈" <${smtpFrom || smtpUser}>`,
      to: email,
      subject: '[마그네틱 세일즈] 비밀번호 재설정',
      html: `
        <div style="max-width:480px;margin:0 auto;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#333;">
          <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);padding:32px 24px;border-radius:12px 12px 0 0;text-align:center;">
            <h1 style="color:#fff;font-size:22px;margin:0;">비밀번호 재설정</h1>
          </div>
          <div style="background:#fff;padding:32px 24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 16px;">${userName}님, 안녕하세요.</p>
            <p style="margin:0 0 24px;line-height:1.6;">
              비밀번호 재설정을 요청하셨습니다.<br/>
              아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
            </p>
            <div style="text-align:center;margin:0 0 24px;">
              <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#ec4899);color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
                비밀번호 재설정하기
              </a>
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
              이 링크는 <strong>1시간</strong> 후 만료됩니다.
            </p>
            <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
              본인이 요청하지 않았다면 이 이메일을 무시해주세요.
            </p>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px;" />
            <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
              Magnetic Sales Inc.
            </p>
          </div>
        </div>
      `,
    });

    return NextResponse.json(SUCCESS_RESPONSE);
  } catch (error) {
    console.error('Forgot password error:', error);
    // 에러가 나도 동일 응답 (정보 노출 방지)
    return NextResponse.json(SUCCESS_RESPONSE);
  }
}
