// src/app/api/lms/admin/rag-stats/route.ts
// RAG 통계 API - pgvector 카테고리별 통계 + 주차 매핑 현황
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (_auth, supabase) => {
    try {
      // 1. pgvector 카테고리별 통계
      const { data: catStats } = await supabase
        .from('seperma_5th_feedback_rag')
        .select('category, type');

      const categoryMap = new Map<string, { category: string; type: string; count: number }>();
      catStats?.forEach(row => {
        const key = `${row.category}|${row.type}`;
        const existing = categoryMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          categoryMap.set(key, { category: row.category, type: row.type || 'reference', count: 1 });
        }
      });
      const pgvectorCategories = [...categoryMap.values()].sort((a, b) => b.count - a.count);

      // 2. 주차별 매핑 현황
      const { data: mappings } = await supabase
        .from('rag_week_mappings')
        .select('week_id, rag_dataset_id, course_weeks(week_number, title)');

      const weekMap = new Map<string, { weekId: string; weekNumber: number; weekTitle: string; datasetCount: number }>();
      mappings?.forEach(m => {
        const weekInfo = m.course_weeks as unknown as { week_number: number; title: string } | null;
        const existing = weekMap.get(m.week_id);
        if (existing) {
          existing.datasetCount++;
        } else {
          weekMap.set(m.week_id, {
            weekId: m.week_id,
            weekNumber: weekInfo?.week_number || 0,
            weekTitle: weekInfo?.title || '',
            datasetCount: 1,
          });
        }
      });
      const weekMappings = [...weekMap.values()].sort((a, b) => a.weekNumber - b.weekNumber);

      // 3. 총 통계
      const totalEntries = catStats?.length || 0;
      const totalCategories = new Set(catStats?.map(r => r.category)).size;

      // 4. 주차별 pgvector entries (w1_, w2_, w3_, w4_ prefix)
      const weekPrefixStats: Record<string, number> = {};
      catStats?.forEach(row => {
        // id 기반이 아니라 metadata에서 week를 확인해야 하지만 여기선 category prefix로 추정
      });

      return NextResponse.json({
        success: true,
        data: {
          pgvectorCategories,
          weekMappings,
          totalEntries,
          totalCategories,
        },
      });
    } catch (error) {
      console.error('[RAG Stats Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
