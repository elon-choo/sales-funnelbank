
// src/lib/ai/tokenManager.ts
import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

interface ReservationResult {
    success: boolean;
    reservationId?: string;
    error?: string;
    data?: any;
}

/**
 * Reserve tokens using Database RPC
 * - Uses Advisory Locks for concurrency
 * - Checks daily limits based on Tier
 */
export async function reserveTokens(
    userId: string,
    estimatedTokens: number
): Promise<ReservationResult> {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc('check_and_reserve_tokens', {
        p_user_id: userId,
        p_estimated_tokens: estimatedTokens,
    });

    if (error) {
        console.error('Reservation RPC Error:', error);
        return { success: false, error: 'Database error during reservation' };
    }

    const result = data as any; // RPC returns JSONB

    if (!result.success) {
        return {
            success: false,
            error: result.error,
            data: result // Contains details like available tokens
        };
    }

    return {
        success: true,
        reservationId: result.reservation_id,
    };
}

/**
 * Confirm actual token usage and release lock/adjust reservation
 */
export async function confirmTokenUsage(
    reservationId: string,
    actualTokens: number
): Promise<void> {
    const supabase = createAdminClient();

    const { error } = await supabase.rpc('confirm_token_usage', {
        p_reservation_id: reservationId,
        p_actual_tokens: actualTokens,
    });

    if (error) {
        console.error('Confirmation RPC Error:', error);
        // Not throwing here to avoid breaking the user response flow, 
        // but this should be alerted in production
    }
}
