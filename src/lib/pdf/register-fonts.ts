// src/lib/pdf/register-fonts.ts
// @react-pdf/renderer 한국어 폰트 등록
// 로컬: public/fonts/ 파일 경로, Vercel: CDN → /tmp/ 저장 후 파일 경로
import { Font } from '@react-pdf/renderer';
import path from 'path';
import fs from 'fs';
import { tmpdir } from 'os';

let fontsRegistered = false;

/**
 * 동기 폰트 등록 (로컬 전용 - public/fonts/ 파일이 있을 때만)
 */
export function registerFonts(): void {
  if (fontsRegistered) return;

  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  const regularPath = path.join(fontsDir, 'NotoSansKR-Regular.ttf');
  const boldPath = path.join(fontsDir, 'NotoSansKR-Bold.ttf');

  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    doRegister(regularPath, boldPath);
  }
}

/**
 * 비동기 폰트 등록 - 모든 환경에서 동작
 * 로컬: public/fonts/ 파일 사용
 * Vercel: CDN에서 다운로드 → /tmp/ 저장 → 파일 경로로 등록
 */
export async function registerFontsAsync(): Promise<void> {
  if (fontsRegistered) return;

  // 1. public/fonts/ 직접 접근 시도
  const fontsDir = path.join(process.cwd(), 'public', 'fonts');
  const regularPath = path.join(fontsDir, 'NotoSansKR-Regular.ttf');
  const boldPath = path.join(fontsDir, 'NotoSansKR-Bold.ttf');

  if (fs.existsSync(regularPath) && fs.existsSync(boldPath)) {
    doRegister(regularPath, boldPath);
    return;
  }

  // 2. /tmp/ 캐시 확인
  const tempFontsDir = path.join(tmpdir(), 'pdf-fonts');
  const tempRegular = path.join(tempFontsDir, 'NotoSansKR-Regular.ttf');
  const tempBold = path.join(tempFontsDir, 'NotoSansKR-Bold.ttf');

  if (fs.existsSync(tempRegular) && fs.existsSync(tempBold)) {
    doRegister(tempRegular, tempBold);
    return;
  }

  // 3. CDN에서 다운로드 → /tmp/ 저장
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'https://sales-funnelbank.vercel.app'));

  console.warn(`[registerFonts] Downloading fonts from ${baseUrl}/fonts/ → /tmp/pdf-fonts/`);

  fs.mkdirSync(tempFontsDir, { recursive: true });

  const [regularResp, boldResp] = await Promise.all([
    fetch(`${baseUrl}/fonts/NotoSansKR-Regular.ttf`),
    fetch(`${baseUrl}/fonts/NotoSansKR-Bold.ttf`),
  ]);

  if (!regularResp.ok || !boldResp.ok) {
    throw new Error(`Font download failed: regular=${regularResp.status}, bold=${boldResp.status}`);
  }

  const regularBuffer = Buffer.from(await regularResp.arrayBuffer());
  const boldBuffer = Buffer.from(await boldResp.arrayBuffer());

  fs.writeFileSync(tempRegular, regularBuffer);
  fs.writeFileSync(tempBold, boldBuffer);

  console.warn(`[registerFonts] Saved: regular=${regularBuffer.length}B, bold=${boldBuffer.length}B`);

  doRegister(tempRegular, tempBold);
}

function doRegister(regularPath: string, boldPath: string): void {
  if (fontsRegistered) return;

  Font.register({
    family: 'NotoSansKR',
    fonts: [
      { src: regularPath, fontWeight: 400 },
      { src: regularPath, fontWeight: 400, fontStyle: 'italic' as const },
      { src: boldPath, fontWeight: 700 },
      { src: boldPath, fontWeight: 700, fontStyle: 'italic' as const },
    ],
  });

  Font.registerHyphenationCallback((word) => [word]);
  fontsRegistered = true;
  console.warn('[registerFonts] Fonts registered successfully');
}
