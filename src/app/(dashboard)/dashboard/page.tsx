// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    useEffect(() => {
        if (!user) return;
        // 일반 사용자는 LMS로 리다이렉트
        if (user.role !== 'admin') {
            router.replace('/lms/dashboard');
        }
    }, [user, router]);

    // 로딩 또는 일반 유저 리다이렉트 중
    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    // 관리자 전용 대시보드
    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">관리자 대시보드</h1>
                    <p className="text-gray-400">환영합니다, {user.fullName || user.email}</p>
                </div>
                <Link href="/lms/dashboard">
                    <Button className="bg-purple-600 hover:bg-purple-500 gap-2">
                        <Icons.bookOpen className="w-4 h-4" />
                        LMS 이동
                    </Button>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* AI Planner */}
                <Link href="/planner" className="glass-card p-6 rounded-xl border border-white/10 hover:border-pink-500/50 transition-colors group cursor-pointer bg-gradient-to-br from-purple-900/20 to-pink-900/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-pink-500/10 rounded-lg group-hover:bg-pink-500/20 transition-colors">
                            <Icons.wand className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">AI 기획 도우미</h3>
                            <p className="text-sm text-gray-400">마그네틱 세일즈 기획서 생성</p>
                        </div>
                    </div>
                </Link>

                {/* Builder */}
                <Link href="/builder" className="glass-card p-6 rounded-xl border border-white/10 hover:border-purple-500/50 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-500/10 rounded-lg group-hover:bg-purple-500/20 transition-colors">
                            <Icons.layout className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">랜딩페이지 빌더</h3>
                            <p className="text-sm text-gray-400">AI로 랜딩페이지 생성</p>
                        </div>
                    </div>
                </Link>

                {/* AI Chat */}
                <Link href="/chat" className="glass-card p-6 rounded-xl border border-white/10 hover:border-blue-500/50 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                            <Icons.message className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">AI 채팅</h3>
                            <p className="text-sm text-gray-400">세일즈 카피 생성하기</p>
                        </div>
                    </div>
                </Link>

                {/* Admin */}
                <Link href="/admin" className="glass-card p-6 rounded-xl border border-white/10 hover:border-yellow-500/50 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                            <Icons.settings className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">사용자 관리</h3>
                            <p className="text-sm text-gray-400">사용자 승인 관리</p>
                        </div>
                    </div>
                </Link>

                {/* LMS Admin */}
                <Link href="/lms/admin" className="glass-card p-6 rounded-xl border border-white/10 hover:border-emerald-500/50 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                            <Icons.check className="w-6 h-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">LMS 관리</h3>
                            <p className="text-sm text-gray-400">과제/피드백 관리</p>
                        </div>
                    </div>
                </Link>

                {/* Image Generation */}
                <Link href="/generate" className="glass-card p-6 rounded-xl border border-white/10 hover:border-cyan-500/50 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-cyan-500/10 rounded-lg group-hover:bg-cyan-500/20 transition-colors">
                            <Icons.image className="w-6 h-6 text-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">이미지 생성</h3>
                            <p className="text-sm text-gray-400">AI로 이미지 만들기</p>
                        </div>
                    </div>
                </Link>
            </div>

            {/* User Info */}
            <div className="glass-card p-6 rounded-xl border border-white/10">
                <h2 className="text-xl font-semibold text-white mb-4">내 정보</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <p className="text-sm text-gray-400">이메일</p>
                        <p className="text-white font-medium">{user.email}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">이름</p>
                        <p className="text-white font-medium">{user.fullName || '-'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">플랜</p>
                        <p className="text-purple-400 font-medium">{user.tier}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">역할</p>
                        <p className="text-yellow-400 font-medium">관리자</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
