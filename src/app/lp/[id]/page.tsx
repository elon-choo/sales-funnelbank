
// src/app/lp/[id]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import SectionRenderer from '@/components/lp/SectionRenderer';

export default async function PublicLandingPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = await createClient();

    const { data: page, error } = await supabase
        .from('landing_pages')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !page) {
        notFound();
    }

    const content = page.content as any;
    const sections = content.sections || [];

    return (
        <div className={`min-h-screen font-sans bg-black text-white theme-${content.theme || 'modern'}`}>
            <main>
                {sections.map((section: any) => (
                    <SectionRenderer key={section.id} section={section} isEditing={false} />
                ))}
            </main>
        </div>
    );
}
