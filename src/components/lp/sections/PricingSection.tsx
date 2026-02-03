
// src/components/lp/sections/PricingSection.tsx
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function PricingSection({ content }: { content: any }) {
    return (
        <section className="py-24 bg-gray-950 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">심플한 요금제</h2>
                    <p className="text-gray-400">비즈니스 니즈에 맞는 플랜을 선택하세요.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                    {/* Basic Plan */}
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                        <h3 className="text-lg font-medium text-gray-400 mb-2">베이직</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-white">₩29,000</span>
                            <span className="text-gray-500">/월</span>
                        </div>
                        <ul className="space-y-4 mb-8 text-gray-300">
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-500" /> 랜딩페이지 5개</li>
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-500" /> 기본 분석</li>
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-500" /> 24시간 지원</li>
                        </ul>
                        <Button className="w-full bg-white/10 hover:bg-white/20 text-white">시작하기</Button>
                    </div>

                    {/* Pro Plan */}
                    <div className="p-8 rounded-2xl bg-gradient-to-b from-purple-900/20 to-gray-900 border border-purple-500/30 relative transform md:-translate-y-4">
                        <div className="absolute top-0 right-0 p-3">
                            <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">인기</span>
                        </div>
                        <h3 className="text-lg font-medium text-purple-300 mb-2">프로</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-white">₩79,000</span>
                            <span className="text-gray-500">/월</span>
                        </div>
                        <ul className="space-y-4 mb-8 text-gray-200">
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-400" /> 무제한 페이지</li>
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-400" /> 고급 AI 토큰</li>
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-400" /> 커스텀 도메인</li>
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-400" /> 우선 지원</li>
                        </ul>
                        <Button className="w-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/20">시작하기</Button>
                    </div>

                    {/* Enterprise Plan */}
                    <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                        <h3 className="text-lg font-medium text-gray-400 mb-2">엔터프라이즈</h3>
                        <div className="flex items-baseline gap-1 mb-6">
                            <span className="text-4xl font-bold text-white">₩199,000</span>
                            <span className="text-gray-500">/월</span>
                        </div>
                        <ul className="space-y-4 mb-8 text-gray-300">
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-500" /> 프로의 모든 기능</li>
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-500" /> 전담 매니저</li>
                            <li className="flex items-center gap-3"><Icons.check className="w-4 h-4 text-purple-500" /> SSO 및 보안</li>
                        </ul>
                        <Button className="w-full bg-white/10 hover:bg-white/20 text-white">문의하기</Button>
                    </div>
                </div>
            </div>
        </section>
    );
}
