// src/app/api/builder/save/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { authenticateRequest } from '@/lib/auth/guards';
import { createClient } from '@supabase/supabase-js';

const HARDCODED_ADMIN_ID = '00000000-0000-0000-0000-000000000001';

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const auth = await authenticateRequest(request);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { plan } = await request.json();

    if (!plan || !plan.sections) {
      return NextResponse.json({ error: 'Invalid plan data' }, { status: 400 });
    }

    // Generate unique ID and slug
    const id = crypto.randomUUID();
    const slug = generateSlug(plan.businessInfo?.name || 'landing-page');

    // For hardcoded admin, just return success without DB save
    if (auth.userId === HARDCODED_ADMIN_ID) {
      // Generate full HTML
      const html = generateFullHTML(plan);

      return NextResponse.json({
        id,
        slug,
        html,
        message: 'Landing page saved (demo mode)',
      });
    }

    // For real users, save to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      // Fallback: return success without DB save
      const html = generateFullHTML(plan);
      return NextResponse.json({
        id,
        slug,
        html,
        message: 'Landing page generated (DB not configured)',
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Save to database
    const { data, error } = await supabase
      .from('landing_pages')
      .insert({
        id,
        user_id: auth.userId,
        slug,
        title: plan.businessInfo?.name || 'Landing Page',
        plan_data: plan,
        html: generateFullHTML(plan),
        status: 'draft',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase save error:', error);
      // Return success anyway with generated content
      const html = generateFullHTML(plan);
      return NextResponse.json({
        id,
        slug,
        html,
        message: 'Landing page generated',
      });
    }

    return NextResponse.json({
      id: data.id,
      slug: data.slug,
      html: data.html,
      message: 'Landing page saved successfully',
    });

  } catch (error) {
    console.error('Save error:', error);
    return NextResponse.json(
      { error: 'Failed to save landing page' },
      { status: 500 }
    );
  }
}

function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);

  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return `${base}-${randomSuffix}`;
}

