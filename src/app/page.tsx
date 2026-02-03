// src/app/page.tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

export default function HomePage() {
    return (
        <div className="relative min-h-screen bg-deep-space overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-mesh-gradient opacity-60" />

            {/* Floating Orbs */}
            <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-purple-600/30 rounded-full blur-3xl animate-float-slow" />
            <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-brand-pink-500/20 rounded-full blur-3xl animate-float-delayed" />
            <div className="absolute top-1/2 right-10 w-48 h-48 bg-brand-cyan-500/20 rounded-full blur-2xl animate-pulse-slow" />

            {/* Grid Pattern Overlay */}
            <div className="absolute inset-0 bg-[url('/grid.svg')] bg-repeat opacity-5" />

            {/* Navigation */}
            <nav className="relative z-20 flex items-center justify-between px-6 py-4 md:px-12">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-purple-600 to-brand-pink-500 flex items-center justify-center">
                        <Icons.sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xl font-bold text-white">Magnetic Sales</span>
                </div>
                <div className="hidden md:flex items-center gap-8">
                    <Link href="#features" className="text-gray-400 hover:text-white transition-colors">기능</Link>
                    <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">요금제</Link>
                    <Link href="/login" className="text-gray-400 hover:text-white transition-colors">로그인</Link>
                    <Link href="/signup">
                        <Button variant="premium" size="sm">무료 시작</Button>
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 text-center">
                {/* Badge */}
                <div className="relative inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-gradient-to-r from-brand-purple-500/10 to-brand-pink-500/10 border border-brand-purple-500/30 backdrop-blur-sm animate-fade-in-down">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer rounded-full overflow-hidden" />
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-purple-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-purple-500"></span>
                    </span>
                    <span className="text-sm text-gray-300">AI 기반 랜딩페이지 빌더</span>
                </div>

                {/* Headline */}
                <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-white mb-6 animate-fade-in-up">
                    <span className="block">마법처럼 전환되는</span>
                    <span className="bg-gradient-to-r from-brand-purple-400 via-brand-pink-400 to-brand-cyan-400 bg-clip-text text-transparent">
                        페이지를 만드세요
                    </span>
                </h1>

                {/* Subheadline */}
                <p className="text-xl md:text-2xl text-gray-400 max-w-2xl mb-10 font-light leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                    AI가 당신의 세일즈 페이지를 자동으로 생성합니다.
                    <br className="hidden md:block" />
                    전환율 340% 향상, 제작 시간 90% 단축.
                </p>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                    <Link href="/signup">
                        <Button variant="magnetic" size="xl" className="group">
                            무료로 시작하기
                            <Icons.arrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                    <Link href="#demo">
                        <Button variant="outline" size="xl">
                            <Icons.play className="w-5 h-5" />
                            데모 보기
                        </Button>
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-8 md:gap-16 animate-fade-in-up" style={{ animationDelay: '0.6s' }}>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-white mb-1">50,000+</div>
                        <div className="text-sm text-gray-500">페이지 생성됨</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-brand-purple-400 mb-1">340%</div>
                        <div className="text-sm text-gray-500">평균 전환율 향상</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-brand-pink-400 mb-1">4.9/5</div>
                        <div className="text-sm text-gray-500">고객 만족도</div>
                    </div>
                </div>
            </section>

            {/* Floating Cards */}
            <div className="absolute top-1/3 left-10 hidden lg:block animate-float-slow">
                <div className="glass-card p-4 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                            <Icons.check className="w-4 h-4 text-green-400" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">전환율 +340%</div>
                            <div className="text-xs text-gray-500">이번 달 성과</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="absolute top-1/2 right-10 hidden lg:block animate-float-delayed">
                <div className="glass-card p-4 rounded-xl border border-white/10 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-purple-500/20 flex items-center justify-center">
                            <Icons.sparkles className="w-4 h-4 text-brand-purple-400" />
                        </div>
                        <div>
                            <div className="text-sm font-medium text-white">AI 생성 완료</div>
                            <div className="text-xs text-gray-500">방금 전</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <section id="features" className="relative z-10 py-24 px-6">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                            왜 Magnetic Sales인가?
                        </h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            AI가 당신의 비즈니스를 이해하고, 최적화된 세일즈 페이지를 자동으로 생성합니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="group glass-card p-8 rounded-2xl border border-white/10 hover:border-brand-purple-500/50 transition-all duration-300 hover:scale-105">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-purple-500/20 to-brand-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Icons.sparkles className="w-7 h-7 text-brand-purple-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">AI 자동 생성</h3>
                            <p className="text-gray-400 leading-relaxed">
                                몇 가지 질문에 답하면 AI가 완벽한 랜딩페이지를 자동으로 생성합니다.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="group glass-card p-8 rounded-2xl border border-white/10 hover:border-brand-purple-500/50 transition-all duration-300 hover:scale-105">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-purple-500/20 to-brand-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Icons.layout className="w-7 h-7 text-brand-pink-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">검증된 템플릿</h3>
                            <p className="text-gray-400 leading-relaxed">
                                수천 개의 성공 사례에서 학습한 전환율 최적화 템플릿을 제공합니다.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="group glass-card p-8 rounded-2xl border border-white/10 hover:border-brand-purple-500/50 transition-all duration-300 hover:scale-105">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-brand-purple-500/20 to-brand-pink-500/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                <Icons.zap className="w-7 h-7 text-brand-cyan-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-3">실시간 최적화</h3>
                            <p className="text-gray-400 leading-relaxed">
                                A/B 테스트와 AI 분석으로 지속적으로 전환율을 개선합니다.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="relative z-10 py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <div className="glass-card p-12 md:p-16 rounded-3xl border border-white/10 relative overflow-hidden">
                        {/* Glow effect */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-brand-purple-500 to-transparent" />

                        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                            지금 바로 시작하세요
                        </h2>
                        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                            무료로 첫 번째 랜딩페이지를 만들어보세요.
                            신용카드 없이 시작할 수 있습니다.
                        </p>
                        <Link href="/signup">
                            <Button variant="magnetic" size="xl" className="group">
                                무료로 시작하기
                                <Icons.arrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="relative z-10 border-t border-white/5 py-12 px-6">
                <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-purple-600 to-brand-pink-500 flex items-center justify-center">
                            <Icons.sparkles className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-sm text-gray-500">Magnetic Sales Inc.</span>
                    </div>
                    <div className="text-sm text-gray-600">
                        &copy; 2024 Magnetic Sales. 모든 권리 보유.
                    </div>
                </div>
            </footer>
        </div>
    );
}
