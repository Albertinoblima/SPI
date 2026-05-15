// GET /api/admin/tenants/[id] - Detalhes de um tenant
// PUT /api/admin/tenants/[id] - Atualizar tenant (status, limites, etc)
// DELETE /api/admin/tenants/[id] - Exclusao logica (soft delete) de tenant
import { NextRequest } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const tenantId = params.id;

        // Buscar tenant
        const { data: tenant, error: tenantError } = await auth.supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .is('deleted_at', null)
            .single();

        if (tenantError || !tenant) {
            return apiError('Tenant não encontrado', 404);
        }

        // Buscar estatísticas
        const { data: stats } = await auth.supabase
            .from('vw_tenant_stats')
            .select('*')
            .eq('tenant_id', tenantId)
            .single();

        // Buscar usuários do tenant
        const { data: users } = await auth.supabase
            .from('users')
            .select('id, full_name, email, role, is_active, created_at')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false });

        // Buscar pesquisas recentes
        const { data: surveys } = await auth.supabase
            .from('surveys')
            .select('id, title, status, created_at, (select count(*) from responses where survey_id = id) as response_count')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(5);

        // Buscar erros recentes
        const { data: recentErrors } = await auth.supabase
            .from('error_logs')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .limit(5);

        return apiSuccess({
            tenant,
            stats,
            users: users ?? [],
            surveys: surveys ?? [],
            recentErrors: recentErrors ?? [],
        });
    } catch (error) {
        console.error('Erro ao buscar tenant:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const tenantId = params.id;
        const body = await request.json();
        const { status, max_users, max_surveys, storage_limit_mb, name } = body;

        // Validar status
        if (status && !['active', 'suspended', 'trial'].includes(status)) {
            return apiError('Status inválido', 400);
        }

        // Buscar tenant atual
        const { data: currentTenant } = await auth.supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .is('deleted_at', null)
            .single();

        if (!currentTenant) {
            return apiError('Tenant não encontrado', 404);
        }

        // Construir update payload
        const updatePayload: any = {};
        if (status !== undefined) updatePayload.status = status;
        if (max_users !== undefined) updatePayload.max_users = max_users;
        if (max_surveys !== undefined) updatePayload.max_surveys = max_surveys;
        if (storage_limit_mb !== undefined) updatePayload.storage_limit_mb = storage_limit_mb;
        if (name !== undefined) updatePayload.name = name;

        // Atualizar tenant
        const { data: updated, error: updateError } = await auth.supabase
            .from('tenants')
            .update(updatePayload)
            .eq('id', tenantId)
            .is('deleted_at', null)
            .select()
            .single();

        if (updateError) {
            return apiError('Erro ao atualizar tenant', 500);
        }

        // Registrar auditoria
        await auth.supabase.rpc('log_audit', {
            p_user_id: auth.user.id,
            p_tenant_id: null,
            p_action: 'tenant_updated',
            p_entity_type: 'tenant',
            p_entity_id: tenantId,
            p_old_values: JSON.stringify(currentTenant),
            p_new_values: JSON.stringify(updated),
            p_changes_description: `Tenant ${currentTenant.name} atualizado: ${Object.keys(updatePayload).join(', ')}`,
            p_is_critical: status === 'suspended',
        });

        // Se suspendeu, log como crítico
        if (status === 'suspended') {
            await auth.supabase.rpc('log_error', {
                p_tenant_id: tenantId,
                p_error_code: 'TENANT_SUSPENDED',
                p_error_message: `Tenant ${currentTenant.name} foi suspenso por ${auth.user.email}`,
                p_severity: 'high',
            });
        }

        return apiSuccess({ tenant: updated });
    } catch (error) {
        console.error('Erro ao atualizar tenant:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const tenantId = params.id;

        const { data: currentTenant, error: tenantError } = await auth.supabase
            .from('tenants')
            .select('*')
            .eq('id', tenantId)
            .is('deleted_at', null)
            .single();

        if (tenantError || !currentTenant) {
            return apiError('Tenant não encontrado', 404);
        }

        // Evita lockout acidental: system_admin nao pode excluir o proprio tenant.
        const { data: currentUserProfile } = await auth.supabase
            .from('users')
            .select('tenant_id')
            .eq('id', auth.user.id)
            .single();

        if (currentUserProfile?.tenant_id === tenantId) {
            return apiError('Não é permitido excluir a própria empresa vinculada ao seu usuário administrador do sistema.', 400);
        }

        const nowIso = new Date().toISOString();
        const { data: deletedTenant, error: deleteError } = await auth.supabase
            .from('tenants')
            .update({
                deleted_at: nowIso,
                status: 'suspended',
                updated_at: nowIso,
            })
            .eq('id', tenantId)
            .is('deleted_at', null)
            .select()
            .single();

        if (deleteError || !deletedTenant) {
            console.error('Erro ao excluir tenant:', deleteError);
            return apiError('Erro ao excluir tenant', 500);
        }

        // Auditoria e log de evento critico sem bloquear a operacao principal.
        try {
            await auth.supabase.rpc('log_audit', {
                p_user_id: auth.user.id,
                p_tenant_id: null,
                p_action: 'tenant_deleted',
                p_entity_type: 'tenant',
                p_entity_id: tenantId,
                p_old_values: JSON.stringify(currentTenant),
                p_new_values: JSON.stringify(deletedTenant),
                p_changes_description: `Tenant ${currentTenant.name} excluído logicamente por ${auth.user.email}`,
                p_is_critical: true,
            });

            await auth.supabase.rpc('log_error', {
                p_tenant_id: tenantId,
                p_error_code: 'TENANT_DELETED',
                p_error_message: `Tenant ${currentTenant.name} foi excluído logicamente por ${auth.user.email}`,
                p_severity: 'high',
            });
        } catch (logError) {
            console.warn('Falha ao registrar auditoria de exclusão de tenant:', logError);
        }

        return apiSuccess({
            message: 'Empresa excluída com sucesso',
            tenant: deletedTenant,
        });
    } catch (error) {
        console.error('Erro ao excluir tenant:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
