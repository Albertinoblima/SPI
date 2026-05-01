// User Entity Types

export type UserRole = 'admin' | 'manager' | 'interviewer';

export interface User {
    id: string;
    auth_id: string;
    tenant_id: string;
    email: string;
    full_name: string;
    phone?: string;
    role: UserRole;
    avatar_url?: string;
    is_active: boolean;
    last_sync_at?: string;
    created_at: string;
    updated_at: string;
}

export interface CreateUserDTO {
    email: string;
    full_name: string;
    phone?: string;
    role: UserRole;
    password: string;
}

export interface UpdateUserDTO {
    full_name?: string;
    phone?: string;
    role?: UserRole;
    is_active?: boolean;
    avatar_url?: string;
}
