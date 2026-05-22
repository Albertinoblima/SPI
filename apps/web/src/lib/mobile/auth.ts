import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

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

    const admin = createAdminClient();
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
