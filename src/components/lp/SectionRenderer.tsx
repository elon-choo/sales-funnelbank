
// src/components/lp/SectionRenderer.tsx
import HeroSection from '@/components/lp/sections/HeroSection';
import FeaturesSection from '@/components/lp/sections/FeaturesSection';
import PricingSection from '@/components/lp/sections/PricingSection';
import CTASection from '@/components/lp/sections/CTASection';

const SectionComponents: Record<string, any> = {
    hero: HeroSection,
    features: FeaturesSection,
    pricing: PricingSection,
    cta: CTASection
};

export default function SectionRenderer({ section, isEditing = false }: { section: any; isEditing?: boolean }) {
    const Component = SectionComponents[section.type];

    if (!Component) {
        return (
            <div className="p-10 text-center border border-dashed border-red-500/50 bg-red-500/10 rounded-lg m-4">
                <p className="text-red-400">Unknown Section Type: {section.type}</p>
            </div>
        );
    }

    return <Component content={section.content} isEditing={isEditing} />;
}
