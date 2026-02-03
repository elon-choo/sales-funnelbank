// src/lib/supabase/admin.ts

/**
 * CRITICAL: 이 파일은 서버에서만 import 가능!
 * 클라이언트 번들에 포함되지 않음
 */
import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// 싱글톤 인스턴스 (즉시 생성하지 않고 lazy initialization)
let adminClient: ReturnType<typeof createClient<Database>> | null = null;

/**
 * Admin Supabase 클라이언트
 * - Service Role Key 사용 (RLS 우회)
 * - 서버 사이드에서만 사용!
 * - 싱글톤 패턴 (lazy)
 */
export function createAdminClient() {
    if (!adminClient) {
        // 환경변수 검증
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error(
                'SUPABASE_SERVICE_ROLE_KEY is not defined. ' +
                'This should only be called on the server.'
            );
        }

        adminClient = createClient<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );
    }

    return adminClient;
}
