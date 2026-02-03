// src/app/(lms)/lms/layout.tsx
// 세퍼마 LMS 학생용 레이아웃
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import LmsHeader from '@/components/lms/LmsHeader';
import LmsSidebar from '@/components/lms/LmsSidebar';

export default function LmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, restoreSession } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      await restoreSession();
      setIsLoading(false);
    };
    checkAuth();
  }, [restoreSession]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login?redirect=/lms/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
          <p className="text-slate-400 text-sm">LMS 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/10 to-slate-900">
      {/* Header */}
      <LmsHeader
        user={userInfo}
        onMenuClick={() => setSidebarOpen(!sidebarOpen)}
      />

      <div className="flex pt-16">
        {/* Sidebar */}
        <LmsSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
