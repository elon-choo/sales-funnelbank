// src/app/api/auth/reset-password/route.ts
// 비밀번호 재설정: 토큰 검증 + 비밀번호 변경

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { hashToken } from '@/lib/security/crypto';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, newPassword } = body;

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: '토큰과 새 비밀번호가 필요합니다.' } },
        { status: 400 }
      );
    }

    // 비밀번호 최소 길이
    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION', message: '비밀번호는 6자 이상이어야 합니다.' } },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 토큰 해시로 검색
    const tokenHash = await hashToken(token);
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id, expires_at, used_at')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !resetToken) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_TOKEN', message: '유효하지 않은 링크입니다. 비밀번호 재설정을 다시 요청해주세요.' } },
        { status: 400 }
      );
    }

    // 이미 사용된 토큰
    if (resetToken.used_at) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_USED', message: '이미 사용된 링크입니다. 비밀번호 재설정을 다시 요청해주세요.' } },
        { status: 400 }
      );
    }

    // 만료 확인
    if (new Date(resetToken.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'TOKEN_EXPIRED', message: '링크가 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.' } },
        { status: 400 }
      );
    }

    // 비밀번호 변경
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      resetToken.user_id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json(
        { success: false, error: { code: 'UPDATE_ERROR', message: '비밀번호 변경에 실패했습니다. 다시 시도해주세요.' } },
        { status: 500 }
      );
    }

    // 토큰 사용 처리
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);

    // 해당 유저의 다른 미사용 토큰도 모두 만료 처리
    await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('user_id', resetToken.user_id)
      .is('used_at', null);

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
