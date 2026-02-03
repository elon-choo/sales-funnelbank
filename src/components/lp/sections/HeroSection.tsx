
// src/components/lp/sections/HeroSection.tsx
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function HeroSection({ content, isEditing }: { content: any, isEditing?: boolean }) {
    return (
        <section className="relative py-32 overflow-hidden bg-gray-950 text-white border-b border-white/5">
            {/* Background Gradients */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/40 via-gray-950 to-gray-950 opacity-50" />

            <div className="container relative mx-auto px-4 text-center z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 mb-8 backdrop-blur-sm">
                    <span className="flex h-2 w-2 rounded-full bg-purple-400 animate-pulse"></span>
                    <span className="text-sm font-medium text-purple-200">신규 출시</span>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 tracking-tight leading-[1.1]">
                    {content.title || '비즈니스를 혁신하세요'}
                </h1>

                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                    {content.subtitle || 'AI 기반 플랫폼으로 몇 분 만에 전환율 높은 멋진 랜딩페이지를 만드세요. 코딩 필요 없음.'}
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                    <Button size="lg" className="h-12 px-8 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-base shadow-[0_0_20px_-5px_rgba(147,51,234,0.5)] transition-all hover:scale-105">
                        지금 시작하기 <Icons.arrowRight className="ml-2 w-4 h-4" />
                    </Button>
                    <Button size="lg" variant="outline" className="h-12 px-8 border-white/10 text-white hover:bg-white/5 rounded-full text-base">
                        데모 보기
                    </Button>
                </div>

                {/* Floating UI Elements for visual interest */}
                <div className="absolute top-1/2 -translate-y-1/2 left-10 w-24 h-24 bg-purple-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl" />
            </div>
        </section>
    );
}
