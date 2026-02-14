// src/app/api/lms/feedbacks/[feedbackId]/pdf/route.ts
// PDF 다운로드 API - 피드백 마크다운을 PDF로 변환
import { NextRequest, NextResponse } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyAccessToken } from '@/lib/auth/tokens';
import { FeedbackPdfDocument } from '@/lib/pdf/md-to-pdf';
import { registerFontsAsync } from '@/lib/pdf/register-fonts';
import React from 'react';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> }
) {
  try {
    const { feedbackId } = await params;

    // JWT 인증
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: { message: '인증이 필요합니다' } }, { status: 401 });
    }

    const token = authHeader.slice(7);
    const payload = await verifyAccessToken(token);
    if (!payload) {
      return NextResponse.json({ success: false, error: { message: '유효하지 않은 토큰입니다' } }, { status: 401 });
    }

    const userId = payload.sub as string;
    const supabase = createAdminClient();

    // 피드백 조회 (본인 것만)
    const { data: feedback, error: fbError } = await supabase
      .from('feedbacks')
      .select(`
        id, content, scores, created_at,
        assignments!inner (
          id, user_id, course_id, week_id,
          courses ( title ),
          course_weeks ( week_number, title )
        )
      `)
      .eq('id', feedbackId)
      .single();

    if (fbError || !feedback) {
      return NextResponse.json({ success: false, error: { message: '피드백을 찾을 수 없습니다' } }, { status: 404 });
    }

    // 관리자 체크
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, tier')
      .eq('id', userId)
      .single();

    const isAdmin = profile?.role === 'admin' || profile?.role === 'owner' || profile?.tier === 'ENTERPRISE';
    // Supabase may return assignments as array or object
    const rawAssignment = feedback.assignments as any;
    const assignment = Array.isArray(rawAssignment) ? rawAssignment[0] : rawAssignment;

    // 본인 피드백이 아니고 관리자도 아니면 403
    if (assignment?.user_id !== userId && !isAdmin) {
      return NextResponse.json({ success: false, error: { message: '접근 권한이 없습니다' } }, { status: 403 });
    }

    const score = (feedback.scores as any)?.total ?? null;
    const rawWeek = assignment?.course_weeks;
    const week = Array.isArray(rawWeek) ? rawWeek[0] : rawWeek;
    const rawCourse = assignment?.courses;
    const course = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
    const weekNumber = week?.week_number;
    const weekTitle = week?.title || '과제';
    const courseTitle = course?.title || '마그네틱 세일즈';

    // PDF 생성 (비동기 폰트 등록)
    await registerFontsAsync();

    const pdfBuffer = await renderToBuffer(
      React.createElement(FeedbackPdfDocument, {
        markdown: feedback.content,
        title: `${weekNumber}주차 AI 피드백 리포트`,
        subtitle: `${courseTitle} - ${weekTitle}`,
        score,
        createdAt: feedback.created_at,
      })
    );

    const filename = `feedback_week${weekNumber}_${new Date().toISOString().slice(0, 10)}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[PDF] Generation error:', error);
    return NextResponse.json(
      { success: false, error: { message: 'PDF 생성 중 오류가 발생했습니다' } },
      { status: 500 }
    );
  }
}
