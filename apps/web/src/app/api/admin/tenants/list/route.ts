// GET /api/admin/tenants/list - Lista simplificada de tenants (id + name) para selects
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);
    if (!auth.isAuthorized) return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);

    try {
        // Usa service role para contornar RLS e listar todos os tenants
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: tenants, error } = await adminClient
            .from('tenants')
            .select('id, name, slug, status')
            .is('deleted_at', null)
            .order('name', { ascending: true })
            .limit(200);

        if (error) {
            return trackedApiError(request, 'Erro ao buscar empresas', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/tenants/list' },
            });
        }

        return apiSuccess({ tenants: tenants ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/tenants/list' },
        });
    }
}
