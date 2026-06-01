import { NextRequest } from 'next/server';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils/src/supabase/admin-client';
import { verifyMobileAccessToken } from '@/lib/mobile/token';

export interface MobileAuthContext {
    userId: string;
    tenantId: string;
    role: string;
}

export async function getMobileAuthContext(request: NextRequest): Promise<MobileAuthContext | null> {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
        return null;
    }

    const token = authHeader.slice(7).trim();
    if (!token) return null;

    const admin = createAuditedSupabaseAdminClient('mobile-auth-context');

    // Prefer mobile short-lived JWT first; fallback keeps backward compatibility
    // with existing Supabase bearer tokens until all clients migrate.
    const mobileClaims = await verifyMobileAccessToken(token);
    if (mobileClaims) {
        const { data: profile } = await admin
            .from('users')
            .select('tenant_id, role, is_active')
            .eq('id', mobileClaims.sub)
            .single();

        if (!profile?.tenant_id || profile.is_active === false) return null;
        if (profile.tenant_id !== mobileClaims.tenantId) return null;

        return {
            userId: mobileClaims.sub,
            tenantId: profile.tenant_id,
            role: profile.role,
        };
    }

    const {
        data: { user },
        error,
    } = await admin.auth.getUser(token);

    if (error || !user) return null;

    const { data: profile } = await admin
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

    if (!profile?.tenant_id) return null;

    return {
        userId: user.id,
        tenantId: profile.tenant_id,
        role: profile.role,
    };
}

