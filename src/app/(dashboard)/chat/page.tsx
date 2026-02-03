// src/app/(dashboard)/chat/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

export default function ChatPage() {
    const { accessToken, user } = useAuthStore();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Auto scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Auto resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        }
    }, [input]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading || !accessToken) return;

        const userMessage: Message = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input.trim(),
            timestamp: new Date(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);

        // Create placeholder for assistant response
        const assistantId = `assistant-${Date.now()}`;
        setMessages(prev => [...prev, {
            id: assistantId,
            role: 'assistant',
            content: '',
            timestamp: new Date(),
        }]);

        try {
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    sessionId: sessionId,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to send message');
            }

            // Handle SSE stream
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            if (!reader) {
                throw new Error('No response body');
            }

            let accumulatedContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6));

                            if (data.sessionId && !sessionId) {
                                setSessionId(data.sessionId);
                            }

                            if (data.text) {
                                accumulatedContent += data.text;
                                setMessages(prev => prev.map(msg =>
                                    msg.id === assistantId
                                        ? { ...msg, content: accumulatedContent }
                                        : msg
                                ));
                            }

                            if (data.error) {
                                throw new Error(data.error);
                            }
                        } catch (parseError) {
                            // Skip invalid JSON lines
                        }
                    }
                }
            }

        } catch (err) {
            console.error('Chat error:', err);
            setError(err instanceof Error ? err.message : 'Failed to send message');
            // Remove empty assistant message on error
            setMessages(prev => prev.filter(msg => msg.id !== assistantId || msg.content));
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    const startNewChat = () => {
        setMessages([]);
        setSessionId(null);
        setError(null);
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                        <Icons.message className="w-5 h-5 text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-lg font-semibold text-white">AI 채팅</h1>
                        <p className="text-xs text-gray-400">세일즈 카피 생성 도우미</p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={startNewChat}
                    className="gap-2 border-white/10 text-gray-300 hover:bg-white/5"
                >
                    <Icons.plus className="w-4 h-4" />
                    새 대화
                </Button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                        <div className="p-4 bg-purple-500/10 rounded-full mb-4">
                            <Icons.sparkles className="w-8 h-8 text-purple-400" />
                        </div>
                        <h2 className="text-xl font-semibold text-white mb-2">무엇을 도와드릴까요?</h2>
                        <p className="text-gray-400 mb-6 max-w-md">
                            고전환 세일즈 카피, 랜딩페이지 구조, 마케팅 전략에 대해 물어보세요.
                        </p>
                        <div className="grid gap-2 w-full max-w-md">
                            {[
                                '헬스케어 제품 세일즈 카피 작성해줘',
                                '온라인 강의 런칭 랜딩페이지 구조 추천해줘',
                                '고전환 CTA 문구 5개 만들어줘',
                            ].map((suggestion, index) => (
                                <button
                                    key={index}
                                    onClick={() => setInput(suggestion)}
                                    className="text-left p-3 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm transition-colors border border-white/10"
                                >
                                    {suggestion}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    messages.map((message) => (
                        <div
                            key={message.id}
                            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                                    message.role === 'user'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-white/5 text-gray-200 border border-white/10'
                                }`}
                            >
                                {message.role === 'assistant' && message.content === '' && isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-purple-400"></div>
                                        <span className="text-gray-400">생각 중...</span>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap">{message.content}</div>
                                )}
                            </div>
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Error Display */}
            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
                    <p className="text-red-400 text-sm flex items-center gap-2">
                        <Icons.alert className="w-4 h-4" />
                        {error}
                    </p>
                </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-white/10">
                <form onSubmit={handleSubmit} className="flex gap-3">
                    <div className="flex-1 relative">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
                            className="w-full resize-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent min-h-[48px] max-h-[200px]"
                            rows={1}
                            disabled={isLoading}
                        />
                    </div>
                    <Button
                        type="submit"
                        disabled={!input.trim() || isLoading || !accessToken}
                        className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed h-auto px-4"
                    >
                        {isLoading ? (
                            <Icons.spinner className="w-5 h-5 animate-spin" />
                        ) : (
                            <Icons.arrowRight className="w-5 h-5" />
                        )}
                    </Button>
                </form>
                <p className="text-xs text-gray-500 mt-2 text-center">
                    AI가 생성한 내용은 참고용입니다. 중요한 결정 전에 검토하세요.
                </p>
            </div>
        </div>
    );
}
