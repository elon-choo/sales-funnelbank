// src/app/(lms)/lms/courses/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface CourseWeek {
  id: string;
  week_number: number;
  title: string;
  is_active: boolean;
}

interface Course {
  id: string;
  title: string;
  status: string;
  total_weeks: number;
}

interface Enrollment {
  id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  courses: Course;
}

interface AssignmentSummary {
  week_id: string;
  status: string;
  version: number;
}

export default function CoursesPage() {
  const { user, accessToken } = useAuthStore();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [weeks, setWeeks] = useState<CourseWeek[]>([]);
  const [assignments, setAssignments] = useState<AssignmentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    fetchData();
  }, [accessToken]);

  async function fetchData() {
    try {
      setLoading(true);
      const headers = { Authorization: `Bearer ${accessToken}` };

      // Fetch dashboard data (has enrollments)
      const dashRes = await fetch('/api/lms/dashboard', { headers });
      const dashData = await dashRes.json();

      if (!dashData.success) {
        setError('강의 정보를 불러올 수 없습니다.');
        return;
      }

      const enrollmentList = dashData.data?.enrollments || [];
      setEnrollments(enrollmentList);

      if (enrollmentList.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch weeks for first course
      const courseId = enrollmentList[0]?.course_id;
      const [weeksRes, assignmentsRes] = await Promise.all([
        fetch(`/api/lms/weeks?courseId=${courseId}`, { headers }),
        fetch(`/api/lms/assignments?courseId=${courseId}`, { headers }),
      ]);

      const weeksData = await weeksRes.json();
      const assignmentsData = await assignmentsRes.json();

      if (weeksData.success) {
        setWeeks(weeksData.data?.weeks || []);
      }
      if (assignmentsData.success) {
        setAssignments(assignmentsData.data?.assignments || []);
      }
    } catch {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (enrollments.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-white">내 강의</h1>
        <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-purple-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">등록된 강의가 없습니다</h2>
          <p className="text-slate-400 text-sm">관리자에게 문의하여 강의를 등록해주세요.</p>
        </div>
      </div>
    );
  }

  const course = enrollments[0]?.courses;
  const enrollment = enrollments[0];

  // Count assignments per week
  const weekAssignmentMap: Record<string, { submitted: number; reviewed: number; draft: number }> = {};
  assignments.forEach((a) => {
    if (!weekAssignmentMap[a.week_id]) {
      weekAssignmentMap[a.week_id] = { submitted: 0, reviewed: 0, draft: 0 };
    }
    if (a.status === 'submitted') weekAssignmentMap[a.week_id].submitted++;
    else if (a.status === 'reviewed') weekAssignmentMap[a.week_id].reviewed++;
    else if (a.status === 'draft') weekAssignmentMap[a.week_id].draft++;
  });

  const completedWeeks = weeks.filter(w => {
    const stats = weekAssignmentMap[w.id];
    return stats && (stats.submitted > 0 || stats.reviewed > 0);
  }).length;

  const progressPercent = weeks.length > 0 ? Math.round((completedWeeks / weeks.length) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">내 강의</h1>

      {/* Course Card */}
      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
        {/* Course Header */}
        <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">{course?.title || '강의'}</h2>
              <p className="text-slate-400 text-sm mt-1">
                등록일: {new Date(enrollment.enrolled_at).toLocaleDateString('ko-KR')}
              </p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
              enrollment.status === 'active'
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
            }`}>
              {enrollment.status === 'active' ? '수강중' : enrollment.status}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-slate-400">진행률</span>
              <span className="text-white font-medium">{progressPercent}% ({completedWeeks}/{weeks.length}주차)</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2.5">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2.5 rounded-full transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Course Stats */}
        <div className="grid grid-cols-3 divide-x divide-slate-700 border-t border-slate-700">
          <StatItem label="총 주차" value={`${course?.total_weeks || weeks.length}주`} />
          <StatItem label="제출 과제" value={`${assignments.filter(a => a.status !== 'draft').length}건`} />
          <StatItem label="과정 상태" value={course?.status === 'active' ? '진행중' : '완료'} />
        </div>
      </div>

      {/* Weekly Progress */}
      {weeks.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-white">주차별 진행 현황</h3>
          {weeks.map((week) => {
            const stats = weekAssignmentMap[week.id];
            const hasSubmission = stats && (stats.submitted > 0 || stats.reviewed > 0);
            const hasDraft = stats && stats.draft > 0;
            const hasReview = stats && stats.reviewed > 0;

            return (
              <div
                key={week.id}
                className="bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    hasReview
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : hasSubmission
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : hasDraft
                          ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                          : 'bg-slate-700/50 text-slate-500 border border-slate-600'
                  }`}>
                    {week.week_number}
                  </div>
                  <div>
                    <p className="text-white font-medium">{week.title}</p>
                    <p className="text-xs text-slate-500">
                      {hasReview
                        ? '피드백 완료'
                        : hasSubmission
                          ? '제출 완료'
                          : hasDraft
                            ? '작성 중'
                            : week.is_active
                              ? '미제출'
                              : '미오픈'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {hasSubmission || hasDraft ? (
                    <Link
                      href="/lms/assignments"
                      className="text-xs px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors"
                    >
                      과제 보기
                    </Link>
                  ) : week.is_active ? (
                    <Link
                      href={`/lms/assignments/new?weekId=${week.id}&courseId=${enrollments[0]?.course_id}`}
                      className="text-xs px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors"
                    >
                      과제 작성
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-600 px-3 py-1.5">준비중</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-white font-semibold mt-1">{value}</p>
    </div>
  );
}
