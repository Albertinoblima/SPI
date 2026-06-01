// GET /api/admin/tenants - Listar todos os tenants com estatísticas
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

export async function GET(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401, correlationId);
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
                .is('deleted_at', null)
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
            return trackedApiError(request, 'Erro ao buscar tenants', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/tenants' },
            });
        }

        // Enriquecer com estatísticas + Saúde (erros recentes)
        const tenantIds = tenants.map((t: Record<string, unknown>) => t['id']);

        // Busca agregada de erros não resolvidos nas últimas 24h (1 query eficiente)
        const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data: recentErrors } = await auth.supabase
            .from('error_logs')
            .select('tenant_id, severity')
            .in('tenant_id', tenantIds)
            .eq('resolved', false)
            .gte('created_at', since24h);

        // Agrega por tenant
        const healthByTenant = new Map<string, { critical: number; high: number; medium: number; lastErrorAt: string | null }>();
        (recentErrors ?? []).forEach((row: Record<string, unknown>) => {
            if (!row['tenant_id']) return;
            const tid = row['tenant_id'] as string;
            const current = healthByTenant.get(tid) || { critical: 0, high: 0, medium: 0, lastErrorAt: null };
            const sev = row['severity'] as string | undefined;
            if (sev === 'critical') current.critical += 1;
            else if (sev === 'high') current.high += 1;
            else if (sev === 'medium') current.medium += 1;
            // lastErrorAt pode ser refinado depois se necessário
            healthByTenant.set(tid, current);
        });

        const enrichedTenants = await Promise.all(
            tenants.map(async (tenant: Record<string, unknown>) => {
                const { data: stats } = await auth.supabase
                    .from('vw_tenant_stats')
                    .select('*')
                    .eq('tenant_id', tenant['id'])
                    .single();

                const health = healthByTenant.get(tenant['id'] as string) || { critical: 0, high: 0, medium: 0, lastErrorAt: null };

                return {
                    ...tenant,
                    stats: stats || {},
                    health: {
                        critical_24h: health.critical,
                        high_24h: health.high,
                        medium_24h: health.medium,
                        has_recent_issues: health.critical > 0 || health.high > 0,
                    },
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
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/tenants' },
        });
    }
}

// POST /api/admin/tenants - Bulk actions (Fase 1 - Ações em Massa God Mode)
export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401, correlationId);
    }

    try {
        const body = await request.json();
        const { action, tenantIds, status } = body as {
            action?: string;
            tenantIds?: string[];
            status?: 'active' | 'suspended' | 'trial';
        };

        if (!action || !Array.isArray(tenantIds) || tenantIds.length === 0) {
            return apiError('Parâmetros inválidos para ação em massa', 400, correlationId);
        }

        // Limite de segurança
        if (tenantIds.length > 100) {
            return apiError('Máximo de 100 tenants por operação em massa', 400, correlationId);
        }

        if (action === 'update_status') {
            if (!status || !['active', 'suspended', 'trial'].includes(status)) {
                return apiError('Status inválido. Use active, suspended ou trial.', 400);
            }

            // Buscar nomes atuais para auditoria rica
            const { data: currentTenants } = await auth.supabase
                .from('tenants')
                .select('id, name, status')
                .in('id', tenantIds);

            const currentMap = new Map((currentTenants ?? []).map((t: Record<string, unknown>) => [t['id'], t]));

            // Executar update
            const { error: updateError } = await auth.supabase
                .from('tenants')
                .update({ status, updated_at: new Date().toISOString() })
                .in('id', tenantIds)
                .is('deleted_at', null);

            if (updateError) {
                return trackedApiError(request, 'Falha ao aplicar status em massa', 500, {
                    errorCode: 'DB_BULK_UPDATE_FAILED',
                    userId: auth.user.id,
                    metadata: { action, tenantCount: tenantIds.length, targetStatus: status },
                });
            }

            // Auditoria individual por tenant (rastreabilidade máxima - padrão God Mode)
            const auditEntries = tenantIds.map((tid) => {
                const prev = currentMap.get(tid);
                return {
                    user_id: auth.user.id,
                    action: 'bulk_update_tenant_status',
                    entity_type: 'tenant',
                    entity_id: tid,
                    changes_description: `Status alterado de "${prev?.['status'] ?? 'unknown'}" para "${status}" via ação em massa`,
                    is_critical: status === 'suspended', // Suspensão é crítica
                    metadata: {
                        bulk_operation: true,
                        previous_status: prev?.['status'] ?? null,
                        new_status: status,
                        performed_by: auth.user.email ?? auth.user.id,
                    },
                };
            });

            await auth.supabase.from('audit_log').insert(auditEntries);

            return apiSuccess({
                success: true,
                affected: tenantIds.length,
                newStatus: status,
                message: `${tenantIds.length} empresa(s) atualizada(s) para "${status}" com sucesso`,
            });
        }

        return apiError(`Ação não suportada: ${action}`, 400, correlationId);
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/tenants', method: 'POST' },
        });
    }
}
