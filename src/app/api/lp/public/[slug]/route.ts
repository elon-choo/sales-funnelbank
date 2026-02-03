// src/app/api/lp/public/[slug]/route.ts
// 공개 랜딩페이지 조회 API (인증 불필요)
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ slug: string }>;
}

// GET /api/lp/public/[slug] - 공개 페이지 조회 (인증 없이)
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { slug } = await params;

        const { data: page, error } = await supabase
            .from('landing_pages')
            .select('id, title, content, status, slug, created_at, updated_at')
            .eq('slug', slug)
            .eq('status', 'published')
            .is('deleted_at', null)
            .single();

        if (error || !page) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: '페이지를 찾을 수 없습니다' } },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { page }
        });

    } catch (error) {
        console.error('Public page fetch error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
