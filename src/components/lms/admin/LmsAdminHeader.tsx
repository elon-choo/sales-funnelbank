// src/components/lms/admin/LmsAdminHeader.tsx
// 세퍼마 LMS 관리자용 헤더
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface LmsAdminHeaderProps {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    tier: string;
  };
  onMenuClick: () => void;
}

export default function LmsAdminHeader({ user, onMenuClick }: LmsAdminHeaderProps) {
  const router = useRouter();
  const { logout } = useAuthStore();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left: Menu button + Logo */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/lms-admin/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="hidden sm:block text-lg font-semibold text-white">
              LMS <span className="text-amber-400">Admin</span>
            </span>
          </Link>
        </div>

        {/* Center: Status indicators */}
        <div className="hidden md:flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-slate-400">시스템 정상</span>
          </div>
        </div>

        {/* Right: Quick actions + User menu */}
        <div className="flex items-center gap-4">
          {/* Student View Switch */}
          <Link
            href="/lms/dashboard"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-400 hover:text-purple-300 bg-purple-900/20 hover:bg-purple-900/30 border border-purple-500/30 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="hidden sm:inline">수강생 뷰</span>
            <span className="sm:hidden">LMS</span>
          </Link>

          {/* Notifications */}
          <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          {/* User Menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 p-2 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-amber-600 to-orange-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user.fullName?.charAt(0) || 'A'}
                </span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-medium text-white">{user.fullName}</p>
                <p className="text-xs text-amber-400">관리자</p>
              </div>
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
                    href="/lms/dashboard"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-3 px-4 py-2 text-sm text-purple-400 hover:bg-purple-900/20 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                    </svg>
                    수강생 뷰로 전환
                  </Link>

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
