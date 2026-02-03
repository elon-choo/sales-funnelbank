// src/app/api/chat/sessions/[id]/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAccessToken } from '@/lib/auth/tokens';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/chat/sessions/[id]/messages - 메시지 목록 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id: sessionId } = await params;

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

        // 세션 소유권 확인
        const { data: session } = await supabase
            .from('chat_sessions')
            .select('id')
            .eq('id', sessionId)
            .eq('user_id', payload.sub)
            .single();

        if (!session) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' } },
                { status: 404 }
            );
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const before = searchParams.get('before'); // cursor pagination

        let query = supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', sessionId)
            .order('created_at', { ascending: true })
            .limit(limit);

        if (before) {
            query = query.lt('created_at', before);
        }

        const { data: messages, error } = await query;

        if (error) {
            console.error('Messages fetch error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '메시지 조회 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { messages }
        });
    } catch (error) {
        console.error('Messages list error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
