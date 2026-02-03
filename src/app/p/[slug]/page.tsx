// src/app/p/[slug]/page.tsx
// 공개 랜딩페이지 뷰어
import { notFound } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import PublicPageViewer from '@/components/lp/PublicPageViewer';
import type { Metadata } from 'next';

interface PageProps {
    params: Promise<{ slug: string }>;
}

// 서버 컴포넌트에서 직접 Supabase 호출
async function getPublicPage(slug: string) {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: page, error } = await supabase
        .from('landing_pages')
        .select('id, title, content, slug, created_at, updated_at')
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .single();

    if (error || !page) {
        return null;
    }

    return page;
}

// 동적 메타데이터
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const page = await getPublicPage(slug);

    if (!page) {
        return {
            title: '페이지를 찾을 수 없습니다',
        };
    }

    const content = page.content as { title?: string; description?: string };

    return {
        title: content.title || page.title,
        description: content.description || `${page.title} - Magnetic Sales로 제작됨`,
        openGraph: {
            title: content.title || page.title,
            description: content.description || `${page.title} - Magnetic Sales로 제작됨`,
            type: 'website',
        },
    };
}

export default async function PublicPage({ params }: PageProps) {
    const { slug } = await params;
    const page = await getPublicPage(slug);

    if (!page) {
        notFound();
    }

    return <PublicPageViewer page={page} />;
}
