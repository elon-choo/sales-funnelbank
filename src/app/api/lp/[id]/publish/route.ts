// src/app/api/lp/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { authenticateRequest } from '@/lib/auth/guards';

// 짧은 고유 ID 생성 (nanoid 대체)
function generateSlug(length: number = 10): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
}

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/lp/[id]/publish - 랜딩페이지 게시
export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const auth = await authenticateRequest(request);

        if (!auth) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
                { status: 401 }
            );
        }

        const supabase = createAdminClient();

        // 페이지 조회 및 소유권 확인
        const { data: page, error: fetchError } = await supabase
            .from('landing_pages')
            .select('id, user_id, slug, content, status')
            .eq('id', id)
            .eq('user_id', auth.userId)
            .is('deleted_at', null)
            .single();

        if (fetchError || !page) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: '페이지를 찾을 수 없습니다' } },
                { status: 404 }
            );
        }

        // slug 생성 (없으면)
        let slug = page.slug;
        if (!slug) {
            slug = generateSlug(10); // 10자리 고유 ID
        }

        // 공개 URL 생성
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const publishedUrl = `${baseUrl}/p/${slug}`;

        // 페이지 업데이트
        const { data: updatedPage, error: updateError } = await supabase
            .from('landing_pages')
            .update({
                status: 'published',
                slug: slug,
                published_url: publishedUrl,
                content: {
                    ...(page.content as object),
                    isPublished: true
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Publish error:', updateError);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '게시 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                page: updatedPage,
                publishedUrl
            }
        });

    } catch (error) {
        console.error('Publish API Error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}

// DELETE /api/lp/[id]/publish - 게시 취소 (비공개로 전환)
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { id } = await params;
        const auth = await authenticateRequest(request);

        if (!auth) {
            return NextResponse.json(
                { success: false, error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } },
                { status: 401 }
            );
        }

        const supabase = createAdminClient();

        // 페이지 조회
        const { data: page, error: fetchError } = await supabase
            .from('landing_pages')
            .select('id, content')
            .eq('id', id)
            .eq('user_id', auth.userId)
            .single();

        if (fetchError || !page) {
            return NextResponse.json(
                { success: false, error: { code: 'NOT_FOUND', message: '페이지를 찾을 수 없습니다' } },
                { status: 404 }
            );
        }

        // 게시 취소
        const { data: updatedPage, error: updateError } = await supabase
            .from('landing_pages')
            .update({
                status: 'draft',
                published_url: null,
                content: {
                    ...(page.content as object),
                    isPublished: false
                },
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (updateError) {
            console.error('Unpublish error:', updateError);
            return NextResponse.json(
                { success: false, error: { code: 'DB_ERROR', message: '게시 취소 실패' } },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            data: { page: updatedPage }
        });

    } catch (error) {
        console.error('Unpublish API Error:', error);
        return NextResponse.json(
            { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
            { status: 500 }
        );
    }
}
