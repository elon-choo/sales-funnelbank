// src/app/api/ai/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { defendPromptInjection } from '@/lib/ai/promptDefense';
import { reserveTokens, confirmTokenUsage } from '@/lib/ai/tokenManager';
import { estimateTokens } from '@/lib/ai/tokenEstimator';
import { callClaudeAPI } from '@/lib/ai/claude';
import { authenticateRequest } from '@/lib/auth/guards';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge';
export const maxDuration = 90;

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 하드코딩된 어드민 ID (guards.ts와 동일)
const HARDCODED_ADMIN_ID = '00000000-0000-0000-0000-000000000001';

// 히스토리 최대 토큰 (컨텍스트 절반 정도)
const MAX_HISTORY_TOKENS = 50000;

export async function POST(request: NextRequest) {
    try {
        // 1. Auth Check
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { message, sessionId } = await request.json();

        if (!message || typeof message !== 'string') {
            return NextResponse.json({ error: 'Invalid message format' }, { status: 400 });
        }

        // 2. Prompt Injection Defense
        const defense = defendPromptInjection(message);
        if (!defense.isSafe) {
            return NextResponse.json(
                { error: 'Blocked: ' + defense.reason, details: defense.details },
                { status: 400 }
            );
        }

        // 하드코딩된 어드민인 경우 간단한 스트리밍 응답 (DB 저장/토큰 관리 스킵)
        const isHardcodedAdmin = auth.userId === HARDCODED_ADMIN_ID;

        if (isHardcodedAdmin) {
            // 하드코딩 어드민용 간단 스트리밍
            const stream = new ReadableStream({
                async start(controller) {
                    const encoder = new TextEncoder();
                    let responseText = "";

                    try {
                        const claudeStream = await callClaudeAPI([
                            { role: 'user', content: message }
                        ]);

                        // 임시 세션 ID 전송
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ sessionId: 'admin-temp-session' })}\n\n`)
                        );

                        for await (const chunk of claudeStream) {
                            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                                const text = chunk.delta.text;
                                responseText += text;
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                                );
                            }
                        }

                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));

                    } catch (error) {
                        console.error('Admin streaming error:', error);
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI processing failed' })}\n\n`));
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                }
            });
        }

        // 일반 사용자 플로우
        // 3. 세션 처리 (새로 생성 또는 기존 사용)
        let currentSessionId = sessionId;
        let conversationHistory: Anthropic.MessageParam[] = [];

        if (sessionId) {
            // 기존 세션에서 히스토리 로드
            const { data: session } = await supabase
                .from('chat_sessions')
                .select('id, user_id')
                .eq('id', sessionId)
                .eq('user_id', auth.userId)
                .single();

            if (!session) {
                return NextResponse.json({ error: 'Session not found' }, { status: 404 });
            }

            // 이전 메시지 로드 (최신 순으로 가져와서 토큰 제한 내에서 자름)
            const { data: messages } = await supabase
                .from('chat_messages')
                .select('role, content, tokens_used')
                .eq('session_id', sessionId)
                .order('created_at', { ascending: false })
                .limit(50); // 최대 50개 메시지

            if (messages && messages.length > 0) {
                // 토큰 제한 내에서 히스토리 구성 (역순 -> 정순)
                let totalTokens = 0;
                const historyMessages: Anthropic.MessageParam[] = [];

                for (const msg of messages) {
                    totalTokens += msg.tokens_used || estimateTokens(msg.content);
                    if (totalTokens > MAX_HISTORY_TOKENS) break;

                    historyMessages.unshift({
                        role: msg.role as 'user' | 'assistant',
                        content: msg.content
                    });
                }

                conversationHistory = historyMessages;
            }
        } else {
            // 새 세션 생성
            const { data: newSession, error: createError } = await supabase
                .from('chat_sessions')
                .insert({
                    user_id: auth.userId,
                    title: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
                    status: 'active'
                })
                .select()
                .single();

            if (createError || !newSession) {
                console.error('Session create error:', createError);
                return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
            }

            currentSessionId = newSession.id;
        }

        // 4. Token Check & Reservation
        const historyText = conversationHistory.map(m => m.content).join(' ');
        const estimated = estimateTokens(message) + estimateTokens(historyText as string);
        const reservation = await reserveTokens(auth.userId, estimated);

        if (!reservation.success) {
            return NextResponse.json(
                { error: 'Token reservation failed', detail: reservation.error, data: reservation.data },
                { status: 402 }
            );
        }

        const reservationId = reservation.reservationId!;

        // 5. 사용자 메시지 저장
        const userMessageTokens = estimateTokens(message);
        await supabase.from('chat_messages').insert({
            session_id: currentSessionId,
            role: 'user',
            content: message,
            tokens_used: userMessageTokens
        });

        // 6. Stream Response with History
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                let actualTokens = 0;
                let responseText = "";

                try {
                    // 히스토리 + 새 메시지로 API 호출
                    const claudeStream = await callClaudeAPI([
                        ...conversationHistory,
                        { role: 'user', content: message }
                    ]);

                    // 세션 ID 먼저 전송
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`)
                    );

                    for await (const chunk of claudeStream) {
                        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                            const text = chunk.delta.text;
                            responseText += text;

                            controller.enqueue(
                                encoder.encode(`data: ${JSON.stringify({ text })}\n\n`)
                            );
                        }

                        // 스트림 끝에서 usage 정보 추출
                        if (chunk.type === 'message_delta' && chunk.usage) {
                            actualTokens = chunk.usage.output_tokens || 0;
                        }
                    }

                    // 최종 토큰 계산 (휴리스틱 백업)
                    if (actualTokens === 0) {
                        const finalInputTokens = Math.ceil(message.length / 2.5);
                        const finalOutputTokens = Math.ceil(responseText.length / 2.5);
                        actualTokens = finalInputTokens + finalOutputTokens + 200;
                    }

                    // 7. 어시스턴트 응답 저장
                    await supabase.from('chat_messages').insert({
                        session_id: currentSessionId,
                        role: 'assistant',
                        content: responseText,
                        tokens_used: actualTokens
                    });

                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));

                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'AI processing failed' })}\n\n`));
                } finally {
                    await confirmTokenUsage(reservationId, actualTokens);
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });

    } catch (error) {
        console.error('API Handler Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
