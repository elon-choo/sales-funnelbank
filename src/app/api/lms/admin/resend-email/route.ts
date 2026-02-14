// src/app/api/lms/admin/resend-email/route.ts
// 관리자: 피드백 이메일 재발송 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';
import nodemailer from 'nodemailer';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { FeedbackPdfDocument } from '@/lib/pdf/md-to-pdf';
import { registerFontsAsync } from '@/lib/pdf/register-fonts';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (_auth, supabase) => {
    try {
      const { feedbackId } = await request.json();

      if (!feedbackId) {
        return NextResponse.json(
          { success: false, error: { message: 'feedbackId는 필수입니다' } },
          { status: 400 }
        );
      }

      // Feedback + assignment + user info
      const { data: feedback, error: fbErr } = await supabase
        .from('feedbacks')
        .select(`
          id, content, scores, created_at,
          assignments!inner (
            id, user_id, course_id, week_id, version,
            profiles (email, full_name),
            courses (title),
            course_weeks (week_number, title)
          )
        `)
        .eq('id', feedbackId)
        .single();

      if (fbErr || !feedback) {
        return NextResponse.json(
          { success: false, error: { message: '피드백을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fbAny = feedback as any;
      const assignment = Array.isArray(fbAny.assignments) ? fbAny.assignments[0] : fbAny.assignments;
      const profile = Array.isArray(assignment?.profiles) ? assignment.profiles[0] : assignment?.profiles;
      const course = Array.isArray(assignment?.courses) ? assignment.courses[0] : assignment?.courses;
      const week = Array.isArray(assignment?.course_weeks) ? assignment.course_weeks[0] : assignment?.course_weeks;

      const recipientEmail = profile?.email;
      const recipientName = profile?.full_name || '수강생';

      if (!recipientEmail) {
        return NextResponse.json(
          { success: false, error: { message: '수강생 이메일 없음' } },
          { status: 400 }
        );
      }

      // SMTP config
      const smtpHost = process.env.SMTP_HOST?.trim();
      const smtpUser = process.env.SMTP_USER?.trim();
      const smtpPass = process.env.SMTP_PASSWORD?.trim();
      const smtpFrom = process.env.SMTP_FROM?.trim();

      if (!smtpHost || !smtpUser || !smtpPass) {
        return NextResponse.json(
          { success: false, error: { message: 'SMTP 설정이 없습니다' } },
          { status: 500 }
        );
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt((process.env.SMTP_PORT || '587').trim()),
        secure: false,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const feedbackText = feedback.content || '';
      const scores = feedback.scores as { total?: number } | null;
      const score = scores?.total ?? null;
      const weekNumber = week?.week_number || 1;
      const weekTitle = week?.title || '과제';
      const courseTitle = course?.title || '마그네틱 세일즈';
      const dateStr = new Date().toISOString().slice(0, 10);
      const filenameBase = `피드백_${weekNumber}주차_${dateStr}`;

      const baseUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const feedbackUrl = `${baseUrl}/lms/feedbacks/${feedback.id}`;

      // Generate PDF
      let pdfBuffer: Buffer | null = null;
      try {
        await registerFontsAsync();
        const pdfRaw = await Promise.race([
          renderToBuffer(
            React.createElement(FeedbackPdfDocument, {
              markdown: feedbackText,
              title: `${weekNumber}주차 AI 피드백 리포트`,
              subtitle: `${courseTitle} - ${weekTitle}`,
              score,
              createdAt: feedback.created_at,
            })
          ),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('PDF timeout')), 30000)
          ),
        ]);
        pdfBuffer = Buffer.from(pdfRaw);
      } catch (e) {
        console.error('[Resend] PDF generation failed:', e);
      }

      // Attachments
      const attachments: Array<{ filename: string; content: string | Buffer; contentType?: string }> = [
        { filename: `${filenameBase}.md`, content: feedbackText, contentType: 'text/markdown; charset=utf-8' },
      ];
      if (pdfBuffer) {
        attachments.push({ filename: `${filenameBase}.pdf`, content: pdfBuffer, contentType: 'application/pdf' });
      }

      const scoreText = score !== null ? `총점: ${score}/100` : '';
      const summaryPreview = feedbackText.substring(0, 500).replace(/[#*_]/g, '');

      await transporter.sendMail({
        from: `"마그네틱 세일즈" <${smtpFrom || smtpUser}>`,
        to: recipientEmail,
        subject: `[피드백 재발송] ${weekNumber}주차 과제 피드백 ${scoreText}`,
        html: `
          <div style="font-family: 'Pretendard', -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1a2e; color: #e0e0e0; padding: 32px; border-radius: 16px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <h1 style="color: #a855f7; font-size: 24px; margin: 0;">AI 피드백 (재발송)</h1>
            </div>
            <p style="color: #d0d0d0; font-size: 16px;">안녕하세요 ${recipientName}님,</p>
            <p style="color: #b0b0b0;">${weekNumber}주차 과제에 대한 AI 피드백을 다시 보내드립니다.</p>
            ${score !== null ? `
            <div style="background: #2a2a4a; padding: 20px; border-radius: 12px; text-align: center; margin: 20px 0;">
              <p style="margin: 0; color: #888; font-size: 12px;">총점</p>
              <p style="margin: 8px 0 0; font-size: 36px; font-weight: bold; color: ${score >= 70 ? '#22c55e' : score >= 40 ? '#eab308' : '#ef4444'};">${score}<span style="font-size: 16px; color: #888;">/100</span></p>
            </div>` : ''}
            <div style="background: #16162e; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="color: #a0a0a0; font-size: 14px; line-height: 1.6;">${summaryPreview}...</p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${feedbackUrl}" style="display: inline-block; background: linear-gradient(135deg, #a855f7, #ec4899); color: white; padding: 14px 32px; border-radius: 12px; text-decoration: none; font-weight: bold;">홈페이지에서 전체 피드백 보기</a>
            </div>
            <p style="color: #888; font-size: 12px; text-align: center; margin-top: 24px;">
              ${pdfBuffer ? 'MD, PDF 파일이 첨부되어 있습니다' : 'MD 파일이 첨부되어 있습니다'}
            </p>
          </div>
        `,
        attachments,
      });

      // Update sent_at
      await supabase
        .from('feedbacks')
        .update({ sent_at: new Date().toISOString() })
        .eq('id', feedbackId);

      return NextResponse.json({
        success: true,
        data: {
          to: recipientEmail,
          hasPdf: !!pdfBuffer,
          pdfSize: pdfBuffer ? `${(pdfBuffer.length / 1024).toFixed(1)}KB` : null,
        },
      });
    } catch (error) {
      console.error('[Resend Email Error]', error);
      return NextResponse.json(
        { success: false, error: { message: error instanceof Error ? error.message : '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
