
// src/hooks/useAuth.ts

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { createClient } from '@/lib/supabase/client';

export function useAuth() {
    const router = useRouter();
    const {
        user,
        accessToken,
        isAuthenticated,
        isLoading,
        login,
        logout,
        setLoading,
    } = useAuthStore();
    const initialized = useRef(false);

    // 세션 복구 (새로고침 시)
    useEffect(() => {
        if (initialized.current) return;
        initialized.current = true;

        const restoreSession = async () => {
            try {
                // 1. /api/auth/me 호출로 세션 유효성 확인 + 새 Access Token 발급 가능성
                // 하지만 여기서는 Supabase Client의 세션을 먼저 확인하는 것이 일반적
                // v2.0 아키텍처에서는 HttpOnly Cookie에 Refresh Token이 있으므로,
                // API를 호출하여 Access Token을 받아와야 함.

                // 임시: Supabase 세션 체크 (클라이언트 사이드) 
                // 주의: v2.0은 서버 사이드 쿠키 위주이나, 클라이언트 편의를 위해 혼용될 수 있음
                // 여기서는 명확히 API를 통해 유저 정보를 가져오는 패턴을 권장함

                const res = await fetch('/api/auth/me');
                if (res.ok) {
                    const data = await res.json();
                    if (data.success && data.data) {
                        login(data.data.user, data.data.accessToken);
                    } else {
                        logout();
                    }
                } else {
                    // 401 Unauthorized etc
                    logout();
                }
            } catch (error) {
                console.error('Session restore failed:', error);
                logout();
            } finally {
                setLoading(false);
            }
        };

        if (!user) {
            restoreSession();
        }
    }, [login, logout, setLoading, user]);

    return {
        user,
        accessToken,
        isAuthenticated,
        isLoading,
        logout: async () => {
            // 서버 로그아웃 호출
            await fetch('/api/auth/logout', { method: 'POST' });
            logout();
            router.push('/login');
        }
    };
}
