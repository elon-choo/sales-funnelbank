// src/app/api/lms/admin/roles/route.ts
// 관리자: 사용자 역할 변경 API (user/premium/admin/owner)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth } from '@/lib/lms/guards';

export async function PATCH(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    try {
      // Only admin/owner can change roles
      if (auth.lmsRole !== 'admin' && auth.tier !== 'ENTERPRISE') {
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

      // Get current user's role to check permissions
      const { data: currentUser } = await supabase
        .from('profiles')
        .select('role, tier')
        .eq('id', auth.userId)
        .single();

      const isOwner = currentUser?.role === 'owner';
      const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'owner';

      // Get target user's current role
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

      // Permission checks
      // 1. Can't change your own role
      if (userId === auth.userId) {
        return NextResponse.json(
          { success: false, error: { message: '자신의 역할은 변경할 수 없습니다' } },
          { status: 403 }
        );
      }

      // 2. Only owner can demote admin
      if ((targetUser.role === 'admin' || targetUser.role === 'owner') && !isOwner) {
        return NextResponse.json(
          { success: false, error: { message: 'Admin 역할 변경은 Owner만 가능합니다' } },
          { status: 403 }
        );
      }

      // 3. Only owner can promote to owner
      if (newRole === 'owner' && !isOwner) {
        return NextResponse.json(
          { success: false, error: { message: 'Owner 지정은 현재 Owner만 가능합니다' } },
          { status: 403 }
        );
      }

      // 4. Non-owner admin can only set: user, premium, admin
      if (!isOwner && newRole === 'owner') {
        return NextResponse.json(
          { success: false, error: { message: 'Owner 지정은 현재 Owner만 가능합니다' } },
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
