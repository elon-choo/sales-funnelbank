// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useAuthStore } from '@/stores/authStore';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function DashboardPage() {
    const { user } = useAuthStore();

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">대시보드</h1>
                    <p className="text-gray-400">환영합니다, {user.fullName || user.email}</p>
                </div>
                <Link href="/chat">
                    <Button className="bg-purple-600 hover:bg-purple-500 gap-2">
                        <Icons.message className="w-4 h-4" />
                        AI 채팅 시작
                    </Button>
                </Link>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Main Feature: Planner */}
                <Link href="/planner" className="glass-card p-6 rounded-xl border border-white/10 hover:border-pink-500/50 transition-colors group cursor-pointer md:col-span-2 lg:col-span-1 bg-gradient-to-br from-purple-900/20 to-pink-900/20">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-pink-500/10 rounded-lg group-hover:bg-pink-500/20 transition-colors">
                            <Icons.wand className="w-6 h-6 text-pink-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">AI 기획 도우미</h3>
                            <p className="text-sm text-gray-400">마그네틱 세일즈 기획서 생성</p>
                        </div>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">6단계 마그네틱 세일즈 플로우로 완벽한 기획서를 만들어보세요</p>
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

                {/* DB Collect */}
                <Link href="/db-collect" className="glass-card p-6 rounded-xl border border-white/10 hover:border-green-500/50 transition-colors group cursor-pointer">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                            <Icons.database className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-white">DB 수집</h3>
                            <p className="text-sm text-gray-400">Google Form으로 리드 수집</p>
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

                {user.role === 'admin' && (
                    <Link href="/admin" className="glass-card p-6 rounded-xl border border-white/10 hover:border-yellow-500/50 transition-colors group cursor-pointer">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20 transition-colors">
                                <Icons.settings className="w-6 h-6 text-yellow-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">관리자</h3>
                                <p className="text-sm text-gray-400">사용자 승인 관리</p>
                            </div>
                        </div>
                    </Link>
                )}
            </div>

            {/* 세퍼마 과제/피드백 섹션 */}
            {(user.courseType === 'SALES_FUNNEL' || !user.courseType) && (
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-white">세일즈 퍼널 과제</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Link href="/lms/assignments/new" className="glass-card p-6 rounded-xl border border-white/10 hover:border-orange-500/50 transition-colors group cursor-pointer bg-gradient-to-br from-orange-900/10 to-red-900/10">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-orange-500/10 rounded-lg group-hover:bg-orange-500/20 transition-colors">
                                    <Icons.edit className="w-6 h-6 text-orange-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">과제 제출</h3>
                                    <p className="text-sm text-gray-400">비즈니스 기획서 작성 & AI 피드백</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/lms/assignments" className="glass-card p-6 rounded-xl border border-white/10 hover:border-amber-500/50 transition-colors group cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-amber-500/10 rounded-lg group-hover:bg-amber-500/20 transition-colors">
                                    <Icons.list className="w-6 h-6 text-amber-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">내 과제</h3>
                                    <p className="text-sm text-gray-400">제출한 과제 확인</p>
                                </div>
                            </div>
                        </Link>
                        <Link href="/lms/feedbacks" className="glass-card p-6 rounded-xl border border-white/10 hover:border-emerald-500/50 transition-colors group cursor-pointer">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                                    <Icons.check className="w-6 h-6 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">AI 피드백</h3>
                                    <p className="text-sm text-gray-400">AI 분석 리포트 확인</p>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            )}

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
                        <p className="text-white font-medium">{user.role === 'admin' ? '관리자' : '사용자'}</p>
                    </div>
                </div>
            </div>

            {/* Features Coming Soon */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white">주요 기능</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass-card p-6 rounded-xl border border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-green-500/10 rounded-lg">
                                <Icons.check className="w-6 h-6 text-green-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2">세일즈 카피 AI</h3>
                                <p className="text-sm text-gray-400">
                                    고전환 세일즈 카피를 AI가 자동으로 생성합니다.
                                    헤드라인, CTA, 혜택 등을 최적화된 형태로 제공합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="glass-card p-6 rounded-xl border border-white/10">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-blue-500/10 rounded-lg">
                                <Icons.image className="w-6 h-6 text-blue-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-2">이미지 생성</h3>
                                <p className="text-sm text-gray-400">
                                    랜딩페이지에 사용할 이미지를 AI로 생성합니다.
                                    배너, 아이콘, 배경 이미지 등을 만들 수 있습니다.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
