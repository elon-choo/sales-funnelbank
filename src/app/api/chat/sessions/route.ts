// src/app/api/chat/sessions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAccessToken } from '@/lib/auth/tokens';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/chat/sessions - 세션 목록 조회
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const payload = await verifyAccessToken(token);
        if (!payload) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다' } },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = parseInt(searchParams.get('offset') || '0');
        const status = searchParams.get('status') || 'active';

        const { data: sessions, error, count } = await supabase
            .from('chat_sessions')
            .select('*', { count: 'exact' })
            .eq('user_id', payload.sub)
            .eq('status', status)
            .is('deleted_at', null)
            .order('updated_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('Session fetch error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '세션 조회 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                sessions,
                total: count,
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('Session list error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}

// POST /api/chat/sessions - 새 세션 생성
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
                { status: 401 }
            );
        }

        const token = authHeader.substring(7);
        const payload = await verifyAccessToken(token);
        if (!payload) {
            return NextResponse.json(
                { success: false, error: { code: 'INVALID_TOKEN', message: '유효하지 않은 토큰입니다' } },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { title, landing_page_id } = body;

        const { data: session, error } = await supabase
            .from('chat_sessions')
            .insert({
                user_id: payload.sub,
                title: title || '새 대화',
                landing_page_id: landing_page_id || null,
                status: 'active'
            })
            .select()
            .single();

        if (error) {
            console.error('Session create error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '세션 생성 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { session }
        }, { status: 201 });
    } catch (error) {
        console.error('Session create error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
