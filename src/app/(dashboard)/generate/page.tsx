
// src/app/(dashboard)/generate/page.tsx
import ChatInterface from '@/components/ai/ChatInterface';

export default function GeneratePage() {
    return (
        <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4 space-y-8">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                    새 프로젝트 만들기
                </h1>
                <p className="text-gray-400 max-w-md mx-auto">
                    AI와 대화하며 당신만의 완벽한 랜딩페이지를 기획해보세요.
                </p>
            </div>

            <ChatInterface />
        </div>
    );
}
