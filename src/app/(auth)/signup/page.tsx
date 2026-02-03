
// src/app/(auth)/signup/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';

export default function SignupPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError(null);

        const formData = new FormData(event.currentTarget);
        const email = formData.get('email') as string;
        const password = formData.get('password') as string;
        const fullName = formData.get('fullName') as string;
        const passwordConfirm = formData.get('passwordConfirm') as string;

        if (password !== passwordConfirm) {
            setError("비밀번호가 일치하지 않습니다.");
            setIsLoading(false);
            return;
        }

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email,
                    password,
                    fullName,
                    agreeTerms: true,
                    agreePrivacy: true,
                    agreeMarketing: false // 선택사항
                }),
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.error?.message || '회원가입에 실패했습니다.');
            }

            setSuccess(true);
            // 3초 후 로그인 페이지로 이동
            setTimeout(() => {
                router.push('/login');
            }, 3000);

        } catch (err) {
            setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
        } finally {
            setIsLoading(false);
        }
    }

    if (success) {
        return (
            <div className="glass-card rounded-2xl p-8 space-y-6 text-center animate-in zoom-in duration-300">
                <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4 ring-1 ring-green-500/20">
                    <Icons.check className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-2xl font-bold text-white">회원가입 완료!</h2>
                <p className="text-gray-400 leading-relaxed">
                    계정이 성공적으로 생성되었습니다.<br />
                    관리자 승인 후 서비스를 이용하실 수 있습니다.
                </p>
                <div className="pt-4">
                    <Button
                        variant="outline"
                        className="w-full border-white/10 hover:bg-white/5 text-white"
                        onClick={() => router.push('/login')}
                    >
                        로그인 페이지로 이동
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="glass-card rounded-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col space-y-2 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                    계정 만들기
                </h1>
                <p className="text-sm text-gray-400">
                    마그네틱 세일즈와 함께 시작하세요
                </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-gray-300">이름</Label>
                    <Input
                        id="fullName"
                        name="fullName"
                        placeholder="홍길동"
                        type="text"
                        autoCapitalize="words"
                        disabled={isLoading}
                        required
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email" className="text-gray-300">이메일</Label>
                    <Input
                        id="email"
                        name="email"
                        placeholder="name@example.com"
                        type="email"
                        disabled={isLoading}
                        required
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="password" className="text-gray-300">비밀번호</Label>
                    <Input
                        id="password"
                        name="password"
                        type="password"
                        disabled={isLoading}
                        required
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="passwordConfirm" className="text-gray-300">비밀번호 확인</Label>
                    <Input
                        id="passwordConfirm"
                        name="passwordConfirm"
                        type="password"
                        disabled={isLoading}
                        required
                        className="bg-white/5 border-white/10 text-white"
                    />
                </div>

                {error && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-200">
                        <Icons.alert className="w-4 h-4" />
                        <span>{error}</span>
                    </div>
                )}

                <div className="pt-2">
                    <Button
                        disabled={isLoading}
                        className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 font-medium"
                    >
                        {isLoading && <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />}
                        회원가입
                    </Button>
                </div>
            </form>

            <div className="text-center">
                <span className="text-sm text-gray-500">이미 계정이 있으신가요? </span>
                <Link
                    href="/login"
                    className="text-sm text-purple-400 hover:text-purple-300 transition-colors hover:underline"
                >
                    로그인
                </Link>
            </div>
        </div>
    );
}
