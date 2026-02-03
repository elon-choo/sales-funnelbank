// src/app/(lms)/lms-admin/layout.tsx
// 세퍼마 LMS 관리자용 레이아웃
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import LmsAdminHeader from '@/components/lms/admin/LmsAdminHeader';
import LmsAdminSidebar from '@/components/lms/admin/LmsAdminSidebar';

export default function LmsAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, restoreSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      await restoreSession();
      setIsLoading(false);
    };
    checkAuth();
  }, [restoreSession]);

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.push('/login?redirect=/lms-admin/dashboard');
        return;
      }

      // 관리자 권한 확인 (ENTERPRISE tier 또는 admin role)
      const isAdmin = user?.tier === 'ENTERPRISE' || user?.role === 'admin';
      if (!isAdmin) {
        router.push('/lms/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500"></div>
          <p className="text-slate-400 text-sm">관리자 페이지 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  // 관리자 권한 재확인
  const isAdmin = user.tier === 'ENTERPRISE' || user.role === 'admin';
  if (!isAdmin) {
    return null;
  }

  const userInfo = {
    id: user.id,
    email: user.email || '',
    fullName: user.fullName || '',
    role: user.role || 'user',
    tier: user.tier || 'FREE',
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <LmsAdminHeader
        user={userInfo}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex pt-16">
        {/* Sidebar */}
        <LmsAdminSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <main className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-64' : ''} p-6`}>
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
