// src/lib/auth/permissions.ts
// 중앙화된 권한 체크 헬퍼 - 모든 파일에서 이 함수만 사용할 것

import type { UserRole, UserTier } from '@/types/auth';

/**
 * Admin 역할 여부 확인 (admin, owner, 또는 ENTERPRISE 티어)
 */
export function hasAdminRole(role: UserRole | string, tier?: UserTier | string): boolean {
  return role === 'admin' || role === 'owner' || tier === 'ENTERPRISE';
}

/**
 * Owner 역할 여부 확인
 */
export function isOwnerRole(role: UserRole | string): boolean {
  return role === 'owner';
}

/**
 * 특정 역할로 승격 가능 여부 확인
 * - admin/owner로 승격: owner만 가능
 * - premium으로 승격: admin 이상 가능
 * - user로 변경: admin 이상 가능
 */
export function canPromoteTo(
  requesterRole: UserRole | string,
  targetCurrentRole: UserRole | string,
  newRole: UserRole | string
): { allowed: boolean; reason?: string } {
  const requesterIsOwner = isOwnerRole(requesterRole);
  const requesterIsAdmin = hasAdminRole(requesterRole);

  // 기본: admin 이상만 역할 변경 가능
  if (!requesterIsAdmin) {
    return { allowed: false, reason: '관리자 권한이 필요합니다' };
  }

  // owner 역할로 승격: owner만 가능
  if (newRole === 'owner' && !requesterIsOwner) {
    return { allowed: false, reason: 'Owner 지정은 현재 Owner만 가능합니다' };
  }

  // admin 역할로 승격: owner만 가능
  if (newRole === 'admin' && !requesterIsOwner) {
    return { allowed: false, reason: 'Admin 승격은 Owner만 가능합니다' };
  }

  // 기존 admin/owner 역할 변경: owner만 가능
  if ((targetCurrentRole === 'admin' || targetCurrentRole === 'owner') && !requesterIsOwner) {
    return { allowed: false, reason: 'Admin/Owner 역할 변경은 Owner만 가능합니다' };
  }

  return { allowed: true };
}
