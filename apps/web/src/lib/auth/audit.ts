import { randomUUID } from 'crypto';
import type { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

type AuthAuditEventInput = {
    action: string;
    email?: string;
    request: NextRequest;
    userId?: string | null;
    tenantId?: string | null;
    isCritical?: boolean;
    description: string;
    metadata?: Record<string, unknown>;
};

function getRequestIpAddress(request: NextRequest) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');

    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() ?? null;
    }

    return realIp?.trim() ?? null;
}

export async function getUserAuditContextByEmail(email: string) {
    try {
        const adminSupabase = createAdminClient();
        const normalizedEmail = email.trim().toLowerCase();

        const { data } = await adminSupabase
            .from('users')
            .select('id, tenant_id')
            .eq('email', normalizedEmail)
            .maybeSingle();

        return {
            userId: data?.id ?? null,
            tenantId: data?.tenant_id ?? null,
        };
    } catch {
        return {
            userId: null,
            tenantId: null,
        };
    }
}

export async function logAuthAuditEvent(input: AuthAuditEventInput) {
    try {
        const adminSupabase = createAdminClient();

        await adminSupabase.from('audit_log').insert({
            id: randomUUID(),
            user_id: input.userId ?? null,
            tenant_id: input.tenantId ?? null,
            action: input.action,
            entity_type: 'auth_event',
            entity_id: randomUUID(),
            changes_description: input.description,
            new_values: {
                email: input.email?.trim().toLowerCase() ?? null,
                ...input.metadata,
            },
            ip_address: getRequestIpAddress(input.request),
            user_agent: input.request.headers.get('user-agent'),
            is_critical: input.isCritical ?? false,
        });
    } catch (error) {
        console.error('Erro ao registrar auditoria de autenticação:', error);
    }
}