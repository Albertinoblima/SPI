// Tenant Entity Types

export type TenantStatus = 'active' | 'suspended' | 'trial';

export interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    max_users: number;
    max_surveys: number;
    storage_limit_mb: number;
    created_at: string;
    updated_at: string;
    deleted_at?: string;
}

export interface CreateTenantDTO {
    name: string;
    slug: string;
    status?: TenantStatus;
    max_users?: number;
    max_surveys?: number;
    storage_limit_mb?: number;
}

export interface UpdateTenantDTO extends Partial<CreateTenantDTO> { }
