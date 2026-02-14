// src/components/lms/LmsHeader.tsx
// 세퍼마 LMS 학생용 헤더
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface LmsHeaderProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    tier: string;
  };
  onMenuClick: () => void;
}

export default function LmsHeader({ user, onMenuClick }: LmsHeaderProps) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const isAdmin = user.tier === 'ENTERPRISE' || user.role === 'admin';

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left: Menu button + Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/lms/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="hidden sm:block text-lg font-semibold text-white">
              마그네틱 세일즈 <span className="text-purple-400">LMS</span>
            </span>
          </Link>
        </div>

        {/* Right: User menu */}
        <div className="flex items-center gap-4">
          {/* Admin Switch */}
          {isAdmin && (
            <Link
              href="/lms-admin/dashboard"
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-amber-400 hover:text-amber-300 bg-amber-900/20 hover:bg-amber-900/30 border border-amber-500/30 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              <span className="hidden sm:inline">관리자 모드</span>
              <span className="sm:hidden">Admin</span>
            </Link>
          )}

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.fullName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white">{user.fullName || '사용자'}</p>
                <p className="text-xs text-slate-400">{user.tier}</p>
              </div>
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown */}
            {showUserMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-slate-800 rounded-xl shadow-xl border border-slate-700 py-2 z-20">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <p className="text-sm font-medium text-white">{user.fullName}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>

                  <Link
                    href="/lms/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    프로필
                  </Link>

                  {isAdmin && (
                    <Link
                      href="/lms-admin/dashboard"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-amber-400 hover:bg-amber-900/20 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                      관리자 모드로 전환
                    </Link>
                  )}

                  <Link
                    href="/dashboard"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    메인 대시보드
                  </Link>

                  <hr className="my-2 border-slate-700" />

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-700 hover:text-red-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
