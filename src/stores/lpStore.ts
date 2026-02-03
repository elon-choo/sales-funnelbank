
// src/stores/lpStore.ts

import { create } from 'zustand';
import { LandingPage, Section, SectionType } from '@/types/lp';

const generateId = () => Math.random().toString(36).substring(2, 15);

const DEFAULT_CONTENT: Record<SectionType, any> = {
    hero: {
        title: 'Transform Your Business with AI',
        subtitle: 'Generate high-converting landing pages in seconds. No coding required.',
        ctaText: 'Get Started Free'
    },
    features: {
        title: 'Everything you need',
        subtitle: 'Powerful features to help you grow.',
        items: [
            { title: 'AI Generation', desc: 'Create content instantly.', icon: 'sparkles' },
            { title: 'Analytics', desc: 'Track your success.', icon: 'chart' },
            { title: 'Mobile Ready', desc: 'Looks great everywhere.', icon: 'smartphone' }
        ]
    },
    pricing: {
        title: 'Simple Pricing',
        subtitle: 'Start free, upgrade as you grow.'
    },
    cta: {
        title: 'Ready to dive in?',
        subtitle: 'Join thousands of happy customers today.',
        buttonText: 'Start Now'
    },
    benefits: {},
    testimonials: {},
    faq: {},
    footer: {},
    header: {}
};

interface LpState {
    page: LandingPage;
    isLoading: boolean;
    isSaving: boolean;

    // Actions
    setPage: (page: LandingPage) => void;
    updateTitle: (title: string) => void;
    addSection: (type: SectionType) => void;
    removeSection: (id: string) => void;
    updateSection: (id: string, content: any) => void;
    moveSection: (id: string, direction: 'up' | 'down') => void;
    reset: () => void;
}

const INITIAL_PAGE: LandingPage = {
    title: 'My First Landing Page',
    slug: '',
    theme: 'modern',
    isPublished: false,
    sections: [
        { id: 'demo-hero', type: 'hero', content: DEFAULT_CONTENT.hero, isVisible: true, order: 0 },
        { id: 'demo-features', type: 'features', content: DEFAULT_CONTENT.features, isVisible: true, order: 1 },
        { id: 'demo-pricing', type: 'pricing', content: DEFAULT_CONTENT.pricing, isVisible: true, order: 2 },
        { id: 'demo-cta', type: 'cta', content: DEFAULT_CONTENT.cta, isVisible: true, order: 3 },
    ]
};

export const useLpStore = create<LpState>((set) => ({
    page: INITIAL_PAGE,
    isLoading: false,
    isSaving: false,

    setPage: (page) => set({ page }),

    updateTitle: (title) => set((state) => ({ page: { ...state.page, title } })),

    addSection: (type) => set((state) => {
        const newSection: Section = {
            id: generateId(),
            type,
            content: DEFAULT_CONTENT[type] || {},
            isVisible: true,
            order: state.page.sections.length,
        };
        return { page: { ...state.page, sections: [...state.page.sections, newSection] } };
    }),

    removeSection: (id) => set((state) => ({
        page: {
            ...state.page,
            sections: state.page.sections.filter((s) => s.id !== id)
        }
    })),

    updateSection: (id, content) => set((state) => ({
        page: {
            ...state.page,
            sections: state.page.sections.map((s) =>
                s.id === id ? { ...s, content: { ...s.content, ...content } } : s
            )
        }
    })),

    moveSection: (id, direction) => set((state) => {
        const sections = [...state.page.sections];
        const index = sections.findIndex((s) => s.id === id);
        if (index === -1) return {};

        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= sections.length) return {};

        // Swap
        [sections[index], sections[newIndex]] = [sections[newIndex], sections[index]];

        // Reassign order
        const orderedSections = sections.map((s, i) => ({ ...s, order: i }));

        return { page: { ...state.page, sections: orderedSections } };
    }),

    reset: () => set({ page: INITIAL_PAGE })
}));
