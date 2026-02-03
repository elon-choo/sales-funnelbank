// src/app/api/builder/generate-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/guards';

// Image generation using Imagen 4 (Latest GA - December 2025)
export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { sectionType, visualPrompt, aspectRatio = '16:9' } = await request.json();

    if (!visualPrompt) {
      return NextResponse.json({ error: 'Visual prompt required' }, { status: 400 });
    }

    // Initialize Imagen 3 API
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Gemini API not configured' }, { status: 500 });
    }

    const enhancedPrompt = buildImagePrompt(sectionType, visualPrompt, aspectRatio);

    try {
      // Imagen 4 API endpoint (Latest GA - December 2025)
      // Using imagen-4.0-generate-001 model
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            instances: [
              {
                prompt: enhancedPrompt,
              },
            ],
            parameters: {
              sampleCount: 1,
              aspectRatio: aspectRatio, // "16:9", "1:1", "9:16", "3:4", "4:3"
              personGeneration: 'allow_adult',
              safetyFilterLevel: 'block_medium_and_above',
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Imagen 4 API error:', response.status, errorText);

        // Fallback to placeholder
        const placeholderUrl = generatePlaceholderImage(sectionType);
        return NextResponse.json({ imageUrl: placeholderUrl });
      }

      const result = await response.json();

      // Extract base64 image from Imagen 4 response
      // Response format: { predictions: [{ bytesBase64Encoded: "..." }] }
      if (result.predictions?.[0]?.bytesBase64Encoded) {
        const imageUrl = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        return NextResponse.json({ imageUrl });
      }

      // Alternative response format check
      if (result.predictions?.[0]?.image?.bytesBase64Encoded) {
        const imageUrl = `data:image/png;base64,${result.predictions[0].image.bytesBase64Encoded}`;
        return NextResponse.json({ imageUrl });
      }

      // If no image was generated, return a gradient placeholder
      console.log('No image in response, using placeholder');
      const placeholderUrl = generatePlaceholderImage(sectionType);
      return NextResponse.json({ imageUrl: placeholderUrl });

    } catch (genError) {
      console.error('Imagen 4 generation error:', genError);
      // Return placeholder on error
      const placeholderUrl = generatePlaceholderImage(sectionType);
      return NextResponse.json({ imageUrl: placeholderUrl });
    }

  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate image' },
      { status: 500 }
    );
  }
}

function buildImagePrompt(sectionType: string, visualPrompt: string, aspectRatio: string): string {
  const sectionStyles: Record<string, string> = {
    hero: 'bold, impactful, attention-grabbing, gradient background with purple and blue tones, professional business aesthetic',
    problem: 'moody, dark tones, subtle anxiety visualization, professional photography style, empathetic atmosphere',
    solution: 'bright, optimistic, clean design, breakthrough moment, light and clarity emerging',
    benefits: 'organized, clean icons or graphics, positive and uplifting, modern flat design style',
    proof: 'trustworthy, authentic, warm lighting, testimonial-style imagery, credibility focused',
    offer: 'premium, exclusive, gift-like presentation, value-focused, luxurious accents',
    cta: 'urgent, dynamic, action-oriented, bright call-to-action colors, energetic',
    faq: 'helpful, supportive, clean and organized, question mark motifs, approachable',
  };

  const style = sectionStyles[sectionType] || 'professional, modern, clean';

  return `Generate a professional landing page image for a ${sectionType} section.

Style Requirements:
- ${style}
- Aspect ratio: ${aspectRatio}
- No text or typography in the image
- High quality, 4K resolution appearance
- Modern 2024+ design trends
- Suitable as background or hero image for web
- Clean, uncluttered composition with space for text overlay

Specific Visual Direction:
${visualPrompt}

Create a visually stunning, professional image that would work well on a high-converting sales landing page.`;
}

function generatePlaceholderImage(sectionType: string): string {
  // Generate a CSS gradient as SVG data URL placeholder
  const gradients: Record<string, [string, string]> = {
    hero: ['#667eea', '#764ba2'],
    problem: ['#434343', '#000000'],
    solution: ['#11998e', '#38ef7d'],
    benefits: ['#6B73FF', '#000DFF'],
    proof: ['#f5af19', '#f12711'],
    offer: ['#8E2DE2', '#4A00E0'],
    cta: ['#FF416C', '#FF4B2B'],
    faq: ['#2193b0', '#6dd5ed'],
  };

  const [color1, color2] = gradients[sectionType] || ['#667eea', '#764ba2'];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${color2};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)"/>
    <circle cx="300" cy="200" r="150" fill="rgba(255,255,255,0.1)"/>
    <circle cx="1600" cy="800" r="200" fill="rgba(255,255,255,0.05)"/>
    <circle cx="960" cy="540" r="100" fill="rgba(255,255,255,0.08)"/>
  </svg>`;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}
