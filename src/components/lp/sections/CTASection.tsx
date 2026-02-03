
// src/components/lp/sections/CTASection.tsx
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function CTASection({ content }: { content: any }) {
    return (
        <section className="py-32 relative overflow-hidden">
            <div className="absolute inset-0 bg-purple-900/20"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black via-gray-950 to-gray-900"></div>

            <div className="container mx-auto px-4 relative z-10 text-center">
                <h2 className="text-4xl md:text-6xl font-bold text-white mb-8 tracking-tight">
                    {content.title || '비즈니스 성장 준비되셨나요?'}
                </h2>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-12">
                    세일즈 프로세스를 혁신한 수천 명의 만족한 고객과 함께하세요.
                </p>

                <div className="flex flex-col sm:flex-row justify-center gap-6">
                    <Button size="lg" className="h-14 px-10 text-lg rounded-full bg-white text-black hover:bg-gray-200 font-bold">
                        무료 체험 시작
                    </Button>
                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg rounded-full border-white/20 text-white hover:bg-white/10">
                        문의하기
                    </Button>
                </div>
            </div>
        </section>
    );
}
