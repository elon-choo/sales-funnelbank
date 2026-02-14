
export type UserTier = 'FREE' | 'PREMIUM' | 'PRO' | 'ENTERPRISE';
export type UserRole = 'user' | 'premium' | 'admin' | 'owner';
export type CourseType = 'SALES_FUNNEL' | 'MAGNETIC_SALES';

export interface User {
    id: string;
    email: string;
    fullName: string;
    tier: UserTier;
    role: UserRole;
    courseType?: CourseType;
    isApproved: boolean;
    createdAt: string;
}

export interface AuthState {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    success: true;
    data: {
        accessToken: string;
        expiresIn: number;
        user: User;
    };
}

export interface SignupRequest {
    email: string;
    password: string;
    fullName: string;
    courseType?: CourseType;
    agreeTerms: boolean;
    agreePrivacy: boolean;
    agreeMarketing?: boolean;
}

export interface TokenPayload {
    sub: string;        // user_id
    email: string;
    tier: UserTier;
    role: UserRole;
    iat: number;        // issued at
    exp: number;        // expires at
}

export interface RefreshTokenRecord {
    id: string;
    user_id: string;
    token_hash: string;
    revoked: boolean;
    revoked_at: string | null;
    expires_at: string;
    created_at: string;
}

// API 응답 타입
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        reference?: string;
    };
}

// 인증 결과 타입
export interface AuthResult {
    userId: string;
    email: string;
    tier: UserTier;
    role: UserRole;
    isApproved: boolean;
}
