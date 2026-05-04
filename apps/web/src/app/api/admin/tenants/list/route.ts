// GET /api/admin/tenants/list - Lista simplificada de tenants (id + name) para selects
import { NextRequest } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);
    if (!auth.isAuthorized) return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);

    try {
        const { data: tenants, error } = await auth.supabase
            .from('tenants')
            .select('id, name, slug, is_active')
            .order('name', { ascending: true })
            .limit(200);

        if (error) return apiError('Erro ao buscar empresas', 500);

        return apiSuccess({ tenants: tenants ?? [] });
    } catch {
        return apiError('Erro interno', 500);
    }
}
