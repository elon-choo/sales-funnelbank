
// src/app/(auth)/login/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';
import { LoginResponse } from '@/types/auth';

export default function LoginPage() {
    const router = useRouter();
    const loginStore = useAuthStore((state) => state.login);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });

            const result: { success: boolean; data?: LoginResponse['data']; error?: { message: string } } = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error?.message || '로그인에 실패했습니다.');
            }

            if (result.data) {
                loginStore(result.data.user, result.data.accessToken);
                router.push('/lms/dashboard');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="glass-card rounded-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col space-y-2 text-center">
                <div className="mx-auto w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-white/20">
                    <Icons.sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-white">
                    다시 오신 것을 환영합니다
                </h1>
                <p className="text-sm text-gray-400">
                    이메일로 로그인하여 계속하세요
                </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">이메일</Label>
                    <Input
                        id="email"
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        autoCapitalize="none"
                        autoComplete="email"
                        autoCorrect="off"
                        disabled={isLoading}
                        required
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-300">비밀번호</Label>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete="current-password"
                        disabled={isLoading}
                        required
                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
                    />
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-200 animate-in slide-in-from-top-2">
                        <Icons.alert className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                )}

                <Button
                    disabled={isLoading}
                    className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition-opacity font-medium"
                >
                    {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                    로그인
                </Button>
            </form>

            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-transparent px-2 text-gray-500">
                        계정이 없으신가요?
                    </span>
                </div>
            </div>

            <div className="text-center">
                <Link
                    href="/signup"
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors hover:underline underline-offset-4"
                >
                    회원가입하기
                </Link>
            </div>

            <div className="text-center text-xs text-gray-600 mt-8">
                Magnetic Sales Inc. v2.0
            </div>
        </div>
    );
}
