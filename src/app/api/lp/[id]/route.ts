
// src/app/api/lp/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/auth/guards';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await authenticateRequest(request);

        const supabase = createAdminClient();
        const query = supabase
            .from('landing_pages')
            .select('*')
            .eq('id', id)
            .single();

        // If not authenticated, only fetch if published?
        // For now, let's assume this endpoint is for the editor so auth is required.
        // Public viewer might use a different logic or RLS will handle it if we use Supabase client directly.
        // But since this is an API route, we control logic.

        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data, error } = await query;

        if (error) {
            return NextResponse.json({ error: 'Page not found' }, { status: 404 });
        }

        // Verify ownership
        if (data.user_id !== auth.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json({ page: data });

    } catch (error) {
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await authenticateRequest(request);

        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        // Basic validation that title/content exists could be good here

        const supabase = createAdminClient();

        // Update
        const { data, error } = await supabase
            .from('landing_pages')
            .update({
                title: body.title,
                content: body.content,
                status: body.content?.isPublished ? 'published' : 'draft',
                slug: body.content?.slug || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', auth.userId) // RLS-like safety
            .select()
            .single();

        if (error) {
            console.error('Update Error:', error);
            return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
        }

        return NextResponse.json({ success: true, page: data });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// DELETE /api/lp/[id] - 랜딩페이지 삭제 (soft delete)
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const auth = await authenticateRequest(request);

        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabase = createAdminClient();

        const { error } = await supabase
            .from('landing_pages')
            .update({
                status: 'archived',
                deleted_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', auth.userId);

        if (error) {
            console.error('Delete Error:', error);
            return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: '페이지가 삭제되었습니다' });

    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
