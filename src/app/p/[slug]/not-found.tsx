// src/app/p/[slug]/not-found.tsx
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
            <h1 className="text-6xl font-bold text-purple-500 mb-4">404</h1>
            <h2 className="text-2xl font-semibold mb-2">페이지를 찾을 수 없습니다</h2>
            <p className="text-gray-400 mb-8">
                요청하신 페이지가 존재하지 않거나 비공개 상태입니다.
            </p>
            <Link
                href="/"
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
            >
                홈으로 돌아가기
            </Link>
        </div>
    );
}
