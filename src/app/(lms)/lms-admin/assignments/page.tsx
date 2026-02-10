// src/app/(lms)/lms-admin/assignments/page.tsx
// 관리자 과제 관리 - 수강생별 과제 제출 현황 및 피드백 횟수 관리
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface Course {
  id: string;
  title: string;
  status: string;
}

interface Week {
  id: string;
  week_number: number;
  title: string;
}

interface StudentAssignment {
  id: string;
  user_id: string;
  week_id: string;
  version: number;
  status: 'draft' | 'submitted' | 'processing' | 'feedback_ready';
  submitted_at: string | null;
  created_at: string;
  course_weeks: { id: string; week_number: number; title: string } | null;
}

interface Feedback {
  id: string;
  assignment_id: string;
  scores: { total: number } | null;
  created_at: string;
}

interface StudentRow {
  enrollment: {
    id: string;
    user_id: string;
    status: string;
    max_submissions_per_week: number;
    profiles: { id: string; email: string; full_name: string | null };
  };
  assignments: StudentAssignment[];
  feedbacks: Feedback[];
}

const statusLabels: Record<string, { text: string; color: string }> = {
  draft: { text: '초안', color: 'bg-slate-600/20 text-slate-400' },
  submitted: { text: '제출됨', color: 'bg-blue-600/20 text-blue-400' },
  processing: { text: 'AI 분석중', color: 'bg-purple-600/20 text-purple-400' },
  feedback_ready: { text: '피드백 완료', color: 'bg-green-600/20 text-green-400' },
};

