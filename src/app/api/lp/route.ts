// src/app/api/lp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/auth/guards';

// GET /api/lp - 사용자의 랜딩페이지 목록 조회
export async function GET(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status'); // 'draft', 'published', 'archived' or null for all

        const supabase = createAdminClient();

        let query = supabase
            .from('landing_pages')
            .select('id, title, status, slug, published_url, created_at, updated_at', { count: 'exact' })
            .eq('user_id', auth.userId)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (status) {
            query = query.eq('status', status);
        }

        const { data: pages, error, count } = await query;

        if (error) {
            console.error('Pages fetch error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '페이지 조회 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                pages,
                total: count,
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('Pages list error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
