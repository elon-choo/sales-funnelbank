// src/app/api/lms/courses/route.ts
// 기수(Course) 목록 조회 및 생성 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';
import {
  withCache,
  createCacheKey,
  invalidateCourseCache,
  CACHE_PROFILES
} from '@/lib/cache/api-cache';

// GET /api/lms/courses - 수강 중인 기수 목록 (학생) 또는 전체 기수 (관리자)
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    const skipCache = searchParams.get('refresh') === 'true';

    try {
      // 관리자: 전체 기수 조회 (글로벌 캐시)
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        const cacheKey = createCacheKey('courses:admin', { status, limit: String(limit), offset: String(offset) });

        const fetchData = async () => {
          let query = supabase
            .from('courses')
            .select('*', { count: 'exact' })
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

          if (status) {
            query = query.eq('status', status);
          }

          const { data: courses, error, count } = await query;

          if (error) {
            throw new Error(error.message);
          }

          return { courses, total: count, limit, offset };
        };

        if (skipCache) {
          const data = await fetchData();
          return createCoursesResponse(data, false);
        }

        const { data, cached } = await withCache(
          cacheKey,
          fetchData,
          { ttl: 1000 * 60, type: 'global' }  // 1분 캐시
        );

        return createCoursesResponse(data, cached);
      }

      // 학생: 등록된 기수만 조회 (사용자별 캐시)
      const cacheKey = createCacheKey(`user:${auth.userId}:courses`, { status });

      const fetchStudentCourses = async () => {
        const { data: enrollments, error: enrollError } = await supabase
          .from('course_enrollments')
          .select(`
            id,
            status,
            enrolled_at,
            courses (
              id,
              title,
              description,
              status,
              total_weeks,
              start_date,
              end_date,
              created_at
            )
          `)
          .eq('user_id', auth.userId)  // 핵심: API 레벨에서 user_id 필터
          .is('deleted_at', null);

        if (enrollError) {
          throw new Error(enrollError.message);
        }

        // status 필터 적용
        let filteredEnrollments = enrollments || [];
        if (status) {
          filteredEnrollments = filteredEnrollments.filter(
            (e) => e.status === status
          );
        }

        const courses = filteredEnrollments.map((e) => ({
          ...e.courses,
          enrollmentId: e.id,
          enrollmentStatus: e.status,
          enrolledAt: e.enrolled_at,
        }));

        return {
          courses,
          total: courses.length,
          limit,
          offset,
        };
      };

      if (skipCache) {
        const data = await fetchStudentCourses();
        return createCoursesResponse(data, false);
      }

      const { data, cached } = await withCache(
        cacheKey,
        fetchStudentCourses,
        { ttl: 1000 * 60 * 2, type: 'user' }  // 2분 캐시
      );

      return createCoursesResponse(data, cached);
    } catch (error) {
      console.error('[Courses GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// 캐시된 응답 생성
function createCoursesResponse(data: Record<string, unknown>, cached: boolean) {
  const headers = new Headers(CACHE_PROFILES.courses);
  headers.set('X-Cache', cached ? 'HIT' : 'MISS');

  return NextResponse.json(
    { success: true, data },
    { headers }
  );
}

// POST /api/lms/courses - 기수 생성 (관리자 전용)
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { title, description, totalWeeks, startDate, endDate } = body;

      // 유효성 검증
      if (!title || typeof title !== 'string' || title.trim().length === 0) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '기수 제목은 필수입니다' } },
          { status: 400 }
        );
      }

      if (totalWeeks && (typeof totalWeeks !== 'number' || totalWeeks < 1 || totalWeeks > 52)) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: '총 주차는 1~52 사이여야 합니다' } },
          { status: 400 }
        );
      }

      const { data: course, error } = await supabase
        .from('courses')
        .insert({
          title: title.trim(),
          description: description?.trim() || null,
          total_weeks: totalWeeks || 10,
          start_date: startDate || null,
          end_date: endDate || null,
          created_by: auth.userId,
          status: 'draft',
        })
        .select()
        .single();

      if (error) {
        console.error('[Course Create Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '기수 생성 실패' } },
          { status: 500 }
        );
      }

      // 캐시 무효화
      invalidateCourseCache();

      return NextResponse.json(
        { success: true, data: { course } },
        { status: 201 }
      );
    } catch (error) {
      console.error('[Course Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
