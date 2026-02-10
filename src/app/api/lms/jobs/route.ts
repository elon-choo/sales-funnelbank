// src/app/api/lms/jobs/route.ts
// 피드백 작업 상태 조회 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/jobs - 피드백 작업 목록 조회
export async function GET(request: NextRequest) {
  return withLmsAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    const assignmentIds = searchParams.get('assignmentIds'); // 쉼표 구분 복수 ID
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    try {
      // 관리자: 전체 작업 조회
      if (auth.lmsRole === 'admin' || auth.tier === 'ENTERPRISE') {
        let query = supabase
          .from('feedback_jobs')
          .select(`
            id,
            assignment_id,
            status,
            worker_type,
            attempts,
            max_attempts,
            started_at,
            completed_at,
            error_message,
            created_at,
            assignments (
              id,
              user_id,
              course_id,
              week_id,
              version,
              profiles (id, email, full_name),
              courses (id, title),
              course_weeks (id, week_number, title)
            )
          `, { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (assignmentId) query = query.eq('assignment_id', assignmentId);
        if (assignmentIds) query = query.in('assignment_id', assignmentIds.split(','));
        if (status) query = query.eq('status', status);

        const { data: jobs, error, count } = await query;

        if (error) {
          console.error('[Jobs GET Admin Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '작업 목록 조회 실패' } },
            { status: 500 }
          );
        }

        // 통계 정보 추가
        const { data: statsData } = await supabase
          .from('feedback_jobs')
          .select('status')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        const stats = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        };

        if (statsData) {
          statsData.forEach((job) => {
            if (job.status in stats) {
              stats[job.status as keyof typeof stats]++;
            }
          });
        }

        return NextResponse.json({
          success: true,
          data: { jobs, total: count, limit, offset, stats },
        });
      }

      // 학생: 본인 과제의 작업만 조회 (CTO-001 방안B)
      let query = supabase
        .from('feedback_jobs')
        .select(`
          id,
          assignment_id,
          status,
          attempts,
          started_at,
          completed_at,
          created_at,
          assignments!inner (
            id,
            user_id,
            course_id,
            week_id,
            version,
            courses (id, title),
            course_weeks (id, week_number, title)
          )
        `, { count: 'exact' })
        .eq('assignments.user_id', auth.userId)  // 핵심: API 레벨 user_id 필터
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (assignmentId) query = query.eq('assignment_id', assignmentId);
      if (assignmentIds) query = query.in('assignment_id', assignmentIds.split(','));
      if (status) query = query.eq('status', status);

      const { data: jobs, error, count } = await query;

      if (error) {
        console.error('[Jobs GET Student Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '작업 목록 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { jobs, total: count, limit, offset },
      });
    } catch (error) {
      console.error('[Jobs GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/jobs - 실패한 작업 일괄 삭제 (관리자 전용)
export async function DELETE(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { jobIds, deleteAllFailed = false } = body;

      if (!jobIds && !deleteAllFailed) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'jobIds 또는 deleteAllFailed가 필요합니다' } },
          { status: 400 }
        );
      }

      let deletedCount = 0;

      if (deleteAllFailed) {
        // 실패한 작업 모두 삭제
        const { data, error } = await supabase
          .from('feedback_jobs')
          .delete()
          .eq('status', 'failed')
          .select('id');

        if (error) {
          console.error('[Jobs Delete All Failed Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '작업 삭제 실패' } },
            { status: 500 }
          );
        }

        deletedCount = data?.length || 0;
      } else if (jobIds && Array.isArray(jobIds)) {
        // 특정 작업들만 삭제 (실패한 작업만)
        const { data, error } = await supabase
          .from('feedback_jobs')
          .delete()
          .in('id', jobIds)
          .eq('status', 'failed')
          .select('id');

        if (error) {
          console.error('[Jobs Delete Error]', error);
          return NextResponse.json(
            { success: false, error: { code: 'DB_ERROR', message: '작업 삭제 실패' } },
            { status: 500 }
          );
        }

        deletedCount = data?.length || 0;
      }

      return NextResponse.json({
        success: true,
        data: { deleted: deletedCount },
      });
    } catch (error) {
      console.error('[Jobs Delete Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
