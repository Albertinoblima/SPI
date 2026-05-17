// GET /api/settings/company - Retorna dados da empresa do tenant autenticado
// PUT /api/settings/company - Atualiza dados da empresa
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (userError || !userData) return apiError('Usuário não encontrado', 404);

        const { data: tenant, error: tenantError } = await supabase
            .from('tenants')
            .select(`
                id, name, slug, status,
                cnpj, phone, email, website, logo_url,
                address, address_number, address_complement, neighborhood,
                city, state, zip_code, responsavel_tecnico,
                max_users, max_surveys, storage_limit_mb
            `)
            .eq('id', userData.tenant_id)
            .single();

        if (tenantError || !tenant) return apiError('Empresa não encontrada', 404);

        return apiSuccess({ tenant });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/settings/company', operation: 'GET' },
        });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (userError || !userData) return apiError('Usuário não encontrado', 404);
        if (!['admin', 'manager'].includes(userData.role)) {
            return apiError('Sem permissão para alterar dados da empresa', 403);
        }

        const body = await request.json();
        const {
            name, cnpj, phone, email, website,
            address, address_number, address_complement, neighborhood,
            city, state, zip_code, responsavel_tecnico,
        } = body;

        if (!name?.trim()) return apiError('Nome da empresa é obrigatório', 400);

        const { data: updated, error: updateError } = await supabase
            .from('tenants')
            .update({
                name: name.trim(),
                cnpj: cnpj?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
                website: website?.trim() || null,
                address: address?.trim() || null,
                address_number: address_number?.trim() || null,
                address_complement: address_complement?.trim() || null,
                neighborhood: neighborhood?.trim() || null,
                city: city?.trim() || null,
                state: state?.trim() || null,
                zip_code: zip_code?.trim() || null,
                responsavel_tecnico: responsavel_tecnico?.trim() || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', userData.tenant_id)
            .select('id, name')
            .single();

        if (updateError) {
            return trackedApiError(request, 'Erro ao atualizar dados da empresa', 500, {
                errorCode: 'DB_WRITE_FAILED',
                userId: user.id,
                tenantId: userData.tenant_id,
                metadata: { route: '/api/settings/company', operation: 'PUT' },
            });
        }

        return apiSuccess({ tenant: updated, message: 'Dados atualizados com sucesso' });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/settings/company', operation: 'PUT' },
        });
    }
}
