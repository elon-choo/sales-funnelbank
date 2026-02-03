// src/app/api/lms/rag/mappings/route.ts
// RAG 주차 매핑 API (관리자 전용)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/rag/mappings - 매핑 목록 조회
export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');
    const datasetId = searchParams.get('datasetId');

    try {
      let query = supabase
        .from('rag_week_mappings')
        .select(`
          id,
          week_id,
          rag_dataset_id,
          priority,
          created_at,
          course_weeks (
            id,
            week_number,
            title,
            course_id,
            courses (
              id,
              title
            )
          ),
          rag_datasets (
            id,
            name,
            chunk_count,
            status
          )
        `)
        .order('priority', { ascending: true });

      if (weekId) {
        query = query.eq('week_id', weekId);
      }
      if (datasetId) {
        query = query.eq('rag_dataset_id', datasetId);
      }

      const { data: mappings, error } = await query;

      if (error) {
        console.error('[RAG Mappings GET Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '매핑 조회 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { mappings, total: mappings?.length || 0 },
      });
    } catch (error) {
      console.error('[RAG Mappings GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/rag/mappings - 매핑 생성
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { weekId, datasetId, priority = 0 } = body;

      if (!weekId || !datasetId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'weekId와 datasetId는 필수입니다' } },
          { status: 400 }
        );
      }

      // 주차 존재 확인
      const { data: week, error: weekError } = await supabase
        .from('course_weeks')
        .select('id')
        .eq('id', weekId)
        .single();

      if (weekError || !week) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '주차를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 데이터셋 존재 확인
      const { data: dataset, error: datasetError } = await supabase
        .from('rag_datasets')
        .select('id, status')
        .eq('id', datasetId)
        .single();

      if (datasetError || !dataset) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '데이터셋을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      if (dataset.status !== 'ready') {
        return NextResponse.json(
          { success: false, error: { code: 'INVALID_STATUS', message: '준비된 데이터셋만 매핑할 수 있습니다' } },
          { status: 400 }
        );
      }

      // 중복 매핑 확인
      const { data: existing } = await supabase
        .from('rag_week_mappings')
        .select('id')
        .eq('week_id', weekId)
        .eq('rag_dataset_id', datasetId)
        .single();

      if (existing) {
        return NextResponse.json(
          { success: false, error: { code: 'DUPLICATE', message: '이미 매핑된 데이터셋입니다' } },
          { status: 409 }
        );
      }

      // 매핑 생성
      const { data: mapping, error: mappingError } = await supabase
        .from('rag_week_mappings')
        .insert({
          week_id: weekId,
          rag_dataset_id: datasetId,
          priority,
        })
        .select(`
          id,
          week_id,
          rag_dataset_id,
          priority,
          created_at
        `)
        .single();

      if (mappingError) {
        console.error('[RAG Mapping Create Error]', mappingError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '매핑 생성 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { success: true, data: { mapping } },
        { status: 201 }
      );
    } catch (error) {
      console.error('[RAG Mapping Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/rag/mappings - 매핑 삭제
export async function DELETE(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { mappingId } = body;

      if (!mappingId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'mappingId는 필수입니다' } },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from('rag_week_mappings')
        .delete()
        .eq('id', mappingId);

      if (error) {
        console.error('[RAG Mapping Delete Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '매핑 삭제 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { deleted: true, mappingId },
      });
    } catch (error) {
      console.error('[RAG Mapping Delete Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/rag/mappings - 매핑 우선순위 변경
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { mappingId, priority } = body;

      if (!mappingId || priority === undefined) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'mappingId와 priority는 필수입니다' } },
          { status: 400 }
        );
      }

      const { data: mapping, error } = await supabase
        .from('rag_week_mappings')
        .update({ priority })
        .eq('id', mappingId)
        .select()
        .single();

      if (error) {
        console.error('[RAG Mapping Update Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '매핑 수정 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { mapping },
      });
    } catch (error) {
      console.error('[RAG Mapping Update Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