export default function AdminAssignmentsPage() {
  const { accessToken } = useAuthStore();
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [expandedStudent, setExpandedStudent] = useState<string | null>(null);
  const [updatingLimit, setUpdatingLimit] = useState<string | null>(null);
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<string>('');
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);

      // Fetch courses
      const coursesRes = await fetch('/api/lms/courses', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const coursesData = await coursesRes.json();
      const coursesList = coursesData.data?.courses || [];
      setCourses(coursesList);

      const courseId = selectedCourse || coursesList[0]?.id;
      if (!courseId) {
        setLoading(false);
        return;
      }
      if (!selectedCourse && courseId) setSelectedCourse(courseId);

      // Fetch weeks, enrollments, assignments, feedbacks in parallel
      const [weeksRes, enrollmentsRes, assignmentsRes, feedbacksRes] = await Promise.all([
        fetch(`/api/lms/weeks?courseId=${courseId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/lms/enrollments?courseId=${courseId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/lms/assignments?courseId=${courseId}&limit=500`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetch(`/api/lms/feedbacks?courseId=${courseId}&limit=500`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);

      const weeksData = await weeksRes.json();
      const enrollmentsData = await enrollmentsRes.json();
      const assignmentsData = await assignmentsRes.json();
      const feedbacksData = await feedbacksRes.json();

      const weeksList = weeksData.data?.weeks || [];
      const enrollments = enrollmentsData.data?.enrollments || [];
      const assignments = assignmentsData.data?.assignments || [];
      const feedbacks = feedbacksData.data?.feedbacks || [];

      setWeeks(weeksList);

      // Group by student
      const studentMap = new Map<string, StudentRow>();
      for (const enrollment of enrollments) {
        const userId = enrollment.user_id;
        studentMap.set(userId, {
          enrollment: {
            id: enrollment.id,
            user_id: userId,
            status: enrollment.status,
            max_submissions_per_week: enrollment.max_submissions_per_week ?? 2,
            profiles: enrollment.profiles,
          },
          assignments: [],
          feedbacks: [],
        });
      }

      for (const assignment of assignments) {
        const student = studentMap.get(assignment.user_id);
        if (student) {
          student.assignments.push(assignment);
        }
      }

      for (const feedback of feedbacks) {
        const assignmentUserId = (feedback.assignments as { user_id?: string })?.user_id;
        if (assignmentUserId) {
          const student = studentMap.get(assignmentUserId);
          if (student) {
            student.feedbacks.push({
              id: feedback.id,
              assignment_id: feedback.assignment_id,
              scores: feedback.scores as { total: number } | null,
              created_at: feedback.created_at,
            });
          }
        }
      }

      setStudents(Array.from(studentMap.values()));
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터 로딩 실패');
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedCourse]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUpdateLimit = async (enrollmentId: string, newLimit: number) => {
    if (!accessToken) return;
    setUpdatingLimit(enrollmentId);

    try {
      const res = await fetch('/api/lms/admin/submissions', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enrollmentId,
          maxSubmissionsPerWeek: newLimit,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || '업데이트 실패');
      }

      // Update local state
      setStudents((prev) =>
        prev.map((s) =>
          s.enrollment.id === enrollmentId
            ? { ...s, enrollment: { ...s.enrollment, max_submissions_per_week: newLimit } }
            : s
        )
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setUpdatingLimit(null);
    }
  };

  const handleRegenerate = async (assignmentId: string) => {
    if (!accessToken) return;
    setRegenerating(assignmentId);

    try {
      const res = await fetch('/api/lms/feedbacks', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignmentId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || '피드백 재생성 실패');

      alert('피드백 재생성 작업이 큐에 추가되었습니다.');
      // Refresh after a short delay
      setTimeout(fetchData, 2000);
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setRegenerating(null);
    }
  };

  const getWeekAssignments = (student: StudentRow, weekId: string) => {
    return student.assignments
      .filter((a) => a.week_id === weekId && a.status !== 'draft')
      .sort((a, b) => a.version - b.version);
  };

  const getFeedbackForAssignment = (student: StudentRow, assignmentId: string) => {
    return student.feedbacks.find((f) => f.assignment_id === assignmentId);
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
      <div>
        <h1 className="text-2xl font-bold text-white">과제 관리</h1>
        <p className="text-slate-400 mt-1">수강생별 과제 제출 현황 및 피드백 횟수를 관리합니다</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <select
          value={selectedCourse}
          onChange={(e) => {
            setSelectedCourse(e.target.value);
            setSelectedWeek('all');
          }}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </select>
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          <option value="all">전체 주차</option>
          {weeks.map((week) => (
            <option key={week.id} value={week.id}>
              {week.week_number}주차 - {week.title}
            </option>
          ))}
        </select>
        <span className="text-slate-400 text-sm">총 {students.length}명</span>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 text-red-400">{error}</div>
      )}

      {/* Student Cards */}
      {students.length === 0 ? (
        <div className="bg-slate-800/50 rounded-2xl p-12 border border-slate-700 text-center">
          <p className="text-slate-400">수강생이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {students.map((student) => {
            const isExpanded = expandedStudent === student.enrollment.user_id;
            const filteredWeeks = selectedWeek === 'all' ? weeks : weeks.filter((w) => w.id === selectedWeek);
            const totalSubmitted = student.assignments.filter((a) => a.status !== 'draft').length;
            const totalFeedbacks = student.feedbacks.length;
            const avgScore =
              student.feedbacks.length > 0
                ? Math.round(
                    student.feedbacks
                      .map((f) => f.scores?.total || 0)
                      .reduce((a, b) => a + b, 0) / student.feedbacks.length
                  )
                : null;

            return (
              <div
                key={student.enrollment.user_id}
                className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden"
              >
                {/* Student Header */}
                <div
                  className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-700/30 transition-colors"
                  onClick={() =>
                    setExpandedStudent(isExpanded ? null : student.enrollment.user_id)
                  }
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-pink-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {(
                          student.enrollment.profiles?.full_name ||
                          student.enrollment.profiles?.email ||
                          '?'
                        )[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        {student.enrollment.profiles?.full_name || '이름 없음'}
                      </p>
                      <p className="text-sm text-slate-400">{student.enrollment.profiles?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {/* Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <p className="text-white font-medium">{totalSubmitted}</p>
                        <p className="text-slate-500 text-xs">제출</p>
                      </div>
                      <div className="text-center">
                        <p className="text-white font-medium">{totalFeedbacks}</p>
                        <p className="text-slate-500 text-xs">피드백</p>
                      </div>
                      <div className="text-center">
                        <p
                          className={`font-medium ${
                            avgScore !== null
                              ? avgScore >= 80
                                ? 'text-green-400'
                                : avgScore >= 60
                                ? 'text-yellow-400'
                                : 'text-red-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {avgScore !== null ? `${avgScore}점` : '-'}
                        </p>
                        <p className="text-slate-500 text-xs">평균</p>
                      </div>
                    </div>

                    {/* Submission Limit Control */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <span className="text-xs text-slate-400">제출 제한:</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            handleUpdateLimit(
                              student.enrollment.id,
                              Math.max(1, student.enrollment.max_submissions_per_week - 1)
                            )
                          }
                          disabled={
                            updatingLimit === student.enrollment.id ||
                            student.enrollment.max_submissions_per_week <= 1
                          }
                          className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white rounded transition-colors text-sm"
                        >
                          -
                        </button>
                        {updatingLimit === student.enrollment.id ? (
                          <span className="w-12 text-center">
                            <span className="inline-block w-4 h-4 border-t-2 border-amber-500 rounded-full animate-spin" />
                          </span>
                        ) : editingLimit === student.enrollment.id ? (
                          <input
                            type="number"
                            min={1}
                            max={999}
                            value={editLimitValue}
                            onChange={(e) => setEditLimitValue(e.target.value)}
                            onBlur={() => {
                              const val = parseInt(editLimitValue);
                              if (val >= 1 && val <= 999 && val !== student.enrollment.max_submissions_per_week) {
                                handleUpdateLimit(student.enrollment.id, val);
                              }
                              setEditingLimit(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                const val = parseInt(editLimitValue);
                                if (val >= 1 && val <= 999 && val !== student.enrollment.max_submissions_per_week) {
                                  handleUpdateLimit(student.enrollment.id, val);
                                }
                                setEditingLimit(null);
                              } else if (e.key === 'Escape') {
                                setEditingLimit(null);
                              }
                            }}
                            autoFocus
                            className="w-14 text-center text-white font-medium text-sm bg-slate-900 border border-amber-500 rounded px-1 py-0.5 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ) : (
                          <button
                            onClick={() => {
                              setEditingLimit(student.enrollment.id);
                              setEditLimitValue(String(student.enrollment.max_submissions_per_week));
                            }}
                            className="w-12 text-center text-white font-medium text-sm hover:bg-slate-700 rounded px-1 py-0.5 transition-colors cursor-text"
                            title="클릭하여 직접 입력"
                          >
                            {student.enrollment.max_submissions_per_week}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleUpdateLimit(
                              student.enrollment.id,
                              student.enrollment.max_submissions_per_week + 1
                            )
                          }
                          disabled={
                            updatingLimit === student.enrollment.id ||
                            student.enrollment.max_submissions_per_week >= 999
                          }
                          className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-white rounded transition-colors text-sm"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-xs text-slate-500">회/주차</span>
                    </div>

                    {/* Expand Icon */}
                    <svg
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="px-6 pb-4 border-t border-slate-700">
                    {filteredWeeks.length === 0 ? (
                      <p className="text-slate-500 py-4 text-center">주차 데이터 없음</p>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {filteredWeeks.map((week) => {
                          const weekAssignments = getWeekAssignments(student, week.id);
                          const maxSubs = student.enrollment.max_submissions_per_week;

                          return (
                            <div key={week.id} className="bg-slate-900/50 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-white font-medium text-sm">
                                  {week.week_number}주차 - {week.title}
                                </h4>
                                <span className="text-xs text-slate-400">
                                  {weekAssignments.length} / {maxSubs}회 제출
                                </span>
                              </div>

                              {weekAssignments.length === 0 ? (
                                <p className="text-slate-500 text-sm">미제출</p>
                              ) : (
                                <div className="space-y-2">
                                  {weekAssignments.map((assignment) => {
                                    const feedback = getFeedbackForAssignment(student, assignment.id);
                                    const score = feedback?.scores?.total;
                                    const statusInfo = statusLabels[assignment.status] || {
                                      text: assignment.status,
                                      color: 'bg-slate-600/20 text-slate-400',
                                    };

                                    return (
                                      <div
                                        key={assignment.id}
                                        className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                                      >
                                        <div className="flex items-center gap-3">
                                          <span className="text-xs text-slate-500">v{assignment.version}</span>
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusInfo.color}`}>
                                            {statusInfo.text}
                                          </span>
                                          {assignment.submitted_at && (
                                            <span className="text-xs text-slate-500">
                                              {new Date(assignment.submitted_at).toLocaleDateString('ko-KR', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                              })}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-3">
                                          {/* Score */}
                                          {score != null && (
                                            <span
                                              className={`text-sm font-medium ${
                                                score >= 80
                                                  ? 'text-green-400'
                                                  : score >= 60
                                                  ? 'text-yellow-400'
                                                  : 'text-red-400'
                                              }`}
                                            >
                                              {score}점
                                            </span>
                                          )}

                                          {/* View Feedback */}
                                          {feedback && (
                                            <Link
                                              href={`/lms/feedbacks/${feedback.id}`}
                                              className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                                            >
                                              피드백 보기
                                            </Link>
                                          )}

                                          {/* Regenerate */}
                                          {(assignment.status === 'submitted' || assignment.status === 'feedback_ready') && (
                                            <button
                                              onClick={() => handleRegenerate(assignment.id)}
                                              disabled={regenerating === assignment.id}
                                              className="text-xs px-2 py-1 bg-purple-600/20 text-purple-400 hover:bg-purple-600/30 disabled:opacity-50 rounded transition-colors"
                                            >
                                              {regenerating === assignment.id ? '처리중...' : '재생성'}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
