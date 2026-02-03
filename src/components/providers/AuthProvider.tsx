
// src/components/providers/AuthProvider.tsx
'use client';

import { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';

/**
 * AuthProvider
 * - useAuth 훅을 통해 인증 로직(세션 복구 등)을 실행
 * - 별도의 Context Provider 없이 Zustand를 사용하므로, 
 *   여기서는 초기화 로직이 담긴 hook을 마운트하는 역할을 함.
 * - 필요 시 로딩 스크린을 여기서 처리할 수 있음.
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
    const { isLoading } = useAuth(); // hook 내부에서 세션 복구 로직 실행

    // 초기 로딩 중일 때 표시할 UI (선택 사항)
    // 여기서는 단순히 children을 렌더링하거나, 전역 로딩 스피너를 둘 수 있음.
    // UX: 로딩 중에는 아무것도 안 보여주거나 스켈레톤을 보여주는 것이 좋음

    // if (isLoading) {
    //   return <div className="flex items-center justify-center min-h-screen">Loading authentication...</div>;
    // }

    return <>{children}</>;
}
