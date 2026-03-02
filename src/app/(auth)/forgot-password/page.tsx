// src/app/(auth)/forgot-password/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Icons } from '@/components/icons';

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || '요청에 실패했습니다.');
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  // 성공 화면
  if (sent) {
    return (
      <div className="glass-card rounded-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col space-y-2 text-center">
          <div className="mx-auto w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-green-500/20">
            <Icons.mail className="w-6 h-6 text-green-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            이메일을 확인해주세요
          </h1>
          <p className="text-sm text-gray-400 leading-relaxed">
            등록된 이메일이라면 비밀번호 재설정 링크가<br />
            발송되었습니다. 메일함을 확인해주세요.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-400 space-y-2">
          <p>- 이메일이 도착하지 않으면 스팸함을 확인해주세요.</p>
          <p>- 링크는 <strong className="text-gray-300">1시간</strong> 후 만료됩니다.</p>
        </div>

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

  // 이메일 입력 폼
  return (
    <div className="glass-card rounded-2xl p-8 space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="flex flex-col space-y-2 text-center">
        <div className="mx-auto w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4 ring-1 ring-white/20">
          <Icons.mail className="w-6 h-6 text-purple-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          비밀번호 찾기
        </h1>
        <p className="text-sm text-gray-400">
          가입한 이메일을 입력하면 재설정 링크를 보내드립니다
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
          재설정 링크 보내기
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
