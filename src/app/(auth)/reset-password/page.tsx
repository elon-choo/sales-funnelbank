// src/app/(auth)/reset-password/page.tsx
'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 토큰 없음
  if (!token) {
    return (
      <div className="glass-card rounded-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-red-500/20">
            <Icons.alert className="w-6 h-6 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            유효하지 않은 링크
          </h1>
          <p className="text-sm text-gray-400">
            비밀번호 재설정 링크가 올바르지 않습니다.
          </p>
        </div>
        <div className="text-center space-y-3">
          <Link
            href="/forgot-password"
            className="block text-sm text-purple-400 hover:text-purple-300 transition-colors hover:underline underline-offset-4"
          >
            비밀번호 재설정 다시 요청하기
          </Link>
          <Link
            href="/login"
            className="block text-sm text-gray-500 hover:text-gray-400 transition-colors hover:underline underline-offset-4"
          >
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  // 성공 화면
  if (success) {
    return (
      <div className="glass-card rounded-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-green-500/20">
            <Icons.check className="w-6 h-6 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            비밀번호 변경 완료
          </h1>
          <p className="text-sm text-gray-400">
            비밀번호가 성공적으로 변경되었습니다.<br />
            새 비밀번호로 로그인해주세요.
          </p>
        </div>
        <Button
          onClick={() => router.push('/login')}
          className="w-full h-11 bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-90 transition-opacity font-medium"
        >
          로그인하기
        </Button>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (newPassword !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      setIsLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message || '비밀번호 변경에 실패했습니다.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // 비밀번호 입력 폼
  return (
    <div className="glass-card rounded-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col space-y-2 text-center">
        <div className="mx-auto w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-white/20">
          <Icons.sparkles className="w-6 h-6 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          새 비밀번호 설정
        </h1>
        <p className="text-sm text-gray-400">
          새로운 비밀번호를 입력해주세요
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="newPassword" className="text-gray-300">새 비밀번호</Label>
          <Input
            id="newPassword"
            name="newPassword"
            type="password"
            autoComplete="new-password"
            placeholder="6자 이상 입력"
            disabled={isLoading}
            required
            minLength={6}
            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-purple-500/50 focus:ring-purple-500/20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword" className="text-gray-300">비밀번호 확인</Label>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="비밀번호 다시 입력"
            disabled={isLoading}
            required
            minLength={6}
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
          비밀번호 변경
        </Button>
      </form>

      <div className="text-center">
        <Link
          href="/login"
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors hover:underline underline-offset-4"
        >
          로그인으로 돌아가기
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="glass-card rounded-2xl p-8 flex items-center justify-center">
        <Icons.spinner className="h-6 w-6 animate-spin text-purple-400" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
