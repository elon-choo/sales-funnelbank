// src/app/api/lms/admin/video-progress/route.ts
// 관리자용 VOD 시청 현황 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (_auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const weekId = searchParams.get('weekId');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'last_activity';
    const sortOrder = searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = 50;
    const offset = (page - 1) * limit;

    try {
      if (!courseId) {
        return NextResponse.json(
          { success: false, error: { code: 'MISSING_PARAM', message: 'courseId는 필수입니다' } },
          { status: 400 }
        );
      }

      // 해당 기수의 활성 수강생 수
      const { count: totalStudents } = await supabase
        .from('course_enrollments')
        .select('id', { count: 'exact' })
        .eq('course_id', courseId)
        .eq('status', 'active')
        .is('deleted_at', null);

      // 주차 정보 조회
      const { data: weeks } = await supabase
        .from('course_weeks')
        .select('id, week_number, title')
        .eq('course_id', courseId)
        .is('deleted_at', null)
        .order('week_number', { ascending: true });

      const weekMap = new Map(weeks?.map(w => [w.id, w]) || []);
      const weekIds = weeks?.map(w => w.id) || [];

      // video_progress 조회 (해당 기수의 주차들)
      let vpQuery = supabase
        .from('video_progress')
        .select('id, user_id, week_id, course_id, watched_seconds, total_seconds, watch_percentage, is_completed, completed_at, updated_at');

      if (weekId) {
        vpQuery = vpQuery.eq('week_id', weekId);
      } else if (weekIds.length > 0) {
        vpQuery = vpQuery.in('week_id', weekIds);
      } else {
        // 주차가 없으면 빈 결과
        return NextResponse.json({
          success: true,
          data: {
            records: [],
            summary: { totalStudents: totalStudents || 0, completedCount: 0, avgPercentage: 0, notStartedCount: totalStudents || 0 },
            pagination: { page, limit, total: 0, totalPages: 0 },
          },
        });
      }

      const { data: allProgress } = await vpQuery;

      // 유저 ID 목록 추출
      const userIds = [...new Set(allProgress?.map(p => p.user_id) || [])];

      // 프로필 조회 (이름, 이메일)
      let profiles: Array<{ id: string; full_name: string | null; email: string | null }> = [];
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        profiles = profileData || [];
      }

      const profileMap = new Map(profiles.map(p => [p.id, p]));

      // 레코드 구성
      type ProgressRecord = {
        id: string;
        userId: string;
        studentName: string;
        email: string;
        weekId: string;
        weekNumber: number;
        weekTitle: string;
        watchPercentage: number;
        watchedSeconds: number;
        totalSeconds: number;
        isCompleted: boolean;
        completedAt: string | null;
        lastActivity: string | null;
      };

      let records: ProgressRecord[] = (allProgress || []).map(p => {
        const profile = profileMap.get(p.user_id);
        const week = weekMap.get(p.week_id);
        return {
          id: p.id,
          userId: p.user_id,
          studentName: profile?.full_name || '이름 없음',
          email: profile?.email || '',
          weekId: p.week_id,
          weekNumber: week?.week_number || 0,
          weekTitle: week?.title || '',
          watchPercentage: p.watch_percentage || 0,
          watchedSeconds: p.watched_seconds || 0,
          totalSeconds: p.total_seconds || 0,
          isCompleted: p.is_completed || false,
          completedAt: p.completed_at,
          lastActivity: p.updated_at,
        };
      });

      // 검색 필터
      if (search) {
        const q = search.toLowerCase();
        records = records.filter(
          r => r.studentName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)
        );
      }

      // Summary 계산 (필터 전 전체 데이터 기반)
      const allRecords = (allProgress || []);
      const uniqueWatchers = new Set(allRecords.map(r => r.user_id));
      const completedCount = allRecords.filter(r => r.is_completed).length;
      const avgPercentage = allRecords.length > 0
        ? Math.round(allRecords.reduce((s, r) => s + (r.watch_percentage || 0), 0) / allRecords.length)
        : 0;
      const notStartedCount = Math.max(0, (totalStudents || 0) - uniqueWatchers.size);

      // 정렬
      records.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'watch_percentage':
            cmp = a.watchPercentage - b.watchPercentage;
            break;
          case 'student':
            cmp = a.studentName.localeCompare(b.studentName);
            break;
          case 'week':
            cmp = a.weekNumber - b.weekNumber;
            break;
          case 'last_activity':
          default:
            cmp = (a.lastActivity || '').localeCompare(b.lastActivity || '');
            break;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });

      // 페이지네이션
      const total = records.length;
      const totalPages = Math.ceil(total / limit);
      const paginatedRecords = records.slice(offset, offset + limit);

      return NextResponse.json({
        success: true,
        data: {
          records: paginatedRecords,
          summary: {
            totalStudents: totalStudents || 0,
            completedCount,
            avgPercentage,
            notStartedCount,
          },
          weeks: weeks || [],
          pagination: { page, limit, total, totalPages },
        },
      });
    } catch (error) {
      console.error('[Admin VideoProgress GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
