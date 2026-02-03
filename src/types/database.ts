export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[];

export type UserTier = 'FREE' | 'PRO' | 'ENTERPRISE';
export type UserRole = 'user' | 'admin';
export type LandingPageStatus = 'draft' | 'published' | 'archived';
export type ChatSessionStatus = 'active' | 'archived' | 'deleted';
export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type QASessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type TokenAction = 'generate' | 'regenerate' | 'edit';
export type ReservationStatus = 'reserved' | 'confirmed' | 'cancelled' | 'expired';
export type AuditSeverity = 'info' | 'warning' | 'error' | 'critical';
export type SecurityEventType =
    | 'token_reuse'
    | 'rate_limit_exceeded'
    | 'cors_blocked'
    | 'prompt_injection_detected'
    | 'brute_force_attempt'
    | 'suspicious_activity';

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string;
                    email: string;
                    full_name: string;
                    tier: UserTier;
                    role: UserRole;
                    is_approved: boolean;
                    agree_marketing: boolean;
                    approval_changed_at: string | null;
                    deleted_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id: string;
                    email: string;
                    full_name: string;
                    tier?: UserTier;
                    role?: UserRole;
                    is_approved?: boolean;
                    agree_marketing?: boolean;
                    approval_changed_at?: string | null;
                    deleted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    email?: string;
                    full_name?: string;
                    tier?: UserTier;
                    role?: UserRole;
                    is_approved?: boolean;
                    agree_marketing?: boolean;
                    approval_changed_at?: string | null;
                    deleted_at?: string | null;
                    updated_at?: string;
                };
            };
            landing_pages: {
                Row: {
                    id: string;
                    user_id: string;
                    qa_session_id: string | null;
                    title: string;
                    content: Json;
                    status: LandingPageStatus;
                    slug: string | null;
                    published_url: string | null;
                    deleted_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    qa_session_id?: string | null;
                    title: string;
                    content?: Json;
                    status?: LandingPageStatus;
                    slug?: string | null;
                    published_url?: string | null;
                    deleted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    user_id?: string;
                    qa_session_id?: string | null;
                    title?: string;
                    content?: Json;
                    status?: LandingPageStatus;
                    slug?: string | null;
                    published_url?: string | null;
                    deleted_at?: string | null;
                    updated_at?: string;
                };
            };
            qa_sessions: {
                Row: {
                    id: string;
                    user_id: string;
                    landing_page_id: string | null;
                    answers: Json;
                    current_step: number;
                    status: QASessionStatus;
                    deleted_at: string | null;
                    created_at: string;
                    updated_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    landing_page_id?: string | null;
                    answers?: Json;
                    current_step?: number;
                    status?: QASessionStatus;
                    deleted_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                };
                Update: {
                    landing_page_id?: string | null;
                    answers?: Json;
                    current_step?: number;
                    status?: QASessionStatus;
                    deleted_at?: string | null;
                    updated_at?: string;
                };
            };
            token_usage: {
                Row: {
                    id: string;
                    user_id: string;
                    tokens_used: number;
                    action: TokenAction;
                    reservation_id: string | null;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    tokens_used: number;
                    action: TokenAction;
                    reservation_id?: string | null;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: never; // Immutable
            };
            token_reservations: {
                Row: {
                    id: string;
                    user_id: string;
                    estimated_tokens: number;
                    actual_tokens: number | null;
                    status: ReservationStatus;
                    error_reason: string | null;
                    created_at: string;
                    confirmed_at: string | null;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    estimated_tokens: number;
                    actual_tokens?: number | null;
                    status?: ReservationStatus;
                    error_reason?: string | null;
                    created_at?: string;
                    confirmed_at?: string | null;
                };
                Update: {
                    actual_tokens?: number | null;
                    status?: ReservationStatus;
                    error_reason?: string | null;
                    confirmed_at?: string | null;
                };
            };
            refresh_tokens: {
                Row: {
                    id: string;
                    user_id: string;
                    token_hash: string;
                    revoked: boolean;
                    revoked_at: string | null;
                    expires_at: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    token_hash: string;
                    revoked?: boolean;
                    revoked_at?: string | null;
                    expires_at: string;
                    created_at?: string;
                };
                Update: {
                    revoked?: boolean;
                    revoked_at?: string | null;
                };
            };
            audit_logs: {
                Row: {
                    id: string;
                    user_id: string | null;
                    action: string;
                    severity: AuditSeverity;
                    details: Json;
                    ip_address: string | null;
                    user_agent: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id?: string | null;
                    action: string;
                    severity?: AuditSeverity;
                    details?: Json;
                    ip_address?: string | null;
                    user_agent?: string | null;
                    created_at?: string;
                };
                Update: never; // Immutable
            };
            user_sessions: {
                Row: {
                    id: string;
                    user_id: string;
                    ip_address: string | null;
                    user_agent: string | null;
                    device_info: Json;
                    invalidated_at: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    ip_address?: string | null;
                    user_agent?: string | null;
                    device_info?: Json;
                    invalidated_at?: string | null;
                    created_at?: string;
                };
                Update: {
                    invalidated_at?: string | null;
                };
            };
            rate_limits: {
                Row: {
                    id: string;
                    identifier: string;
                    endpoint: string;
                    request_count: number;
                    window_start: string;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    identifier: string;
                    endpoint: string;
                    request_count?: number;
                    window_start?: string;
                    created_at?: string;
                };
                Update: {
                    request_count?: number;
                };
            };
            security_events: {
                Row: {
                    id: string;
                    event_type: SecurityEventType;
                    user_id: string | null;
                    ip_address: string | null;
                    details: Json;
                    resolved: boolean;
                    resolved_at: string | null;
                    resolved_by: string | null;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    event_type: SecurityEventType;
                    user_id?: string | null;
                    ip_address?: string | null;
                    details?: Json;
                    resolved?: boolean;
                    resolved_at?: string | null;
                    resolved_by?: string | null;
                    created_at?: string;
                };
                Update: {
                    resolved?: boolean;
                    resolved_at?: string | null;
                    resolved_by?: string | null;
                };
            };
            chat_sessions: {
                Row: {
                    id: string;
                    user_id: string;
                    title: string;
                    landing_page_id: string | null;
                    status: ChatSessionStatus;
                    message_count: number;
                    total_tokens: number;
                    last_message_at: string | null;
                    created_at: string;
                    updated_at: string;
                    deleted_at: string | null;
                };
                Insert: {
                    id?: string;
                    user_id: string;
                    title?: string;
                    landing_page_id?: string | null;
                    status?: ChatSessionStatus;
                    message_count?: number;
                    total_tokens?: number;
                    last_message_at?: string | null;
                    created_at?: string;
                    updated_at?: string;
                    deleted_at?: string | null;
                };
                Update: {
                    title?: string;
                    landing_page_id?: string | null;
                    status?: ChatSessionStatus;
                    message_count?: number;
                    total_tokens?: number;
                    last_message_at?: string | null;
                    updated_at?: string;
                    deleted_at?: string | null;
                };
            };
            chat_messages: {
                Row: {
                    id: string;
                    session_id: string;
                    role: ChatMessageRole;
                    content: string;
                    tokens_used: number;
                    metadata: Json;
                    created_at: string;
                };
                Insert: {
                    id?: string;
                    session_id: string;
                    role: ChatMessageRole;
                    content: string;
                    tokens_used?: number;
                    metadata?: Json;
                    created_at?: string;
                };
                Update: never; // 메시지는 불변
            };
        };
        Functions: {
            check_rate_limit: {
                Args: {
                    p_identifier: string;
                    p_endpoint: string;
                    p_limit: number;
                    p_window_seconds: number;
                };
                Returns: Json;
            };
            check_and_reserve_tokens: {
                Args: {
                    p_user_id: string;
                    p_estimated_tokens: number;
                };
                Returns: Json;
            };
            confirm_token_usage: {
                Args: {
                    p_reservation_id: string;
                    p_actual_tokens: number;
                };
                Returns: Json;
            };
            cancel_token_reservation: {
                Args: {
                    p_reservation_id: string;
                    p_reason?: string;
                };
                Returns: Json;
            };
            get_user_token_usage: {
                Args: {
                    p_user_id: string;
                };
                Returns: Json;
            };
            get_system_stats: {
                Args: Record<string, never>;
                Returns: Json;
            };
            check_data_consistency: {
                Args: Record<string, never>;
                Returns: {
                    check_name: string;
                    status: string;
                    details: Json;
                }[];
            };
        };
    };
}
