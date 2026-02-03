// src/lib/ai/gemini.ts
import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || '';

if (!apiKey) {
    console.warn("GEMINI_API_KEY is not set");
}

const ai = new GoogleGenAI({ apiKey });

export type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';
export type ImageSize = '512' | '1K' | '2K';

export interface ImageGenerationOptions {
    prompt: string;
    aspectRatio?: AspectRatio;
    imageSize?: ImageSize;
}

/**
 * Generate an image using Gemini Pro Image model
 */
export const generateImage = async (options: ImageGenerationOptions): Promise<string> => {
    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not configured");
    }

    const { prompt, aspectRatio = '16:9', imageSize = '1K' } = options;

    const fullPrompt = `
        Create a stunning, high-quality image.
        ${prompt}

        Style: Ultra high quality, 8K resolution, professional photography/digital art
        Lighting: Dramatic, cinematic lighting with depth
        Colors: Rich, vibrant, premium feel
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.0-flash-preview-image-generation',
            contents: fullPrompt,
            config: {
                responseModalities: ['Text', 'Image'],
            }
        });

        const parts = response.candidates?.[0]?.content?.parts;
        if (!parts) {
            throw new Error("No content generated");
        }

        for (const part of parts) {
            if (part.inlineData && part.inlineData.data) {
                return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
            }
        }

        throw new Error("No image data found in response");
    } catch (error) {
        console.error("Gemini image generation error:", error);
        throw error;
    }
};

/**
 * Generate a hero background image for landing pages
 */
export const generateHeroBackground = async (theme: string = 'tech'): Promise<string> => {
    const prompts: Record<string, string> = {
        tech: `
            Abstract futuristic technology background.
            Deep space dark purple (#030014) base with floating geometric shapes.
            Glowing purple (#7C3AED) and pink (#DB2777) gradient orbs scattered throughout.
            Subtle grid pattern overlay. Mesh gradient effect.
            Floating translucent glass particles catching light.
            Cyberpunk aesthetic, premium SaaS feel.
            NO text, NO logos, just abstract background.
        `,
        cosmic: `
            Cosmic deep space nebula background.
            Ultra dark base (#030014) with rich purple and magenta gradients.
            Distant stars and subtle galaxy formations.
            Ethereal glow effects in purple and cyan.
            Premium, mysterious, high-end tech aesthetic.
            NO text, NO logos, pure abstract cosmic scene.
        `,
        glass: `
            Glassmorphism abstract background.
            Deep dark purple space (#0A0A1B) as base.
            Multiple floating frosted glass cards and shapes.
            Soft purple and pink gradient light sources.
            Subtle blur effects and reflections.
            Modern, premium UI aesthetic.
            NO text, NO logos.
        `
    };

    return generateImage({
        prompt: prompts[theme] || prompts.tech,
        aspectRatio: '16:9',
        imageSize: '2K'
    });
};

/**
 * Generate a feature icon or illustration
 */
export const generateFeatureIllustration = async (featureType: string): Promise<string> => {
    const prompt = `
        Minimalist 3D icon illustration for "${featureType}" feature.
        Floating on dark purple/black background.
        Glowing purple (#7C3AED) and pink (#DB2777) accent colors.
        Glassmorphism style with subtle reflections.
        Premium, modern SaaS aesthetic.
        Clean, simple, elegant design.
        NO text.
    `;

    return generateImage({
        prompt,
        aspectRatio: '1:1',
        imageSize: '512'
    });
};
