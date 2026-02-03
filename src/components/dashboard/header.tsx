// src/components/dashboard/header.tsx
'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/authStore';

interface DashboardHeaderProps {
    user: {
        email: string;
        fullName: string;
        role: string;
        tier: string;
    };
}

export default function DashboardHeader({ user }: DashboardHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { logout } = useAuthStore();

    async function handleLogout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        logout();
        router.push('/login');
    }

    const isAdmin = user.role === 'admin';

    const navItems = [
        { href: '/dashboard', label: '대시보드', icon: Icons.home },
        { href: '/chat', label: 'AI 채팅', icon: Icons.message },
    ];

    if (isAdmin) {
        navItems.push({ href: '/admin', label: '관리자', icon: Icons.settings });
    }

    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <Icons.zap className="w-6 h-6 text-purple-400" />
                        <span className="font-bold text-white">Magnetic Sales</span>
                    </Link>

                    {/* Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <Link key={item.href} href={item.href}>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className={`gap-2 ${
                                            isActive
                                                ? 'text-white bg-white/10'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {item.label}
                                    </Button>
                                </Link>
                            );
                        })}
                    </nav>

                    {/* User Info & Actions */}
                    <div className="flex items-center gap-4">
                        <div className="hidden sm:block text-right">
                            <p className="text-sm text-white font-medium">{user.fullName || user.email}</p>
                            <p className="text-xs text-gray-400">
                                {user.tier} {isAdmin && '• 관리자'}
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="text-gray-400 hover:text-white hover:bg-white/5"
                        >
                            <Icons.logout className="w-4 h-4" />
                            <span className="hidden sm:inline ml-2">로그아웃</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Mobile Navigation */}
            <div className="md:hidden border-t border-white/5">
                <div className="flex justify-around py-2">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                        return (
                            <Link key={item.href} href={item.href}>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`flex-col gap-1 h-auto py-2 ${
                                        isActive
                                            ? 'text-purple-400'
                                            : 'text-gray-400'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="text-xs">{item.label}</span>
                                </Button>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </header>
    );
}
