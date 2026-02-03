// src/app/(lms)/lms-admin/enrollments/page.tsx
// 수강생 관리 페이지
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface Enrollment {
  id: string;
  user_id: string;
  course_id: string;
  status: 'active' | 'completed' | 'dropped' | 'suspended';
  enrolled_at: string;
  completed_at: string | null;
  profiles: {
    id: string;
    email: string;
    full_name: string | null;
  };
  courses: {
    id: string;
    title: string;
    status: string;
  };
}

interface Course {
  id: string;
  title: string;
  status: string;
}

const statusLabels: Record<string, { text: string; color: string }> = {
  active: { text: '수강 중', color: 'bg-green-600/20 text-green-400' },
  completed: { text: '수료', color: 'bg-blue-600/20 text-blue-400' },
  dropped: { text: '중도 포기', color: 'bg-red-600/20 text-red-400' },
  suspended: { text: '일시 정지', color: 'bg-yellow-600/20 text-yellow-400' },
};

export default function EnrollmentsAdminPage() {
  const { accessToken } = useAuthStore();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newEnrollment, setNewEnrollment] = useState({
    userEmail: '',
    courseId: '',
  });

  const fetchData = async () => {
    if (!accessToken) return;

    try {
      // Fetch enrollments
      const params = new URLSearchParams();
      if (selectedCourse !== 'all') params.append('courseId', selectedCourse);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const [enrollmentsRes, coursesRes] = await Promise.all([
        fetch(`/api/lms/enrollments?${params.toString()}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
        fetch('/api/lms/courses', {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        }),
      ]);

      if (!enrollmentsRes.ok) throw new Error('수강생 목록을 불러오는데 실패했습니다');
      if (!coursesRes.ok) throw new Error('기수 목록을 불러오는데 실패했습니다');

      const enrollmentsData = await enrollmentsRes.json();
      const coursesData = await coursesRes.json();

      if (enrollmentsData.success) setEnrollments(enrollmentsData.data.enrollments || []);
      if (coursesData.success) setCourses(coursesData.data.courses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [accessToken, selectedCourse, selectedStatus]);

  const handleAddEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || adding) return;

    setAdding(true);
    try {
      const response = await fetch('/api/lms/enrollments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userEmail: newEnrollment.userEmail,
          courseId: newEnrollment.courseId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || '등록에 실패했습니다');
      }

      await fetchData();
      setShowAddModal(false);
      setNewEnrollment({ userEmail: '', courseId: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setAdding(false);
    }
  };

  const handleStatusChange = async (enrollmentId: string, newStatus: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch('/api/lms/enrollments', {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enrollmentIds: [enrollmentId],
          status: newStatus,
        }),
      });

      if (!response.ok) throw new Error('상태 변경 실패');

      setEnrollments(enrollments.map(e =>
        e.id === enrollmentId ? { ...e, status: newStatus as Enrollment['status'] } : e
      ));
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">수강생 관리</h1>
          <p className="text-slate-400 mt-1">수강생 등록 현황을 관리합니다</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          수강생 추가
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">전체 기수</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>{course.title}</option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">전체 상태</option>
          <option value="active">수강 중</option>
          <option value="completed">수료</option>
          <option value="dropped">중도 포기</option>
          <option value="suspended">일시 정지</option>
        </select>
        <span className="text-slate-400 text-sm">
          총 {enrollments.length}명
        </span>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Enrollment List */}
      {enrollments.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">수강생이 없습니다</h3>
          <p className="text-slate-400">수강생을 추가해주세요.</p>
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">수강생</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">기수</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">등록일</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">상태</th>
                <th className="px-6 py-4 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {enrollments.map((enrollment) => (
                <tr key={enrollment.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                        <span className="text-white font-medium">
                          {(enrollment.profiles?.full_name || enrollment.profiles?.email || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-white font-medium">
                          {enrollment.profiles?.full_name || '이름 없음'}
                        </p>
                        <p className="text-sm text-slate-400">{enrollment.profiles?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-white">{enrollment.courses?.title}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-slate-300">
                      {new Date(enrollment.enrolled_at).toLocaleDateString('ko-KR')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusLabels[enrollment.status]?.color}`}>
                      {statusLabels[enrollment.status]?.text}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <select
                      value={enrollment.status}
                      onChange={(e) => handleStatusChange(enrollment.id, e.target.value)}
                      className="px-3 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      <option value="active">수강 중</option>
                      <option value="completed">수료</option>
                      <option value="dropped">중도 포기</option>
                      <option value="suspended">일시 정지</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">수강생 추가</h2>
            <form onSubmit={handleAddEnrollment} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">사용자 이메일 *</label>
                <input
                  type="email"
                  value={newEnrollment.userEmail}
                  onChange={(e) => setNewEnrollment({ ...newEnrollment, userEmail: e.target.value })}
                  placeholder="user@example.com"
                  required
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-slate-500 mt-1">가입된 사용자의 이메일을 입력하세요</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">기수 *</label>
                <select
                  value={newEnrollment.courseId}
                  onChange={(e) => setNewEnrollment({ ...newEnrollment, courseId: e.target.value })}
                  required
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">기수 선택</option>
                  {courses.filter(c => c.status === 'active' || c.status === 'draft').map((course) => (
                    <option key={course.id} value={course.id}>{course.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={adding || !newEnrollment.userEmail || !newEnrollment.courseId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg transition-colors"
                >
                  {adding ? '추가 중...' : '추가하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
