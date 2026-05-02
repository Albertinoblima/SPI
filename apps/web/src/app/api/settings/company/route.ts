// GET /api/settings/company - Retorna dados da empresa do tenant autenticado
// PUT /api/settings/company - Atualiza dados da empresa
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function GET() {
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
                max_users, max_surveys, storage_limit_mb
            `)
            .eq('id', userData.tenant_id)
            .single();

        if (tenantError || !tenant) return apiError('Empresa não encontrada', 404);

        return apiSuccess({ tenant });
    } catch (error) {
        console.error('GET /api/settings/company error:', error);
        return apiError('Erro interno do servidor', 500);
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

        // Atualiza apenas os campos existentes na tabela tenants.
        // Os campos de contato (cnpj, phone, address, etc.) serão salvos
        // após a migration 20260502_tenant_contact_fields.sql ser aplicada.
        const updateData: Record<string, unknown> = {
            name: name.trim(),
            updated_at: new Date().toISOString(),
        };

        // Inclui campos opcionais somente se a coluna existir (após migration)
        // Tenta incluir; PostgREST ignora campos desconhecidos com prefer=missing=default
        // Para segurança, tentamos update completo e capturamos PGRST204
        const fullUpdate = {
            ...updateData,
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
        };

        let updated: { id: string; name: string } | null = null;
        let updateError: { code?: string; message?: string } | null = null;

        // Primeiro tenta atualização completa (com colunas de contato)
        const fullResult = await supabase
            .from('tenants')
            .update(fullUpdate)
            .eq('id', userData.tenant_id)
            .select('id, name')
            .single();

        if (fullResult.error?.code === 'PGRST204') {
            // Colunas de contato ainda não existem — faz update parcial com campos básicos
            const partialResult = await supabase
                .from('tenants')
                .update(updateData)
                .eq('id', userData.tenant_id)
                .select('id, name')
                .single();
            updated = partialResult.data;
            updateError = partialResult.error;
        } else {
            updated = fullResult.data;
            updateError = fullResult.error;
        }

        return apiSuccess({ tenant: updated, message: 'Dados atualizados com sucesso' });
    } catch (error) {
        console.error('PUT /api/settings/company error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