function generateFullHTML(plan: {
  businessInfo?: { name?: string; tagline?: string };
  sections: Array<{
    type: string;
    content: {
      headline?: string;
      subheadline?: string;
      bodyText?: string;
      bulletPoints?: string[];
      ctaText?: string;
    };
    imageUrl?: string;
  }>;
  googleFormUrl?: string;
}): string {
  const title = plan.businessInfo?.name || 'Landing Page';
  const ctaUrl = plan.googleFormUrl || '#';

  const sectionsHTML = plan.sections.map(section => {
    switch (section.type) {
      case 'hero':
        return `
<section class="min-h-screen gradient-bg flex items-center justify-center relative overflow-hidden">
  ${section.imageUrl ? `<div class="absolute inset-0"><img src="${section.imageUrl}" alt="" class="w-full h-full object-cover opacity-30" loading="lazy" /></div>` : ''}
  <div class="relative z-10 text-center max-w-4xl mx-auto px-6 py-20">
    <h1 class="text-4xl md:text-6xl font-extrabold mb-6 leading-tight animate-fade-in">${section.content.headline || ''}</h1>
    ${section.content.subheadline ? `<p class="text-xl md:text-2xl text-purple-100 mb-8 animate-fade-in-delay">${section.content.subheadline}</p>` : ''}
    ${section.content.bodyText ? `<p class="text-lg text-purple-200 mb-10 max-w-2xl mx-auto">${section.content.bodyText}</p>` : ''}
    <a href="${ctaUrl}" target="_blank" rel="noopener" class="inline-block bg-white text-purple-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-purple-100 transition-all transform hover:scale-105 shadow-2xl cta-button">
      ${section.content.ctaText || '지금 시작하기'}
    </a>
  </div>
</section>`;

      case 'problem':
        return `
<section class="py-20 bg-gray-900">
  <div class="max-w-4xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12 text-red-400">${section.content.headline || ''}</h2>
    ${section.content.bodyText ? `<p class="text-lg text-gray-300 text-center mb-10">${section.content.bodyText}</p>` : ''}
    ${section.content.bulletPoints?.length ? `
    <ul class="space-y-4 max-w-2xl mx-auto">
      ${section.content.bulletPoints.map(point => `
        <li class="flex items-start gap-3 text-gray-300 p-4 bg-gray-800/50 rounded-lg">
          <span class="text-red-400 text-xl mt-0.5">✗</span>
          <span class="text-lg">${point}</span>
        </li>
      `).join('')}
    </ul>` : ''}
  </div>
</section>`;

      case 'solution':
        return `
<section class="py-20 bg-gradient-to-b from-gray-900 to-purple-900/30">
  ${section.imageUrl ? `<div class="max-w-6xl mx-auto px-6 mb-12"><img src="${section.imageUrl}" alt="" class="rounded-2xl shadow-2xl w-full" loading="lazy" /></div>` : ''}
  <div class="max-w-4xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-4xl font-bold mb-8">${section.content.headline || ''}</h2>
    ${section.content.subheadline ? `<p class="text-xl text-purple-300 mb-6">${section.content.subheadline}</p>` : ''}
    ${section.content.bodyText ? `<p class="text-lg text-gray-300 max-w-2xl mx-auto">${section.content.bodyText}</p>` : ''}
  </div>
</section>`;

      case 'benefits':
        return `
<section class="py-20 bg-gray-800">
  <div class="max-w-6xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">${section.content.headline || ''}</h2>
    ${section.content.bulletPoints?.length ? `
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      ${section.content.bulletPoints.map(benefit => `
        <div class="glass-card p-6 rounded-xl hover:transform hover:scale-105 transition-all">
          <span class="text-green-400 text-3xl mb-4 block">✓</span>
          <p class="text-gray-200 text-lg">${benefit}</p>
        </div>
      `).join('')}
    </div>` : ''}
  </div>
</section>`;

      case 'proof':
        return `
<section class="py-20 bg-gray-900">
  <div class="max-w-4xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">${section.content.headline || ''}</h2>
    ${section.content.bulletPoints?.length ? `
    <div class="space-y-6">
      ${section.content.bulletPoints.map(testimonial => `
        <div class="glass-card p-8 rounded-xl">
          <svg class="w-8 h-8 text-purple-400 mb-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z"/>
          </svg>
          <p class="text-gray-300 text-lg italic">${testimonial}</p>
        </div>
      `).join('')}
    </div>` : ''}
  </div>
</section>`;

      case 'offer':
        return `
<section class="py-20 gradient-bg">
  <div class="max-w-4xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-4xl font-bold mb-8">${section.content.headline || ''}</h2>
    ${section.content.bodyText ? `<p class="text-xl text-purple-100 mb-8">${section.content.bodyText}</p>` : ''}
    ${section.content.bulletPoints?.length ? `
    <div class="bg-white/10 backdrop-blur rounded-2xl p-8 max-w-lg mx-auto mb-8">
      <ul class="text-left space-y-4">
        ${section.content.bulletPoints.map(item => `
          <li class="flex items-center gap-3 text-purple-100 text-lg">
            <span class="text-green-400 text-xl">✓</span>
            <span>${item}</span>
          </li>
        `).join('')}
      </ul>
    </div>` : ''}
  </div>
</section>`;

      case 'cta':
        return `
<section class="py-24 bg-gray-900 relative overflow-hidden">
  <div class="absolute inset-0 bg-gradient-to-r from-purple-900/20 to-pink-900/20"></div>
  <div class="relative z-10 max-w-4xl mx-auto px-6 text-center">
    <h2 class="text-3xl md:text-5xl font-bold mb-6">${section.content.headline || ''}</h2>
    ${section.content.subheadline ? `<p class="text-xl md:text-2xl text-purple-300 mb-8">${section.content.subheadline}</p>` : ''}
    <a href="${ctaUrl}" target="_blank" rel="noopener" class="inline-block bg-gradient-to-r from-purple-600 to-pink-600 text-white px-12 py-6 rounded-full font-bold text-xl hover:from-purple-500 hover:to-pink-500 transition-all transform hover:scale-105 shadow-2xl cta-button">
      ${section.content.ctaText || '지금 신청하기'}
    </a>
    ${section.content.bodyText ? `<p class="text-sm text-gray-500 mt-8">${section.content.bodyText}</p>` : ''}
  </div>
</section>`;

      case 'faq':
        return `
<section class="py-20 bg-gray-800">
  <div class="max-w-3xl mx-auto px-6">
    <h2 class="text-3xl md:text-4xl font-bold text-center mb-12">${section.content.headline || ''}</h2>
    ${section.content.bulletPoints?.length ? `
    <div class="space-y-4">
      ${section.content.bulletPoints.map((faq, i) => {
        const [q, a] = faq.split('|');
        return `
        <details class="glass-card rounded-xl overflow-hidden group">
          <summary class="p-6 cursor-pointer font-semibold text-purple-300 hover:text-purple-200 flex items-center justify-between">
            <span>Q${i + 1}. ${q || faq}</span>
            <svg class="w-5 h-5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </summary>
          <div class="px-6 pb-6 text-gray-300">
            ${a || '답변이 준비중입니다.'}
          </div>
        </details>`;
      }).join('')}
    </div>` : ''}
  </div>
</section>`;

      default:
        return '';
    }
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${plan.businessInfo?.tagline || ''}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${plan.businessInfo?.tagline || ''}">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { font-family: 'Noto Sans KR', sans-serif; }
    .gradient-bg { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .glass-card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }
    .glass-card:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }
    .cta-button {
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.5); }
      50% { box-shadow: 0 0 0 15px rgba(139, 92, 246, 0); }
    }
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fade-in 0.8s ease-out forwards;
    }
    .animate-fade-in-delay {
      animation: fade-in 0.8s ease-out 0.2s forwards;
      opacity: 0;
    }
    html { scroll-behavior: smooth; }
    details summary::-webkit-details-marker { display: none; }
    details summary { list-style: none; }
  </style>
</head>
<body class="bg-gray-900 text-white">
${sectionsHTML}

<!-- Footer -->
<footer class="py-8 bg-gray-950 text-center">
  <p class="text-gray-500 text-sm">
    &copy; ${new Date().getFullYear()} ${title}. All rights reserved.
  </p>
  <p class="text-gray-600 text-xs mt-2">
    Powered by Magnetic Sales
  </p>
</footer>

<!-- CTA Click Tracking -->
<script>
document.querySelectorAll('.cta-button').forEach(btn => {
  btn.addEventListener('click', () => {
    if (typeof gtag !== 'undefined') {
      gtag('event', 'cta_click', {
        'event_category': 'engagement',
        'event_label': btn.textContent.trim()
      });
    }
  });
});
</script>
</body>
</html>`;
}
