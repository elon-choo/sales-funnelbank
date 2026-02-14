// src/app/api/lms/admin/costs/route.ts
// AI 비용 모니터링 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (_auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d';

    try {
      let dateFilter = '';
      if (period === '7d') {
        dateFilter = new Date(Date.now() - 7 * 86400000).toISOString();
      } else if (period === '30d') {
        dateFilter = new Date(Date.now() - 30 * 86400000).toISOString();
      }

      // Get all feedbacks with costs
      let query = supabase
        .from('feedbacks')
        .select(`
          id, cost_usd, ai_model, tokens_input, tokens_output, created_at,
          assignments!inner (
            week_id,
            course_weeks (week_number, title)
          )
        `)
        .not('tokens_input', 'is', null)
        .order('created_at', { ascending: false });

      if (dateFilter) {
        query = query.gte('created_at', dateFilter);
      }

      const { data: feedbacks, error } = await query;
      if (error) throw error;

      const items = feedbacks || [];

      // Calculate totals
      const totalCost = items.reduce((s, f) => s + (Number(f.cost_usd) || 0), 0);
      const totalTokensIn = items.reduce((s, f) => s + (f.tokens_input || 0), 0);
      const totalTokensOut = items.reduce((s, f) => s + (f.tokens_output || 0), 0);
      const avgCostPerFeedback = items.length > 0 ? totalCost / items.length : 0;

      // Daily costs
      const dailyMap = new Map<string, { cost: number; count: number }>();
      for (const f of items) {
        const date = new Date(f.created_at).toISOString().slice(0, 10);
        const existing = dailyMap.get(date) || { cost: 0, count: 0 };
        existing.cost += Number(f.cost_usd) || 0;
        existing.count++;
        dailyMap.set(date, existing);
      }
      const dailyCosts = Array.from(dailyMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // By model
      const byModel: Record<string, { count: number; cost: number; tokensIn: number; tokensOut: number }> = {};
      for (const f of items) {
        const model = f.ai_model || 'unknown';
        if (!byModel[model]) byModel[model] = { count: 0, cost: 0, tokensIn: 0, tokensOut: 0 };
        byModel[model].count++;
        byModel[model].cost += Number(f.cost_usd) || 0;
        byModel[model].tokensIn += f.tokens_input || 0;
        byModel[model].tokensOut += f.tokens_output || 0;
      }

      // By week
      const weekMap = new Map<number, { title: string; count: number; cost: number }>();
      for (const f of items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const assignment = f.assignments as any;
        const week = Array.isArray(assignment) ? assignment[0] : assignment;
        const cw = week?.course_weeks;
        const weekInfo = Array.isArray(cw) ? cw[0] : cw;
        const weekNum = weekInfo?.week_number || 0;
        const title = weekInfo?.title || '';
        const existing = weekMap.get(weekNum) || { title, count: 0, cost: 0 };
        existing.count++;
        existing.cost += Number(f.cost_usd) || 0;
        weekMap.set(weekNum, existing);
      }
      const byWeek = Array.from(weekMap.entries())
        .map(([weekNumber, stats]) => ({ weekNumber, ...stats }))
        .sort((a, b) => a.weekNumber - b.weekNumber);

      return NextResponse.json({
        success: true,
        data: {
          totalCost,
          totalFeedbacks: items.length,
          totalTokensIn,
          totalTokensOut,
          avgCostPerFeedback,
          dailyCosts,
          byModel,
          byWeek,
        },
      });
    } catch (error) {
      console.error('[Costs API Error]', error);
      return NextResponse.json(
        { success: false, error: { message: '비용 데이터 조회 실패' } },
        { status: 500 }
      );
    }
  });
}
