// src/components/lp/PublicPageViewer.tsx
'use client';

import SectionRenderer from '@/components/lp/SectionRenderer';

interface Section {
    id: string;
    type: string;
    content: Record<string, unknown>;
}

interface PageContent {
    title: string;
    theme?: string;
    sections: Section[];
}

interface Page {
    id: string;
    title: string;
    content: PageContent;
    slug: string;
}

interface PublicPageViewerProps {
    page: Page;
}

export default function PublicPageViewer({ page }: PublicPageViewerProps) {
    const content = page.content;
    const sections = content.sections || [];

    return (
        <div className="min-h-screen bg-black text-white">
            {/* Page Content */}
            {sections.length === 0 ? (
                <div className="flex items-center justify-center min-h-screen text-gray-500">
                    <p>이 페이지에 콘텐츠가 없습니다.</p>
                </div>
            ) : (
                <div className="flex flex-col">
                    {sections.map((section) => (
                        <SectionRenderer
                            key={section.id}
                            section={section}
                            isEditing={false}
                        />
                    ))}
                </div>
            )}

            {/* Footer - Powered by */}
            <footer className="bg-gray-950 py-6 text-center border-t border-gray-800">
                <p className="text-gray-500 text-sm">
                    Powered by{' '}
                    <a
                        href="/"
                        className="text-purple-400 hover:text-purple-300 transition-colors"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Magnetic Sales
                    </a>
                </p>
            </footer>
        </div>
    );
}
