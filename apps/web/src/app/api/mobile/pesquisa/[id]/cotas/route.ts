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

        let query = admin
            .from('survey_distribution_quotas')
            .select('interviewer_id, locality_id, zone, gender, age_group, quota_total, survey_localities(name)')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .order('locality_id', { ascending: true });

        if (member.role === 'interviewer') {
            query = query.eq('interviewer_id', ctx.userId);
        }

        const { data: quotas, error } = await query;
        if (error) return apiError(`Falha ao carregar cotas: ${error.message}`, 500);

        return apiSuccess({ role: member.role, quotas: quotas ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/pesquisa/[id]/cotas', operation: 'GET', surveyId: params.id },
        });
    }
}
