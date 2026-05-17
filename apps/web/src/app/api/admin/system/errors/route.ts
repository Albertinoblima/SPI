// GET /api/admin/system/errors - Listar erros do sistema
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    handleApiUnhandledError,
    trackedApiError,
} from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const severity = searchParams.get('severity');
        const resolvedQuery = searchParams.get('resolved');
        const search = searchParams.get('search')?.trim();
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = 50;
        const offset = (page - 1) * pageSize;

        let query = auth.supabase
            .from('error_logs')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false });

        // Filtros opcionais
        if (severity) {
            query = query.eq('severity', severity);
        }

        if (resolvedQuery === 'true' || resolvedQuery === 'false') {
            query = query.eq('resolved', resolvedQuery === 'true');
        }

        if (search) {
            query = query.or(`error_code.ilike.%${search}%,error_message.ilike.%${search}%`);
        }

        const { data: errors, count, error: fetchError } = await query
            .range(offset, offset + pageSize - 1);

        if (fetchError) {
            return trackedApiError(request, 'Erro ao buscar logs de erro', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/system/errors', severity, resolvedQuery },
            });
        }

        const [{ count: openCount }, { count: criticalCount }] = await Promise.all([
            auth.supabase
                .from('error_logs')
                .select('*', { count: 'exact', head: true })
                .eq('resolved', false),
            auth.supabase
                .from('error_logs')
                .select('*', { count: 'exact', head: true })
                .eq('resolved', false)
                .eq('severity', 'critical'),
        ]);

        return apiSuccess({
            errors,
            summary: {
                openCount: openCount ?? 0,
                criticalOpenCount: criticalCount ?? 0,
            },
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
            metadata: { route: '/api/admin/system/errors' },
        });
    }
}

// PUT /api/admin/system/errors/:id - Resolver erro
export async function PUT(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const body = await request.json();
        const { id, resolved, resolution_notes } = body;

        if (!id) {
            return apiError('ID do erro é obrigatório', 400);
        }

        const { data: updated, error: updateError } = await auth.supabase
            .from('error_logs')
            .update({
                resolved,
                resolved_at: resolved ? new Date().toISOString() : null,
            })
            .eq('id', id)
            .select();

        if (updateError) {
            return trackedApiError(request, 'Erro ao atualizar log de erro', 500, {
                errorCode: 'DB_WRITE_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/system/errors', id, resolved },
            });
        }

        // Log da ação na auditoria
        await auth.supabase.rpc('log_audit', {
            p_user_id: auth.user.id,
            p_tenant_id: null,
            p_action: 'error_resolved',
            p_entity_type: 'error_log',
            p_entity_id: id,
            p_changes_description: `Erro ${resolved ? 'marcado como resolvido' : 'reaberto'}`,
            p_is_critical: false,
        });

        return apiSuccess({ error: updated[0] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/system/errors', operation: 'PUT' },
        });
    }
}
