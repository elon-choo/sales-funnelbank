// src/app/(dashboard)/admin/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

interface User {
    id: string;
    email: string;
    full_name: string;
    tier: string;
    role: string;
    course_type: string;
    is_approved: boolean;
    created_at: string;
}

interface Course {
    id: string;
    title: string;
    status: string;
}

interface Enrollment {
    user_id: string;
    course_id: string;
    status: string;
}

export default function AdminPage() {
    const router = useRouter();
    const { user, accessToken, isLoading: authLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
    const [updating, setUpdating] = useState<string | null>(null);

    const fetchUsers = useCallback(async () => {
        if (!accessToken) return;

        try {
            const response = await fetch(`/api/admin/users?status=${filter}`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            const result = await response.json();
            if (result.success) {
                setUsers(result.data.users || []);
                setCourses(result.data.courses || []);
                setEnrollments(result.data.enrollments || []);
            }
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setLoading(false);
        }
    }, [accessToken, filter]);

    useEffect(() => {
        if (authLoading) return;
        if (user && user.role !== 'admin') {
            router.push('/dashboard');
            return;
        }
        if (accessToken) {
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [user, router, fetchUsers, authLoading, accessToken]);

    async function approveUser(userId: string) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/approve`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) fetchUsers();
        } catch (error) {
            console.error('Failed to approve user:', error);
        }
    }

    async function rejectUser(userId: string) {
        try {
            const response = await fetch(`/api/admin/users/${userId}/approve`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
            });
            if (response.ok) fetchUsers();
        } catch (error) {
            console.error('Failed to reject user:', error);
        }
    }

    async function updateUserCourse(userId: string, courseType: string) {
        setUpdating(userId);
        try {
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ userId, courseType }),
            });
            const result = await response.json();
            if (result.success) fetchUsers();
        } catch (error) {
            console.error('Failed to update course type:', error);
        } finally {
            setUpdating(null);
        }
    }

    async function updateUserCohort(userId: string, courseId: string) {
        setUpdating(userId);
        try {
            const response = await fetch('/api/admin/users', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify({ userId, courseId }),
            });
            const result = await response.json();
            if (result.success) fetchUsers();
        } catch (error) {
            console.error('Failed to update cohort:', error);
        } finally {
            setUpdating(null);
        }
    }

    function getUserEnrollment(userId: string) {
        return enrollments.find(e => e.user_id === userId);
    }

    if (authLoading || loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Icons.spinner className="w-8 h-8 animate-spin text-purple-400" />
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <Icons.alert className="w-12 h-12 text-red-400 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-white mb-2">접근 권한 없음</h2>
                    <p className="text-gray-400">관리자만 접근할 수 있습니다.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">사용자 관리</h1>
                    <p className="text-gray-400 text-sm mt-1">
                        회원가입 승인, 과정/기수 배정
                    </p>
                </div>
                <div className="text-sm text-gray-500">
                    총 {users.length}명 | 코스 {courses.length}개
                </div>
            </div>

            {/* 필터 탭 */}
            <div className="flex gap-2">
                {(['all', 'pending', 'approved'] as const).map(f => (
                    <Button
                        key={f}
                        variant={filter === f ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(f)}
                    >
                        {f === 'all' ? '전체' : f === 'pending' ? '승인 대기' : '승인됨'}
                    </Button>
                ))}
            </div>

            {/* 사용자 목록 */}
            {users.length === 0 ? (
                <div className="glass-card rounded-xl p-8 text-center">
                    <Icons.users className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">사용자가 없습니다.</p>
                </div>
            ) : (
                <div className="glass-card rounded-xl overflow-x-auto">
                    <table className="w-full min-w-[900px]">
                        <thead className="bg-white/5 border-b border-white/10">
                            <tr>
                                <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">이메일</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">이름</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">과정</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">기수</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">상태</th>
                                <th className="px-4 py-4 text-left text-xs font-medium text-gray-400">가입일</th>
                                <th className="px-4 py-4 text-right text-xs font-medium text-gray-400">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {users.map((u) => {
                                const enrollment = getUserEnrollment(u.id);
                                const enrolledCourse = enrollment ? courses.find(c => c.id === enrollment.course_id) : null;
                                const isUpdating = updating === u.id;

                                return (
                                    <tr key={u.id} className="hover:bg-white/5">
                                        <td className="px-4 py-4 text-sm text-white max-w-[200px] truncate">{u.email}</td>
                                        <td className="px-4 py-4 text-sm text-gray-300">{u.full_name || '-'}</td>

                                        {/* 과정 선택 드롭다운 */}
                                        <td className="px-4 py-4">
                                            {u.role === 'admin' ? (
                                                <span className="px-2 py-1 text-xs rounded bg-red-500/20 text-red-300">관리자</span>
                                            ) : (
                                                <select
                                                    value={u.course_type || 'SALES_FUNNEL'}
                                                    onChange={e => updateUserCourse(u.id, e.target.value)}
                                                    disabled={isUpdating}
                                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50 cursor-pointer"
                                                >
                                                    <option value="SALES_FUNNEL">세퍼마</option>
                                                    <option value="MAGNETIC_SALES">마세</option>
                                                </select>
                                            )}
                                        </td>

                                        {/* 기수 선택 드롭다운 */}
                                        <td className="px-4 py-4">
                                            {u.role === 'admin' ? (
                                                <span className="text-xs text-gray-500">-</span>
                                            ) : (
                                                <select
                                                    value={enrollment?.course_id || ''}
                                                    onChange={e => {
                                                        if (e.target.value) updateUserCohort(u.id, e.target.value);
                                                    }}
                                                    disabled={isUpdating}
                                                    className="bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-white disabled:opacity-50 cursor-pointer"
                                                >
                                                    <option value="">미배정</option>
                                                    {courses.map(c => (
                                                        <option key={c.id} value={c.id}>{c.title}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </td>

                                        <td className="px-4 py-4">
                                            <span className={`px-2 py-1 text-xs rounded ${
                                                u.is_approved
                                                    ? 'bg-green-500/20 text-green-300'
                                                    : 'bg-yellow-500/20 text-yellow-300'
                                            }`}>
                                                {u.is_approved ? '승인됨' : '대기중'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-xs text-gray-400">
                                            {new Date(u.created_at).toLocaleDateString('ko-KR')}
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {u.role !== 'admin' && (
                                                u.is_approved ? (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => rejectUser(u.id)}
                                                        className="text-red-400 border-red-400/30 hover:bg-red-500/10 text-xs"
                                                    >
                                                        승인 취소
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="default"
                                                        size="sm"
                                                        onClick={() => approveUser(u.id)}
                                                        className="bg-green-600 hover:bg-green-700 text-xs"
                                                    >
                                                        승인
                                                    </Button>
                                                )
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
