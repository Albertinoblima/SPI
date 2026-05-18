import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError, requireTenantAdmin } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireTenantAdmin(request);
    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);
    }

    try {
        const { searchParams } = request.nextUrl;
        const q = searchParams.get('q')?.trim() ?? '';
        const uf = searchParams.get('uf')?.trim().toUpperCase() ?? '';
        const regiao = searchParams.get('regiao')?.trim() ?? '';
        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
        const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
        const offset = (page - 1) * limit;

        let query = auth.supabase
            .from('vw_municipio_resumo')
            .select('*', { count: 'exact' });

        if (q) {
            // Busca por nome normalizado (sem acento, minusculo)
            query = query.ilike('nome', `%${q}%`);
        }
        if (uf) {
            query = query.eq('uf', uf);
        }
        if (regiao) {
            query = query.eq('regiao', regiao);
        }

        query = query
            .order('uf', { ascending: true })
            .order('nome', { ascending: true })
            .range(offset, offset + limit - 1);

        const { data, error, count } = await query;

        if (error) {
            return handleApiUnhandledError(request, error, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/geo/municipios' },
            });
        }

        return apiSuccess({
            municipios: data ?? [],
            pagination: {
                page,
                limit,
                total: count ?? 0,
                totalPages: Math.ceil((count ?? 0) / limit),
            },
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/geo/municipios' },
        });
    }
}
