// GET /api/admin/tenants - Listar todos os tenants com estatísticas
import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status');
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = 20;
        const offset = (page - 1) * pageSize;

        let query = auth.supabase
            .from('vw_tenant_stats')
            .select('*', { count: 'exact' })
            .order('tenant_name', { ascending: true });

        // Filtro por status
        if (status) {
            // Precisamos fazer um join com a tabela tenants para filtrar por status
            query = auth.supabase
                .from('tenants')
                .select(
                    `
                    id,
                    name,
                    slug,
                    status,
                    max_users,
                    max_surveys,
                    storage_limit_mb,
                    created_at,
                    deleted_at
                    `,
                    { count: 'exact' }
                )
                .eq('status', status)
                .order('created_at', { ascending: false })
                .range(offset, offset + pageSize - 1);
        } else {
            query = auth.supabase
                .from('tenants')
                .select(
                    `
                    id,
                    name,
                    slug,
                    status,
                    max_users,
                    max_surveys,
                    storage_limit_mb,
                    created_at,
                    deleted_at
                    `,
                    { count: 'exact' }
                )
                .is('deleted_at', null)
                .order('created_at', { ascending: false })
                .range(offset, offset + pageSize - 1);
        }

        const { data: tenants, count, error: fetchError } = await query;

        if (fetchError) {
            return apiError('Erro ao buscar tenants', 500);
        }

        // Enriquecer com estatísticas
        const enrichedTenants = await Promise.all(
            tenants.map(async (tenant) => {
                const { data: stats } = await auth.supabase
                    .from('vw_tenant_stats')
                    .select('*')
                    .eq('tenant_id', tenant.id)
                    .single();

                return {
                    ...tenant,
                    stats: stats || {},
                };
            })
        );

        return apiSuccess({
            tenants: enrichedTenants,
            pagination: {
                page,
                pageSize,
                total: count,
                totalPages: Math.ceil((count || 0) / pageSize),
            },
        });
    } catch (error) {
        console.error('Erro ao buscar tenants:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
