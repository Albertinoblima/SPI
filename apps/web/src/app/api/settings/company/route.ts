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
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const { supabase, applyCookies } = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!user || authError) return applyCookies(apiError('Não autenticado', 401, correlationId));

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (userError || !userData) return applyCookies(apiError('Usuário não encontrado', 404, correlationId));

        const { data: tenantWithTradeName, error: tenantError } = await supabase
            .from('tenants')
            .select(`
                id, name, slug, status,
                nome_fantasia, cnpj, phone, email, website, logo_url,
                address, address_number, address_complement, neighborhood,
                city, state, zip_code, responsavel_tecnico,
                max_users, max_surveys, storage_limit_mb
            `)
            .eq('id', userData.tenant_id)
            .single();

        if (tenantError?.code === 'PGRST204') {
            const { data: tenantLegacy, error: tenantLegacyError } = await supabase
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

            if (tenantLegacyError || !tenantLegacy) return applyCookies(apiError('Empresa não encontrada', 404, correlationId));
            return applyCookies(apiSuccess({ tenant: { ...tenantLegacy, nome_fantasia: null } }));
        }

        if (tenantError || !tenantWithTradeName) return applyCookies(apiError('Empresa não encontrada', 404, correlationId));

        return applyCookies(apiSuccess({ tenant: tenantWithTradeName }));
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/settings/company', operation: 'GET' },
        });
    }
}

export async function PUT(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const { supabase, applyCookies } = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (!user || authError) return applyCookies(apiError('Não autenticado', 401, correlationId));

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (userError || !userData) return applyCookies(apiError('Usuário não encontrado', 404, correlationId));
        if (!['admin', 'manager'].includes(userData.role)) {
            return applyCookies(apiError('Sem permissão para alterar dados da empresa', 403, correlationId));
        }

        const body = await request.json();
        const {
            name, nome_fantasia, cnpj, phone, email, website,
            address, address_number, address_complement, neighborhood,
            city, state, zip_code, responsavel_tecnico,
        } = body;

        if (!name?.trim()) return applyCookies(apiError('Nome da empresa é obrigatório', 400, correlationId));

        const payload = {
            name: name.trim(),
            nome_fantasia: nome_fantasia?.trim() || null,
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
        };

        const { data: updated, error: updateError } = await supabase
            .from('tenants')
            .update(payload)
            .eq('id', userData.tenant_id)
            .select('id, name')
            .single();

        if (updateError?.code === 'PGRST204') {
            const { nome_fantasia: _ignored, ...legacyPayload } = payload;
            const { data: updatedLegacy, error: updateLegacyError } = await supabase
                .from('tenants')
                .update(legacyPayload)
                .eq('id', userData.tenant_id)
                .select('id, name')
                .single();

            if (updateLegacyError || !updatedLegacy) {
                return applyCookies(await trackedApiError(request, 'Erro ao atualizar dados da empresa', 500, {
                    errorCode: 'DB_WRITE_FAILED',
                    userId: user.id,
                    tenantId: userData.tenant_id,
                    metadata: { route: '/api/settings/company', operation: 'PUT', mode: 'legacy-fallback' },
                }));
            }

            return applyCookies(apiSuccess({ tenant: updatedLegacy, message: 'Dados atualizados com sucesso' }));
        }

        if (updateError) {
            return applyCookies(await trackedApiError(request, 'Erro ao atualizar dados da empresa', 500, {
                errorCode: 'DB_WRITE_FAILED',
                userId: user.id,
                tenantId: userData.tenant_id,
                metadata: { route: '/api/settings/company', operation: 'PUT' },
            }));
        }

        return applyCookies(apiSuccess({ tenant: updated, message: 'Dados atualizados com sucesso' }));
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/settings/company', operation: 'PUT' },
        });
    }
}
