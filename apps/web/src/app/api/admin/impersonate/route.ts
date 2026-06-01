// GET /api/admin/impersonate/status - Verifica se o usuário atual está em modo impersonation
export async function GET(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError('Não autorizado', 401, correlationId);
    }

    try {
        const { data: activeSession } = await auth.supabase
            .from('admin_impersonation_sessions')
            .select(`
                target_tenant_id,
                tenants!inner(name)
            `)
            .eq('admin_user_id', auth.user.id)
            .eq('is_active', true)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!activeSession) {
            return apiSuccess({ isImpersonating: false });
        }

        return apiSuccess({
            isImpersonating: true,
            tenantId: activeSession.target_tenant_id,
            tenantName: ((activeSession as Record<string, unknown>)['tenants'] as { name?: string })?.name || 'Tenant desconhecido',
        });
    } catch (error) {
        return apiSuccess({ isImpersonating: false });
    }
}

// POST /api/admin/impersonate
// Inicia ou encerra uma sessão de impersonation para um tenant específico.
// Apenas system_admins podem usar.
//
// Fase 2 RLS Review: A tabela admin_impersonation_sessions deve ter RLS rigoroso:
// - SELECT/INSERT/UPDATE apenas para system_admins (is_system_admin = true).
// - Políticas devem impedir que tenant admins vejam ou manipulem sessões de outros tenants.
// - Verificar com pgTAP ou testes de RLS em CI.

import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils/src/supabase/admin-client';
import { checkRateLimit, adminRateLimitKey, logAdminAction } from '@political-research/shared-utils';

export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        const errMsg = auth.error ?? 'Não autorizado';
        const errStatus = auth.status ?? 401;
        return apiError(errMsg, errStatus, correlationId);
    }

    // Fase 2: Strict rate limiting + audit for impersonation (high privilege operation)
    const rateKey = adminRateLimitKey(auth.user.id, 'impersonate');
    if (!checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 5 })) {
        return apiError('Limite de operações de impersonação excedido.', 429, correlationId);
    }

    logAdminAction({
        action: 'impersonation_attempt',
        userId: auth.user.id,
        metadata: { route: 'admin/impersonate' },
    });

    try {
        const body = await request.json();
        const { action, tenantId } = body;

        if (!action || !['start', 'exit'].includes(action)) {
            return apiError('Ação inválida. Use "start" ou "exit".', 400, correlationId);
        }

        const adminUserId = auth.user.id;

        if (action === 'start') {
            if (!tenantId) {
                return apiError('tenantId é obrigatório para iniciar impersonation.', 400, correlationId);
            }

            // Verifica se o tenant existe
            const { data: tenant, error: tenantError } = await auth.supabase
                .from('tenants')
                .select('id, name, status')
                .eq('id', tenantId)
                .single();

            if (tenantError || !tenant) {
                return apiError('Tenant não encontrado.', 404, correlationId);
            }

            if (tenant.status !== 'active') {
                return apiError('Não é possível impersonar tenants inativos ou suspensos.', 400, correlationId);
            }

            // Cria nova sessão de impersonation (o trigger desativa as anteriores automaticamente)
            const { data: session, error: insertError } = await auth.supabase
                .from('admin_impersonation_sessions')
                .insert({
                    admin_user_id: adminUserId,
                    target_tenant_id: tenantId,
                    ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
                    user_agent: request.headers.get('user-agent') || 'unknown',
                })
                .select()
                .single();

            if (insertError) {
                return trackedApiError(request, 'Falha ao iniciar impersonation', 500, {
                    errorCode: 'DB_INSERT_FAILED',
                    userId: adminUserId,
                    metadata: { route: '/api/admin/impersonate', tenantId },
                });
            }

            // Log explícito no audit_log
            await auth.supabase.from('audit_log').insert({
                user_id: adminUserId,
                tenant_id: tenantId,
                action: 'start_impersonation',
                entity_type: 'tenant',
                entity_id: tenantId,
                changes_description: `System admin iniciou impersonation no tenant: ${tenant.name}`,
                is_critical: true,
            });

            return apiSuccess({
                success: true,
                message: `Impersonation iniciada no tenant: ${tenant.name}`,
                session: {
                    id: session.id,
                    tenant_id: tenantId,
                    tenant_name: tenant.name,
                    started_at: session.started_at,
                },
            });
        }

        // action === 'exit'
        const { data: activeSession } = await auth.supabase
            .from('admin_impersonation_sessions')
            .select('id, target_tenant_id')
            .eq('admin_user_id', adminUserId)
            .eq('is_active', true)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (activeSession) {
            await auth.supabase
                .from('admin_impersonation_sessions')
                .update({
                    is_active: false,
                    ended_at: new Date().toISOString(),
                })
                .eq('id', activeSession.id);

            await auth.supabase.from('audit_log').insert({
                user_id: adminUserId,
                tenant_id: activeSession.target_tenant_id,
                action: 'end_impersonation',
                entity_type: 'tenant',
                entity_id: activeSession.target_tenant_id,
                changes_description: 'System admin encerrou sessão de impersonation',
                is_critical: true,
            });
        }

        return apiSuccess({
            success: true,
            message: 'Impersonation encerrada com sucesso.',
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/impersonate' },
        });
    }
}

