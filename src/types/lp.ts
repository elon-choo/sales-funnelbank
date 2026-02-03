
// src/types/lp.ts

export type SectionType = 'hero' | 'features' | 'benefits' | 'pricing' | 'cta' | 'testimonials' | 'faq' | 'footer' | 'header';

export interface SectionContent {
    title?: string;
    subtitle?: string;
    description?: string;
    image?: string;
    items?: any[];
    [key: string]: any;
}

export interface Section {
    id: string;
    type: SectionType;
    content: SectionContent;
    isVisible: boolean;
    order: number;
}

export interface LandingPage {
    id?: string; // Optional for new pages
    title: string;
    slug: string;
    theme: 'modern' | 'minimal' | 'playful' | 'luxury'; // Custom themes
    sections: Section[];
    createdAt?: string;
    updatedAt?: string;
    isPublished: boolean;
    publishedAt?: string;
}

// Initial state for a new page
export const DEFAULT_LANDING_PAGE: LandingPage = {
    title: 'Untitled Page',
    slug: '',
    theme: 'modern',
    sections: [],
    isPublished: false,
};
