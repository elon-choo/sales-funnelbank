// src/lib/supabase/client.ts

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * 브라우저용 Supabase 클라이언트
 * - Anon Key 사용 (공개 가능)
 * - RLS 정책 적용됨
 */
export function createClient() {
    return createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim()
    );
}
