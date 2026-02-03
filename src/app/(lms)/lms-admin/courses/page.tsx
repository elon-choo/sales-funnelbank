// src/app/(lms)/lms-admin/courses/page.tsx
// 기수 관리 페이지
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface Course {
  id: string;
  title: string;
  description: string | null;
  status: 'draft' | 'active' | 'archived';
  total_weeks: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

const statusLabels: Record<string, { text: string; color: string }> = {
  draft: { text: '준비 중', color: 'bg-slate-600/20 text-slate-400 border-slate-500/30' },
  active: { text: '진행 중', color: 'bg-green-600/20 text-green-400 border-green-500/30' },
  archived: { text: '종료', color: 'bg-purple-600/20 text-purple-400 border-purple-500/30' },
};

export default function CoursesAdminPage() {
  const { accessToken } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCourse, setNewCourse] = useState({
    title: '',
    description: '',
    totalWeeks: 10,
    startDate: '',
    endDate: '',
  });

  const fetchCourses = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch('/api/lms/courses', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      if (!response.ok) throw new Error('기수 목록을 불러오는데 실패했습니다');

      const result = await response.json();
      if (result.success) {
        setCourses(result.data.courses || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [accessToken]);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || creating) return;

    setCreating(true);
    try {
      const response = await fetch('/api/lms/courses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newCourse.title,
          description: newCourse.description || null,
          totalWeeks: newCourse.totalWeeks,
          startDate: newCourse.startDate || null,
          endDate: newCourse.endDate || null,
          status: 'draft',
        }),
      });

      if (!response.ok) throw new Error('기수 생성에 실패했습니다');

      const result = await response.json();
      if (result.success) {
        setCourses([result.data.course, ...courses]);
        setShowCreateModal(false);
        setNewCourse({ title: '', description: '', totalWeeks: 10, startDate: '', endDate: '' });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (courseId: string, newStatus: string) => {
    if (!accessToken) return;

    try {
      const response = await fetch(`/api/lms/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) throw new Error('상태 변경 실패');

      const result = await response.json();
      if (result.success) {
        setCourses(courses.map(c => c.id === courseId ? { ...c, status: newStatus as Course['status'] } : c));
      }
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
          <h1 className="text-2xl font-bold text-white">기수 관리</h1>
          <p className="text-slate-400 mt-1">마스터클래스 기수를 생성하고 관리합니다</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새 기수 만들기
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400">
          {error}
        </div>
      )}

      {/* Course List */}
      {courses.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
          <svg className="w-16 h-16 text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <h3 className="text-lg font-semibold text-white mb-2">기수가 없습니다</h3>
          <p className="text-slate-400 mb-4">첫 번째 마스터클래스 기수를 만들어보세요!</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors"
          >
            새 기수 만들기
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="font-semibold text-white text-lg">{course.title}</h3>
                <span className={`px-2 py-1 rounded text-xs font-medium border ${statusLabels[course.status]?.color}`}>
                  {statusLabels[course.status]?.text}
                </span>
              </div>

              {course.description && (
                <p className="text-slate-400 text-sm mb-4 line-clamp-2">{course.description}</p>
              )}

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">총 주차</span>
                  <span className="text-white">{course.total_weeks}주</span>
                </div>
                {course.start_date && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">시작일</span>
                    <span className="text-white">{new Date(course.start_date).toLocaleDateString('ko-KR')}</span>
                  </div>
                )}
                {course.end_date && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">종료일</span>
                    <span className="text-white">{new Date(course.end_date).toLocaleDateString('ko-KR')}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                <select
                  value={course.status}
                  onChange={(e) => handleStatusChange(course.id, e.target.value)}
                  className="px-3 py-1 bg-slate-900 border border-slate-700 rounded text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                >
                  <option value="draft">준비 중</option>
                  <option value="active">진행 중</option>
                  <option value="archived">종료</option>
                </select>
                <button className="text-amber-400 hover:text-amber-300 text-sm">
                  상세 →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-2xl p-6 w-full max-w-md border border-slate-700">
            <h2 className="text-xl font-bold text-white mb-4">새 기수 만들기</h2>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">기수명 *</label>
                <input
                  type="text"
                  value={newCourse.title}
                  onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                  placeholder="예: 마그네틱 세일즈 9기"
                  required
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">설명</label>
                <textarea
                  value={newCourse.description}
                  onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                  placeholder="기수에 대한 간단한 설명"
                  rows={3}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">총 주차 수</label>
                <input
                  type="number"
                  value={newCourse.totalWeeks}
                  onChange={(e) => setNewCourse({ ...newCourse, totalWeeks: parseInt(e.target.value) || 10 })}
                  min={1}
                  max={52}
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">시작일</label>
                  <input
                    type="date"
                    value={newCourse.startDate}
                    onChange={(e) => setNewCourse({ ...newCourse, startDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">종료일</label>
                  <input
                    type="date"
                    value={newCourse.endDate}
                    onChange={(e) => setNewCourse({ ...newCourse, endDate: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating || !newCourse.title}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-600/50 text-white rounded-lg transition-colors"
                >
                  {creating ? '생성 중...' : '생성하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
