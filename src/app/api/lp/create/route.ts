
// src/app/api/lp/create/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/auth/guards';
import { z } from 'zod';

const createLpSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    content: z.object({
        title: z.string(),
        slug: z.string().optional(),
        theme: z.string(),
        sections: z.array(z.any()),
        isPublished: z.boolean(),
    }),
});

export async function POST(request: NextRequest) {
    try {
        const auth = await authenticateRequest(request);
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const validation = createLpSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.format() },
                { status: 400 }
            );
        }

        const { title, content } = validation.data;

        const supabase = createAdminClient();

        const { data, error } = await supabase
            .from('landing_pages')
            .insert({
                user_id: auth.userId,
                title: title,
                content: content, // Storing full JSON content
                status: content.isPublished ? 'published' : 'draft',
                slug: content.slug || null,
            })
            .select()
            .single();

        if (error) {
            console.error('DB Insert Error:', error);
            return NextResponse.json({ error: 'Failed to create page' }, { status: 500 });
        }

        return NextResponse.json({ success: true, id: data.id, slug: data.slug });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
