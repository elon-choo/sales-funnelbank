// src/app/api/md-to-pdf/route.ts
// Markdown → PDF 변환 테스트/디버깅 엔드포인트
import { NextRequest, NextResponse } from 'next/server';
import { registerFontsAsync } from '@/lib/pdf/register-fonts';
import { mdToPdf } from '@/lib/pdf/md-to-pdf';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const maxDuration = 30;

const INTERNAL_API_SECRET = (process.env.INTERNAL_API_SECRET || process.env.CRON_SECRET_FEEDBACK || '').trim();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('x-internal-secret');
  if (authHeader !== INTERNAL_API_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let markdown: string;
    let filename = 'output.pdf';

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const body = await request.json();
      markdown = body.markdown;
      filename = body.filename || filename;
    } else {
      markdown = await request.text();
    }

    if (!markdown || typeof markdown !== 'string') {
      return NextResponse.json({ error: 'markdown 필드가 필요합니다.' }, { status: 400 });
    }

    // 디버그 정보
    const fontsDir = path.join(process.cwd(), 'public', 'fonts');
    const debug = {
      cwd: process.cwd(),
      fontsDir,
      regularExists: fs.existsSync(path.join(fontsDir, 'NotoSansKR-Regular.ttf')),
      boldExists: fs.existsSync(path.join(fontsDir, 'NotoSansKR-Bold.ttf')),
      VERCEL_URL: process.env.VERCEL_URL || '(not set)',
    };
    console.warn('[md-to-pdf] Debug:', JSON.stringify(debug));

    // 비동기 폰트 등록 (Vercel에서 fetch 필요)
    await registerFontsAsync();

    // PDF 생성
    const pdfBuffer = await mdToPdf(markdown);
    console.warn(`[md-to-pdf] PDF generated: ${pdfBuffer.length} bytes`);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('[md-to-pdf] Error:', error);
    return NextResponse.json({
      error: 'PDF 변환 실패',
      detail: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
