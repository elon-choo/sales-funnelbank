// src/app/api/lms/rag/route.ts
// RAG 데이터셋 관리 API (관리자 전용)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// GET /api/lms/rag - RAG 데이터셋 목록 조회
export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const includeChunks = searchParams.get('includeChunks') === 'true';

    try {
      let query = supabase
        .from('rag_datasets')
        .select(`
          id,
          name,
          file_path,
          file_size,
          chunk_count,
          version,
          is_active,
          created_at
        `)
        .order('created_at', { ascending: false });

      const { data: datasets, error } = await query;

      if (error) {
        console.error('[RAG GET Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '데이터셋 조회 실패' } },
          { status: 500 }
        );
      }

      // 청크 포함 시 추가 조회
      let datasetsWithChunks = datasets;
      if (includeChunks && datasets && datasets.length > 0) {
        const datasetIds = datasets.map(d => d.id);
        const { data: chunks } = await supabase
          .from('rag_chunks')
          .select('id, dataset_id, chunk_index, category, chunk_type')
          .in('dataset_id', datasetIds)
          .order('chunk_index', { ascending: true });

        const chunksByDataset = new Map<string, typeof chunks>();
        chunks?.forEach(chunk => {
          const existing = chunksByDataset.get(chunk.dataset_id) || [];
          existing.push(chunk);
          chunksByDataset.set(chunk.dataset_id, existing);
        });

        datasetsWithChunks = datasets.map(d => ({
          ...d,
          chunks: chunksByDataset.get(d.id) || [],
        }));
      }

      return NextResponse.json({
        success: true,
        data: { datasets: datasetsWithChunks, total: datasets?.length || 0 },
      });
    } catch (error) {
      console.error('[RAG GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// POST /api/lms/rag - RAG 데이터셋 생성 + 청크 분할
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { name, content, category, chunkSize = 1500, chunkOverlap = 200 } = body;

      if (!name || !content) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'name과 content는 필수입니다' } },
          { status: 400 }
        );
      }

      // 1. 데이터셋 생성
      const { data: dataset, error: datasetError } = await supabase
        .from('rag_datasets')
        .insert({
          name,
          file_path: `manual/${Date.now()}_${name}`,
          file_size: content.length,
          chunk_count: 0,
          version: 1,
          is_active: true,
        })
        .select()
        .single();

      if (datasetError || !dataset) {
        console.error('[RAG Dataset Create Error]', datasetError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '데이터셋 생성 실패' } },
          { status: 500 }
        );
      }

      // 2. 텍스트 청크 분할
      const chunks = splitTextIntoChunks(content, chunkSize, chunkOverlap);

      // 3. 청크 저장
      const chunkRecords = chunks.map((chunkContent, index) => ({
        dataset_id: dataset.id,
        chunk_index: index,
        category: category || 'general',
        chunk_type: 'text',
        content: chunkContent,
        metadata: {
          charCount: chunkContent.length,
          wordCount: chunkContent.split(/\s+/).length,
        },
      }));

      const { error: chunksError } = await supabase
        .from('rag_chunks')
        .insert(chunkRecords);

      if (chunksError) {
        console.error('[RAG Chunks Create Error]', chunksError);
        // 데이터셋은 생성되었지만 청크 실패 - 비활성화
        await supabase.from('rag_datasets').update({ is_active: false }).eq('id', dataset.id);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '청크 저장 실패' } },
          { status: 500 }
        );
      }

      // 4. 데이터셋 청크 카운트 업데이트
      await supabase
        .from('rag_datasets')
        .update({ chunk_count: chunks.length })
        .eq('id', dataset.id);

      return NextResponse.json(
        {
          success: true,
          data: {
            dataset: { ...dataset, chunk_count: chunks.length },
            chunksCreated: chunks.length,
          },
        },
        { status: 201 }
      );
    } catch (error) {
      console.error('[RAG Create Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// DELETE /api/lms/rag - RAG 데이터셋 삭제
export async function DELETE(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const { datasetId } = body;

      if (!datasetId) {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'datasetId는 필수입니다' } },
          { status: 400 }
        );
      }

      // 매핑된 주차가 있는지 확인
      const { data: mappings } = await supabase
        .from('rag_week_mappings')
        .select('id')
        .eq('rag_dataset_id', datasetId)
        .limit(1);

      if (mappings && mappings.length > 0) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'HAS_MAPPINGS',
              message: '주차에 매핑된 데이터셋은 삭제할 수 없습니다. 먼저 매핑을 해제하세요.',
            },
          },
          { status: 409 }
        );
      }

      // 청크는 CASCADE로 자동 삭제됨
      const { error } = await supabase
        .from('rag_datasets')
        .delete()
        .eq('id', datasetId);

      if (error) {
        console.error('[RAG Delete Error]', error);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '데이터셋 삭제 실패' } },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        data: { deleted: true, datasetId },
      });
    } catch (error) {
      console.error('[RAG Delete Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// 텍스트 청킹 헬퍼 함수
function splitTextIntoChunks(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  const cleanText = text.replace(/\r\n/g, '\n').trim();

  // 문단 단위로 먼저 분리
  const paragraphs = cleanText.split(/\n\n+/);
  let currentChunk = '';

  for (const paragraph of paragraphs) {
    // 현재 청크에 문단 추가 시 크기 초과 여부 확인
    if (currentChunk.length + paragraph.length + 2 > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        // 오버랩 적용: 이전 청크의 마지막 부분 유지
        const overlapText = currentChunk.slice(-overlap);
        currentChunk = overlapText + '\n\n' + paragraph;
      } else {
        // 문단 자체가 청크 크기보다 큰 경우 강제 분할
        let start = 0;
        while (start < paragraph.length) {
          const end = Math.min(start + chunkSize, paragraph.length);
          chunks.push(paragraph.slice(start, end).trim());
          start = end - overlap;
        }
        currentChunk = '';
      }
    } else {
      currentChunk = currentChunk ? currentChunk + '\n\n' + paragraph : paragraph;
    }
  }

  // 마지막 청크 추가
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}
