import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMobileAuthContext } from '@/lib/mobile/auth';

interface RouteParams {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getMobileAuthContext(request);
        if (!ctx) return apiError('Nao autenticado', 401);

        const admin = createAdminClient();

        const { data: member } = await admin
            .from('survey_team_members')
            .select('role')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('user_id', ctx.userId)
            .eq('is_active', true)
            .single();

        if (!member) return apiError('Usuario sem acesso a esta pesquisa', 403);

        const { data: routes, error } = await admin
            .from('survey_routes')
            .select('id, zone, route_number, route_name, survey_route_localities(locality_id, order_index, survey_localities(id, name, zone))')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .order('zone', { ascending: true })
            .order('route_number', { ascending: true });

        if (error) return apiError(`Falha ao carregar rotas: ${error.message}`, 500);

        return apiSuccess({ role: member.role, routes: routes ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/pesquisa/[id]/rotas', operation: 'GET', surveyId: params.id },
        });
    }
}
