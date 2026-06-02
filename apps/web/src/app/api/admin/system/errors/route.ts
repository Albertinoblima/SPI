// GET /api/admin/system/errors - Listar erros do sistema
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    handleApiUnhandledError,
    trackedApiError,
} from '@/lib/api-middleware';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

export async function GET(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return (auth.applyCookies || ((r: any) => r))(apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401, correlationId));
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const severity = searchParams.get('severity');
        const resolvedQuery = searchParams.get('resolved');
        const search = searchParams.get('search')?.trim();
        const tenantId = searchParams.get('tenant_id');
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

        if (tenantId) {
            query = query.eq('tenant_id', tenantId);
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

        // Summary: se filtrando por tenant, mostra contagens daquele tenant; senão, globais
        let openQuery = auth.supabase
            .from('error_logs')
            .select('*', { count: 'exact', head: true })
            .eq('resolved', false);

        let criticalQuery = auth.supabase
            .from('error_logs')
            .select('*', { count: 'exact', head: true })
            .eq('resolved', false)
            .eq('severity', 'critical');

        if (tenantId) {
            openQuery = openQuery.eq('tenant_id', tenantId);
            criticalQuery = criticalQuery.eq('tenant_id', tenantId);
        }

        const [{ count: openCount }, { count: criticalCount }] = await Promise.all([
            openQuery,
            criticalQuery,
        ]);

        return auth.applyCookies(apiSuccess({
            errors,
            summary: {
                openCount: openCount ?? 0,
                criticalOpenCount: criticalCount ?? 0,
                filteredByTenant: !!tenantId,
            },
            pagination: {
                page,
                pageSize,
                total: count,
                totalPages: Math.ceil((count || 0) / pageSize),
            },
        }));
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
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return (auth.applyCookies || ((r: any) => r))(apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401, correlationId));
    }

    try {
        const body = await request.json();
        const { id, resolved, resolution_notes } = body;

        if (!id) {
            return apiError('ID do erro é obrigatório', 400, correlationId);
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

        return auth.applyCookies(apiSuccess({ error: updated[0] }));
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/system/errors', operation: 'PUT' },
        });
    }
}

// POST /api/admin/system/errors - Bulk actions (Fase 1 - Ações em Massa God Mode)
export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return (auth.applyCookies || ((r: any) => r))(apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401, correlationId));
    }

    try {
        const body = await request.json();
        const { action, errorIds, resolved } = body as {
            action?: string;
            errorIds?: string[];
            resolved?: boolean;
        };

        if (!action || !Array.isArray(errorIds) || errorIds.length === 0) {
            return apiError('Parâmetros inválidos para ação em massa', 400, correlationId);
        }

        if (errorIds.length > 200) {
            return apiError('Máximo de 200 erros por operação em massa', 400, correlationId);
        }

        if (action === 'mark_resolved') {
            if (typeof resolved !== 'boolean') {
                return apiError('Campo "resolved" (boolean) é obrigatório', 400, correlationId);
            }

            // Buscar códigos para auditoria
            const { data: currentErrors } = await auth.supabase
                .from('error_logs')
                .select('id, error_code, severity')
                .in('id', errorIds);

            const currentMap = new Map((currentErrors ?? []).map((e: Record<string, unknown>) => [e['id'], e]));

            // Update em lote (eficiente)
            const { error: updateError } = await auth.supabase
                .from('error_logs')
                .update({
                    resolved,
                    resolved_at: resolved ? new Date().toISOString() : null,
                })
                .in('id', errorIds);

            if (updateError) {
                return trackedApiError(request, 'Falha ao aplicar bulk resolve em erros', 500, {
                    errorCode: 'DB_BULK_UPDATE_FAILED',
                    userId: auth.user.id,
                    metadata: { action, count: errorIds.length, resolved },
                });
            }

            // Auditoria individual (padrão God Mode + rastreabilidade)
            const auditEntries = errorIds.map((eid) => {
                const curr = currentMap.get(eid);
                return {
                    user_id: auth.user.id,
                    action: 'bulk_error_resolve',
                    entity_type: 'error_log',
                    entity_id: eid,
                    changes_description: `Erro ${(curr as Record<string, unknown> | undefined)?.['error_code'] ?? eid} ${resolved ? 'marcado como resolvido' : 'reaberto'} via bulk`,
                    is_critical: (curr as Record<string, unknown> | undefined)?.['severity'] === 'critical',
                    metadata: {
                        bulk_operation: true,
                        error_code: (curr as Record<string, unknown> | undefined)?.['error_code'] ?? null,
                        previous_resolved: !resolved,
                        new_resolved: resolved,
                        performed_by: auth.user.email ?? auth.user.id,
                    },
                };
            });

            await auth.supabase.from('audit_log').insert(auditEntries);

            return auth.applyCookies(apiSuccess({
                success: true,
                affected: errorIds.length,
                resolved,
                message: `${errorIds.length} erro(s) ${resolved ? 'marcado(s) como resolvido(s)' : 'reaberto(s)'} com sucesso`,
            }));
        }

        return apiError(`Ação não suportada: ${action}`, 400, correlationId);
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/system/errors', method: 'POST' },
        });
    }
}
