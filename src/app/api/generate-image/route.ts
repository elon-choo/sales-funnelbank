// src/app/api/generate-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generateHeroBackground, generateFeatureIllustration } from '@/lib/ai/gemini';
import * as fs from 'fs';
import * as path from 'path';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type = 'hero', theme = 'tech', featureType } = body;

        let imageDataUrl: string;

        if (type === 'hero') {
            imageDataUrl = await generateHeroBackground(theme);
        } else if (type === 'feature' && featureType) {
            imageDataUrl = await generateFeatureIllustration(featureType);
        } else {
            return NextResponse.json(
                { error: 'Invalid type parameter' },
                { status: 400 }
            );
        }

        // Save to public folder
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const fileName = `${type}-${theme || featureType}-${Date.now()}.png`;
        const publicPath = path.join(process.cwd(), 'public', 'generated');

        // Ensure directory exists
        if (!fs.existsSync(publicPath)) {
            fs.mkdirSync(publicPath, { recursive: true });
        }

        const filePath = path.join(publicPath, fileName);
        fs.writeFileSync(filePath, base64Data, 'base64');

        return NextResponse.json({
            success: true,
            imageUrl: `/generated/${fileName}`,
            imageDataUrl
        });

    } catch (error) {
        console.error('Image generation error:', error);
        return NextResponse.json(
            {
                error: 'Failed to generate image',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

export async function GET() {
    return NextResponse.json({
        message: 'Image generation API',
        usage: {
            method: 'POST',
            body: {
                type: 'hero | feature',
                theme: 'tech | cosmic | glass (for hero)',
                featureType: 'string (for feature type)'
            }
        }
    });
}
