// src/app/(dashboard)/dashboard/page.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
    const router = useRouter();
    const { user } = useAuthStore();

    useEffect(() => {
        // 로그인 후 LMS 대시보드로 자동 리다이렉트
        if (user) {
            router.replace('/lms/dashboard');
        }
    }, [user, router]);

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
    );
}
