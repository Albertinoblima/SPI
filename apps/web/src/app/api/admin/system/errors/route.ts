// GET /api/admin/system/errors - Listar erros do sistema
import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error, auth.status);
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const severity = searchParams.get('severity');
        const resolved = searchParams.get('resolved') === 'true' ? true : false;
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

        if (resolved !== undefined) {
            query = query.eq('resolved', resolved);
        }

        const { data: errors, count, error: fetchError } = await query
            .range(offset, offset + pageSize - 1);

        if (fetchError) {
            return apiError('Erro ao buscar logs de erro', 500);
        }

        return apiSuccess({
            errors,
            pagination: {
                page,
                pageSize,
                total: count,
                totalPages: Math.ceil((count || 0) / pageSize),
            },
        });
    } catch (error) {
        console.error('Erro ao buscar logs de erro:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

// PUT /api/admin/system/errors/:id - Resolver erro
export async function PUT(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error, auth.status);
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
            return apiError('Erro ao atualizar log de erro', 500);
        }

        // Log da ação na auditoria
        await auth.supabase.rpc('log_audit', {
            p_user_id: auth.user.id,
            p_tenant_id: null,
            p_action: 'error_resolved',
            p_entity_type: 'error_log',
            p_entity_id: id,
            p_changes_description: `Erro ${resolved ? 'marcado como resolvido' : 'reabertu'}`,
            p_is_critical: false,
        });

        return apiSuccess({ error: updated[0] });
    } catch (error) {
        console.error('Erro ao atualizar erro:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
