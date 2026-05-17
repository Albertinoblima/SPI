// GET /api/admin/audit-log - Listar logs de auditoria do sistema
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action');
        const entityType = searchParams.get('entityType');
        const critical = searchParams.get('critical') === 'true';
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = 50;
        const offset = (page - 1) * pageSize;

        let query = auth.supabase
            .from('audit_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        if (action) {
            query = query.eq('action', action);
        }

        if (entityType) {
            query = query.eq('entity_type', entityType);
        }

        if (critical) {
            query = query.eq('is_critical', true);
        }

        const { data: logs, count, error: fetchError } = await query
            .range(offset, offset + pageSize - 1);

        if (fetchError) {
            return trackedApiError(request, 'Erro ao buscar logs de auditoria', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/audit-log' },
            });
        }

        // Enriquecer com informações de usuário
        const enrichedLogs = await Promise.all(
            logs.map(async (log) => {
                if (log.user_id) {
                    const { data: user } = await auth.supabase
                        .from('users')
                        .select('full_name, email')
                        .eq('id', log.user_id)
                        .single();

                    return {
                        ...log,
                        user: user,
                    };
                }
                return log;
            })
        );

        return apiSuccess({
            logs: enrichedLogs,
            pagination: {
                page,
                pageSize,
                total: count,
                totalPages: Math.ceil((count || 0) / pageSize),
            },
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/audit-log' },
        });
    }
}
