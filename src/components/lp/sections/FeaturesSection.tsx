
// src/components/lp/sections/FeaturesSection.tsx
import { Icons } from '@/components/icons';

const DEFAULT_FEATURES = [
    { title: 'AI 기반', desc: '고급 AI 모델로 콘텐츠를 즉시 생성하세요.', icon: 'sparkles' },
    { title: '반응형', desc: '모바일이든 데스크톱이든 모든 기기에서 멋지게 보입니다.', icon: 'smartphone' },
    { title: '분석', desc: '방문자와 전환율을 실시간으로 추적하세요.', icon: 'chart' },
];

export default function FeaturesSection({ content }: { content: any }) {
    const features = content.items || DEFAULT_FEATURES;

    return (
        <section className="py-24 bg-black text-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16 space-y-4">
                    <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500">
                        {content.title || '강력한 기능'}
                    </h2>
                    <p className="text-gray-400 max-w-2xl mx-auto">
                        {content.subtitle || '완벽한 랜딩페이지를 만들기 위해 필요한 모든 것.'}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {features.map((item: any, i: number) => (
                        <div key={i} className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/30 hover:bg-white/10 transition-all duration-300">
                            <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                {item.icon === 'chart' ? <Icons.chart className="w-6 h-6 text-purple-400" /> :
                                    item.icon === 'smartphone' ? <Icons.smartphone className="w-6 h-6 text-purple-400" /> :
                                        <Icons.sparkles className="w-6 h-6 text-purple-400" />}
                            </div>
                            <h3 className="text-xl font-bold mb-3 text-white group-hover:text-purple-300 transition-colors">{item.title}</h3>
                            <p className="text-gray-400 leading-relaxed">
                                {item.desc}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
