
// src/stores/authStore.ts

import { create } from 'zustand';
import type { AuthState, User } from '@/types/auth';

interface AuthActions {
    setUser: (user: User | null) => void;
    setAccessToken: (token: string | null) => void;
    setLoading: (isLoading: boolean) => void;
    login: (user: User, token: string) => void;
    logout: () => void;
    restoreSession: () => Promise<void>;
}

/**
 * Auth Store (Zustand)
 * - Access Token은 메모리에만 저장 (localStorage 저장 금지!)
 * - 새로고침 시 초기화되므로 AuthProvider에서 /api/auth/me 호출하여 복구 필요
 */
export const useAuthStore = create<AuthState & AuthActions>((set) => ({
    user: null,
    accessToken: null,
    isLoading: true, // 초기 상태는 로딩 중
    isAuthenticated: false,

    setUser: (user) => set({ user, isAuthenticated: !!user }),
    setAccessToken: (accessToken) => set({ accessToken }),
    setLoading: (isLoading) => set({ isLoading }),

    login: (user, accessToken) =>
        set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
        }),

    logout: () =>
        set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
        }),

    restoreSession: async () => {
        try {
            // /api/auth/me를 호출해서 쿠키 기반 세션 복원 시도
            const response = await fetch('/api/auth/me', {
                credentials: 'include',
            });

            if (response.ok) {
                const result = await response.json();
                if (result.success && result.data) {
                    set({
                        user: result.data.user,
                        accessToken: result.data.accessToken,
                        isAuthenticated: true,
                        isLoading: false,
                    });
                    return;
                }
            }

            // 세션 복원 실패
            set({
                user: null,
                accessToken: null,
                isAuthenticated: false,
                isLoading: false,
            });
        } catch {
            set({
                user: null,
                accessToken: null,
                isAuthenticated: false,
                isLoading: false,
            });
        }
    },
}));
