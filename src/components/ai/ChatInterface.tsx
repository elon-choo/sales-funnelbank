
// src/components/ai/ChatInterface.tsx
'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Markdown } from '@/components/ui/markdown';
import { useAuthStore } from '@/stores/authStore';

interface Message {
    id?: string;
    role: 'user' | 'assistant';
    content: string;
    error?: boolean;
    created_at?: string;
}

interface ChatSession {
    id: string;
    title: string;
    status: string;
    message_count: number;
    updated_at: string;
    created_at: string;
}

export default function ChatInterface() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [showSidebar, setShowSidebar] = useState(false);
    const [isLoadingSessions, setIsLoadingSessions] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const { accessToken } = useAuthStore();

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 세션 목록 로드
    const loadSessions = useCallback(async () => {
        if (!accessToken) return;

        setIsLoadingSessions(true);
        try {
            const response = await fetch('/api/chat/sessions?limit=20', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setSessions(data.data.sessions || []);
                }
            }
        } catch (error) {
            console.error('세션 목록 로드 오류:', error);
        } finally {
            setIsLoadingSessions(false);
        }
    }, [accessToken]);

    // 컴포넌트 마운트 시 세션 목록 로드
    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    // 특정 세션의 메시지 로드
    const loadSessionMessages = async (sessionId: string) => {
        if (!accessToken) return;

        try {
            const response = await fetch(`/api/chat/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    const loadedMessages: Message[] = (data.data.messages || []).map((msg: {
                        id: string;
                        role: 'user' | 'assistant';
                        content: string;
                        created_at: string;
                    }) => ({
                        id: msg.id,
                        role: msg.role,
                        content: msg.content,
                        created_at: msg.created_at,
                    }));
                    setMessages(loadedMessages);
                    setCurrentSessionId(sessionId);
                    setShowSidebar(false);
                }
            }
        } catch (error) {
            console.error('메시지 로드 오류:', error);
        }
    };

    // 새 대화 시작
    const startNewChat = () => {
        setCurrentSessionId(null);
        setMessages([]);
        setShowSidebar(false);
    };

    // 세션 삭제
    const deleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!accessToken) return;

        try {
            const response = await fetch(`/api/chat/sessions/${sessionId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
                if (currentSessionId === sessionId) {
                    startNewChat();
                }
            }
        } catch (error) {
            console.error('세션 삭제 오류:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isStreaming || !accessToken) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsStreaming(true);

        // Initial assistant empty message (placeholder for streaming)
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    message: userMessage,
                    sessionId: currentSessionId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || response.statusText);
            }

            if (!response.body) throw new Error('No response body');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let assistantMessage = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            // 세션 ID 수신 (새 세션 생성 시)
                            if (data.sessionId && !currentSessionId) {
                                setCurrentSessionId(data.sessionId);
                                // 세션 목록 새로고침
                                loadSessions();
                            }

                            if (data.text) {
                                assistantMessage += data.text;
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastMsg = newMessages[newMessages.length - 1];
                                    if (lastMsg.role === 'assistant') {
                                        lastMsg.content = assistantMessage;
                                    }
                                    return newMessages;
                                });
                            }

                            if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (jsonError) {
                            // JSON 파싱 오류는 무시 (불완전한 청크일 수 있음)
                            if (!(jsonError instanceof SyntaxError)) {
                                console.error('스트림 처리 오류:', jsonError);
                            }
                        }
                    }
                }
            }

        } catch (error) {
            console.error('Chat Error:', error);
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMsg = newMessages[newMessages.length - 1];
                // If the last message was the streaming assistant placeholder, update it to error
                if (lastMsg.role === 'assistant') {
                    lastMsg.content = error instanceof Error ? `오류: ${error.message}` : '알 수 없는 오류가 발생했습니다.';
                    lastMsg.error = true;
                } else {
                    // Otherwise push a new error message
                    newMessages.push({
                        role: 'assistant',
                        content: error instanceof Error ? `오류: ${error.message}` : '알 수 없는 오류가 발생했습니다.',
                        error: true
                    });
                }
                return newMessages;
            });
        } finally {
            setIsStreaming(false);
        }
    };

    // 날짜 포맷팅
    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return date.toLocaleDateString('ko-KR');
    };

    return (
        <div className="flex h-[600px] w-full max-w-4xl mx-auto glass-card rounded-2xl overflow-hidden border border-white/10">
            {/* Sidebar */}
            <div
                className={`${showSidebar ? 'w-64' : 'w-0'
                    } transition-all duration-300 overflow-hidden border-r border-white/10 bg-black/20 flex flex-col`}
            >
                <div className="p-3 border-b border-white/10">
                    <Button
                        onClick={startNewChat}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-sm"
                        size="sm"
                    >
                        <Icons.plus className="w-4 h-4 mr-2" />
                        새 대화
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {isLoadingSessions ? (
                        <div className="flex items-center justify-center p-4">
                            <Icons.spinner className="w-5 h-5 animate-spin text-gray-400" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 text-sm">
                            대화 기록이 없습니다
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => loadSessionMessages(session.id)}
                                className={`p-3 cursor-pointer hover:bg-white/5 border-b border-white/5 group ${currentSessionId === session.id ? 'bg-white/10' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm text-white truncate">
                                            {session.title}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {formatDate(session.updated_at)}
                                        </p>
                                    </div>
                                    <button
                                        onClick={(e) => deleteSession(session.id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded transition-opacity"
                                    >
                                        <Icons.x className="w-3 h-3 text-gray-400 hover:text-red-400" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                        >
                            <Icons.menu className="w-5 h-5 text-gray-400" />
                        </button>
                        <Icons.sparkles className="w-5 h-5 text-purple-400" />
                        <h3 className="font-semibold text-white">AI 프로젝트 설계자</h3>
                        {currentSessionId && (
                            <span className="text-xs text-gray-500 ml-2">
                                (대화 진행 중)
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-gray-400">
                        {isStreaming ? '생각 중...' : '준비됨'}
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-2">
                            <Icons.sparkles className="w-8 h-8 opacity-50 mb-2" />
                            <p>무엇을 만들고 싶으신가요?</p>
                            <p className="text-xs">&quot;마케팅 대행사 랜딩페이지를 만들어줘&quot;라고 물어보세요.</p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={msg.id || i}
                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user'
                                        ? 'bg-purple-600/80 text-white rounded-br-none'
                                        : msg.error
                                            ? 'bg-red-500/20 border border-red-500/30 text-red-200'
                                            : 'bg-white/10 text-gray-100 rounded-bl-none border border-white/5'
                                    }`}
                            >
                                {msg.role === 'assistant' && !msg.error && (
                                    <Markdown content={msg.content} />
                                )}
                                {msg.role === 'user' && <span className="whitespace-pre-wrap">{msg.content}</span>}
                                {msg.error && (
                                    <div className="flex items-center gap-2">
                                        <Icons.alert className="w-4 h-4 shrink-0" />
                                        <span>{msg.content}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <form onSubmit={handleSubmit} className="p-4 border-t border-white/10 bg-white/5 flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="프로젝트에 대해 설명해주세요..."
                        disabled={isStreaming}
                        className="bg-neutral-900/50 border-white/10 focus:ring-purple-500/20"
                    />
                    <Button
                        type="submit"
                        disabled={isStreaming || !input.trim()}
                        size="icon"
                        className="bg-purple-600 hover:bg-purple-500 shrink-0"
                    >
                        {isStreaming ? (
                            <Icons.spinner className="w-4 h-4 animate-spin" />
                        ) : (
                            <Icons.arrowRight className="w-4 h-4" />
                        )}
                    </Button>
                </form>
            </div>
        </div>
    );
}
