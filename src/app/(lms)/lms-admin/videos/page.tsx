'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';

interface Lesson {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  description: string | null;
  video_url: string | null;
  video_duration: number | null;
  video_thumbnail: string | null;
  video_visible: boolean;
  sort_order: number;
}

interface WeekRow {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  assignment_type: string;
  is_active: boolean;
}

interface WeekGroup {
  weekNumber: number;
  courseId: string;
  assignments: WeekRow[];  // 해당 주차의 과제들 (course_weeks 행들)
}

interface NewLessonForm {
  title: string;
  description: string;
  videoUrl: string;
  videoDuration: string;
  videoVisible: boolean;
}

const emptyForm: NewLessonForm = { title: '', description: '', videoUrl: '', videoDuration: '', videoVisible: true };

function isVimeo(url: string): boolean { return /vimeo\.com/.test(url); }

function getVimeoThumb(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? `https://vumbnail.com/${m[1]}.jpg` : null;
}

function getVimeoEmbedUrl(url: string): string | null {
  const m = url.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-zA-Z0-9]+))?/);
  if (!m) return null;
  let embed = `https://player.vimeo.com/video/${m[1]}?autoplay=0&title=0&byline=0&portrait=0`;
  if (m[2]) embed += `&h=${m[2]}`;
  return embed;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분 ${s}초`;
}

export default function AdminVideosPage() {
  const { accessToken } = useAuthStore();
  const [weekGroups, setWeekGroups] = useState<WeekGroup[]>([]);
  const [lessonsMap, setLessonsMap] = useState<Record<number, Lesson[]>>({});
  const [loading, setLoading] = useState(true);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [addingToWeek, setAddingToWeek] = useState<number | null>(null);
  const [newForm, setNewForm] = useState<NewLessonForm>(emptyForm);
  const [editingLesson, setEditingLesson] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<NewLessonForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchWeeks = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/lms/admin/videos', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const result = await res.json();
        const weeks: WeekRow[] = result.data?.weeks || [];
        // 주차 번호별로 그룹핑
        const groupMap = new Map<number, WeekGroup>();
        weeks.forEach(w => {
          if (!groupMap.has(w.week_number)) {
            groupMap.set(w.week_number, { weekNumber: w.week_number, courseId: w.course_id, assignments: [] });
          }
          groupMap.get(w.week_number)!.assignments.push(w);
        });
        setWeekGroups(Array.from(groupMap.values()).sort((a, b) => a.weekNumber - b.weekNumber));
      }
    } catch { /* silent */ } finally { setLoading(false); }
  }, [accessToken]);

  const fetchLessons = useCallback(async (courseId: string, weekNumber: number) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`/api/lms/lessons?courseId=${courseId}&weekNumber=${weekNumber}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const result = await res.json();
        setLessonsMap(prev => ({ ...prev, [weekNumber]: result.data?.lessons || [] }));
      }
    } catch { /* silent */ }
  }, [accessToken]);

  useEffect(() => { fetchWeeks(); }, [fetchWeeks]);

  const toggleWeek = (wg: WeekGroup) => {
    setExpandedWeeks(prev => {
      const next = new Set(prev);
      if (next.has(wg.weekNumber)) {
        next.delete(wg.weekNumber);
      } else {
        next.add(wg.weekNumber);
        if (!lessonsMap[wg.weekNumber]) fetchLessons(wg.courseId, wg.weekNumber);
      }
      return next;
    });
  };

  const handleCreateLesson = async (wg: WeekGroup) => {
    if (!accessToken || !newForm.title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lms/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          courseId: wg.courseId,
          weekNumber: wg.weekNumber,
          title: newForm.title,
          description: newForm.description || null,
          videoUrl: newForm.videoUrl || null,
          videoDuration: newForm.videoDuration ? parseInt(newForm.videoDuration) : null,
          videoVisible: newForm.videoVisible,
        }),
      });
      if (res.ok) {
        setNewForm(emptyForm);
        setAddingToWeek(null);
        await fetchLessons(wg.courseId, wg.weekNumber);
      }
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const handleUpdateLesson = async (lessonId: string, courseId: string, weekNumber: number) => {
    if (!accessToken) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/lms/lessons/${lessonId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          title: editForm.title,
          description: editForm.description || null,
          videoUrl: editForm.videoUrl || null,
          videoDuration: editForm.videoDuration ? parseInt(editForm.videoDuration) : null,
          videoVisible: editForm.videoVisible,
        }),
      });
      if (res.ok) {
        setEditingLesson(null);
        await fetchLessons(courseId, weekNumber);
      }
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const handleDeleteLesson = async (lessonId: string, courseId: string, weekNumber: number) => {
    if (!accessToken || !confirm('이 레슨을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`/api/lms/lessons/${lessonId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) await fetchLessons(courseId, weekNumber);
    } catch { /* silent */ }
  };

  const handleToggleLessonVisible = async (lesson: Lesson) => {
    if (!accessToken) return;
    try {
      await fetch(`/api/lms/lessons/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ videoVisible: !lesson.video_visible }),
      });
      await fetchLessons(lesson.course_id, lesson.week_number);
    } catch { /* silent */ }
  };

  const handleMoveLesson = async (lesson: Lesson, direction: 'up' | 'down') => {
    if (!accessToken) return;
    const weekLessons = lessonsMap[lesson.week_number] || [];
    const idx = weekLessons.findIndex(l => l.id === lesson.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= weekLessons.length) return;
    const swapLesson = weekLessons[swapIdx];
    try {
      await Promise.all([
        fetch(`/api/lms/lessons/${lesson.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ sortOrder: swapLesson.sort_order }),
        }),
        fetch(`/api/lms/lessons/${swapLesson.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ sortOrder: lesson.sort_order }),
        }),
      ]);
      await fetchLessons(lesson.course_id, lesson.week_number);
    } catch { /* silent */ }
  };

  const startEdit = (lesson: Lesson) => {
    setEditingLesson(lesson.id);
    setEditForm({
      title: lesson.title,
      description: lesson.description || '',
      videoUrl: lesson.video_url || '',
      videoDuration: lesson.video_duration?.toString() || '',
      videoVisible: lesson.video_visible,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <svg className="w-7 h-7 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          영상 관리
        </h1>
        <p className="text-slate-400 mt-1">주차별로 레슨(강의 영상)을 관리합니다</p>
      </div>

      {/* Week Accordion - grouped by week_number */}
      <div className="space-y-3">
        {weekGroups.map((wg) => {
          const isExpanded = expandedWeeks.has(wg.weekNumber);
          const weekLessons = lessonsMap[wg.weekNumber] || [];
          const lessonCount = weekLessons.length;
          const visibleCount = weekLessons.filter(l => l.video_visible).length;

          return (
            <div key={wg.weekNumber} className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
              {/* Week Header */}
              <button
                onClick={() => toggleWeek(wg)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-700/30 transition-colors"
              >
                <svg
                  className={`w-5 h-5 text-slate-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold px-2.5 py-0.5 rounded bg-amber-600/30 text-amber-300">
                      {wg.weekNumber}주차
                    </span>
                    {lessonCount > 0 && (
                      <span className="text-xs text-slate-400">{lessonCount}개 레슨 · {visibleCount}개 공개</span>
                    )}
                  </div>
                  {/* 해당 주차의 과제 목록 표시 */}
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {wg.assignments.map(a => (
                      <span key={a.id} className="text-xs px-2 py-0.5 rounded bg-slate-700/80 text-slate-300">
                        📝 {a.title}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isExpanded) toggleWeek(wg);
                    setAddingToWeek(addingToWeek === wg.weekNumber ? null : wg.weekNumber);
                    setNewForm(emptyForm);
                  }}
                  className="px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  레슨 추가
                </button>
              </button>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-slate-700/50">
                  {/* Add Lesson Form */}
                  {addingToWeek === wg.weekNumber && (
                    <div className="p-4 bg-slate-900/50 border-b border-slate-700/50">
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">레슨 제목 *</label>
                            <input type="text" value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="예: 오리엔테이션" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">Vimeo URL</label>
                            <input type="url" value={newForm.videoUrl} onChange={(e) => setNewForm({ ...newForm, videoUrl: e.target.value })} placeholder="https://vimeo.com/123456789" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                            {newForm.videoUrl && isVimeo(newForm.videoUrl) && <p className="text-xs text-blue-400 mt-1">Vimeo 감지됨</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">설명</label>
                            <input type="text" value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} placeholder="레슨 설명 (선택)" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </div>
                          <div>
                            <label className="block text-xs text-slate-400 mb-1">영상 길이 (초)</label>
                            <input type="number" value={newForm.videoDuration} onChange={(e) => setNewForm({ ...newForm, videoDuration: e.target.value })} placeholder="예: 1425" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                          </div>
                          <div className="flex items-end gap-2">
                            <label className="flex items-center gap-2 text-sm text-slate-400">
                              <input type="checkbox" checked={newForm.videoVisible} onChange={(e) => setNewForm({ ...newForm, videoVisible: e.target.checked })} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500" />
                              공개
                            </label>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setAddingToWeek(null); setNewForm(emptyForm); }} className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors">취소</button>
                          <button onClick={() => handleCreateLesson(wg)} disabled={saving || !newForm.title.trim()} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">{saving ? '저장 중...' : '추가'}</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Lesson List */}
                  <div className="divide-y divide-slate-700/50">
                    {weekLessons.map((lesson, idx) => {
                      const thumb = lesson.video_thumbnail || (lesson.video_url && isVimeo(lesson.video_url) ? getVimeoThumb(lesson.video_url) : null);

                      if (editingLesson === lesson.id) {
                        return (
                          <div key={lesson.id} className="p-4 bg-slate-900/30">
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">레슨 제목</label>
                                  <input type="text" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">Vimeo URL</label>
                                  <input type="url" value={editForm.videoUrl} onChange={(e) => setEditForm({ ...editForm, videoUrl: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">설명</label>
                                  <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                </div>
                                <div>
                                  <label className="block text-xs text-slate-400 mb-1">영상 길이 (초)</label>
                                  <input type="number" value={editForm.videoDuration} onChange={(e) => setEditForm({ ...editForm, videoDuration: e.target.value })} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500" />
                                </div>
                                <div className="flex items-end gap-2">
                                  <label className="flex items-center gap-2 text-sm text-slate-400">
                                    <input type="checkbox" checked={editForm.videoVisible} onChange={(e) => setEditForm({ ...editForm, videoVisible: e.target.checked })} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-amber-500" />
                                    공개
                                  </label>
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <button onClick={() => setEditingLesson(null)} className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors">취소</button>
                                <button onClick={() => handleUpdateLesson(lesson.id, lesson.course_id, lesson.week_number)} disabled={saving} className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-600 text-white text-sm font-medium rounded-lg transition-colors">{saving ? '저장 중...' : '저장'}</button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={lesson.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-700/20 transition-colors">
                          {/* Order */}
                          <div className="flex flex-col gap-0.5 flex-shrink-0">
                            <button onClick={() => handleMoveLesson(lesson, 'up')} disabled={idx === 0} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg></button>
                            <button onClick={() => handleMoveLesson(lesson, 'down')} disabled={idx === weekLessons.length - 1} className="p-0.5 text-slate-500 hover:text-white disabled:opacity-30"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></button>
                          </div>
                          {/* Thumb */}
                          <div className="w-20 h-12 rounded bg-slate-900 flex-shrink-0 overflow-hidden cursor-pointer relative group" onClick={() => { if (lesson.video_url) setPreviewUrl(isVimeo(lesson.video_url) ? getVimeoEmbedUrl(lesson.video_url) : lesson.video_url); }}>
                            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" /> : lesson.video_url ? <div className="w-full h-full flex items-center justify-center bg-purple-900/30"><svg className="w-5 h-5 text-purple-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div> : <div className="w-full h-full flex items-center justify-center"><svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg></div>}
                            {lesson.video_url && <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg></div>}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-mono">{idx + 1}.</span>
                              <span className="font-medium text-white text-sm truncate">{lesson.title}</span>
                              {lesson.video_url && isVimeo(lesson.video_url) && <span className="text-xs px-1.5 py-0.5 rounded bg-blue-600/20 text-blue-400">Vimeo</span>}
                              <span className={`text-xs px-1.5 py-0.5 rounded ${lesson.video_visible ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'}`}>{lesson.video_visible ? '공개' : '비공개'}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                              {lesson.description && <span className="truncate max-w-[200px]">{lesson.description}</span>}
                              {lesson.video_duration && <span>{formatDuration(lesson.video_duration)}</span>}
                              {!lesson.video_url && <span className="text-slate-600">URL 미등록</span>}
                            </div>
                          </div>
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button onClick={() => handleToggleLessonVisible(lesson)} className={`relative w-10 h-5 rounded-full transition-colors ${lesson.video_visible ? 'bg-green-600' : 'bg-slate-600'}`}>
                              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${lesson.video_visible ? 'translate-x-5' : 'translate-x-0.5'}`} />
                            </button>
                            <button onClick={() => startEdit(lesson)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                            </button>
                            <button onClick={() => handleDeleteLesson(lesson.id, lesson.course_id, lesson.week_number)} className="p-1.5 text-red-400/60 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {weekLessons.length === 0 && addingToWeek !== wg.weekNumber && (
                      <div className="px-4 py-6 text-center text-sm text-slate-500">
                        레슨이 없습니다. [+ 레슨 추가]로 강의 영상을 등록하세요.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="w-full max-w-4xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button onClick={() => setPreviewUrl(null)} className="text-white/60 hover:text-white p-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
              {previewUrl.includes('vimeo') ? (
                <iframe src={previewUrl} className="absolute inset-0 w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
              ) : (
                <video src={previewUrl} controls className="w-full h-full object-contain" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
