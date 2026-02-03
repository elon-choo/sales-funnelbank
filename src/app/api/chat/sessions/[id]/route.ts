// src/app/api/chat/sessions/[id]/route.ts
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

// GET /api/chat/sessions/[id] - 세션 상세 조회 (메시지 포함)
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

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

        // 세션 조회
        const { data: session, error: sessionError } = await supabase
            .from('chat_sessions')
            .select('*')
            .eq('id', id)
            .eq('user_id', payload.sub)
            .is('deleted_at', null)
            .single();

        if (sessionError || !session) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: '세션을 찾을 수 없습니다' } },
                { status: 404 }
            );
        }

        // 메시지 조회
        const { data: messages, error: messagesError } = await supabase
            .from('chat_messages')
            .select('*')
            .eq('session_id', id)
            .order('created_at', { ascending: true });

        if (messagesError) {
            console.error('Messages fetch error:', messagesError);
        }

        return NextResponse.json({
            success: true,
            data: {
                session,
                messages: messages || []
            }
        });
    } catch (error) {
        console.error('Session fetch error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}

// PATCH /api/chat/sessions/[id] - 세션 수정
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

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
        const { title, status } = body;

        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (title !== undefined) updateData.title = title;
        if (status !== undefined) updateData.status = status;

        const { data: session, error } = await supabase
            .from('chat_sessions')
            .update(updateData)
            .eq('id', id)
            .eq('user_id', payload.sub)
            .select()
            .single();

        if (error) {
            console.error('Session update error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '세션 수정 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { session }
        });
    } catch (error) {
        console.error('Session update error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}

// DELETE /api/chat/sessions/[id] - 세션 삭제 (soft delete)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;

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

        const { error } = await supabase
            .from('chat_sessions')
            .update({
                status: 'deleted',
                deleted_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', payload.sub);

        if (error) {
            console.error('Session delete error:', error);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '세션 삭제 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { message: '세션이 삭제되었습니다' }
        });
    } catch (error) {
        console.error('Session delete error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
