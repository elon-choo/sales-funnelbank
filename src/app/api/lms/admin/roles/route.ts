// src/app/api/lms/admin/roles/route.ts
// 관리자: 사용자 역할 변경 API (user/premium/admin/owner)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';
import { hasAdminRole, canPromoteTo } from '@/lib/auth/permissions';

export async function PATCH(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      // Admin 이상만 역할 변경 가능
      if (!hasAdminRole(auth.role, auth.tier)) {
        return NextResponse.json(
          { success: false, error: { message: '관리자 권한이 필요합니다' } },
          { status: 403 }
        );
      }

      const { userId, newRole, newTier } = await request.json();

      if (!userId || !newRole) {
        return NextResponse.json(
          { success: false, error: { message: 'userId와 newRole은 필수입니다' } },
          { status: 400 }
        );
      }

      const validRoles = ['user', 'premium', 'admin', 'owner'];
      if (!validRoles.includes(newRole)) {
        return NextResponse.json(
          { success: false, error: { message: `유효하지 않은 역할: ${newRole}` } },
          { status: 400 }
        );
      }

      // 대상 사용자 조회
      const { data: targetUser, error: targetErr } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, tier')
        .eq('id', userId)
        .single();

      if (targetErr || !targetUser) {
        return NextResponse.json(
          { success: false, error: { message: '사용자를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 자기 자신 역할 변경 금지
      if (userId === auth.userId) {
        return NextResponse.json(
          { success: false, error: { message: '자신의 역할은 변경할 수 없습니다' } },
          { status: 403 }
        );
      }

      // 중앙화된 권한 검증 (permissions.ts)
      const permCheck = canPromoteTo(auth.role, targetUser.role, newRole);
      if (!permCheck.allowed) {
        return NextResponse.json(
          { success: false, error: { message: permCheck.reason || '권한이 부족합니다' } },
          { status: 403 }
        );
      }

      // Determine tier based on role
      let tier = 'FREE';
      if (newRole === 'premium') tier = 'PREMIUM';
      if (newRole === 'admin' || newRole === 'owner') tier = 'ENTERPRISE';
      // Allow explicit tier override
      if (newTier) tier = newTier;

      // Update profile
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          tier,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (updateErr) {
        console.error('[Role Update Error]', updateErr);
        return NextResponse.json(
          { success: false, error: { message: '역할 변경에 실패했습니다' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          userId,
          previousRole: targetUser.role,
          newRole,
          tier,
          email: targetUser.email,
        },
      });
    } catch (error) {
      console.error('[Role API Error]', error);
      return NextResponse.json(
        { success: false, error: { message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
