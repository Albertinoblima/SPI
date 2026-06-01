import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import { getMobileAuthContext } from '@/lib/mobile/auth';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

interface RouteParams {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const ctx = await getMobileAuthContext(request);
        if (!ctx) return apiError('Nao autenticado', 401, correlationId);

        const admin = createAuditedSupabaseAdminClient('mobile-cotas');

        const { data: member } = await admin
            .from('survey_team_members')
            .select('role')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('user_id', ctx.userId)
            .eq('is_active', true)
            .single();

        if (!member) return apiError('Usuario sem acesso a esta pesquisa', 403, correlationId);

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
        if (error) return apiError(`Falha ao carregar cotas: ${error.message}`, 500, correlationId);

        // === POLISH 100%: Real collected counts (same logic as main bundle) ===
        let quotasWithCounts = (quotas ?? []) as Array<Record<string, unknown>>;

        if (quotasWithCounts.length > 0) {
            const interviewFilter = member.role === 'interviewer' ? { interviewer_id: ctx.userId } : {};
            const { data: interviews } = await admin
                .from('interviews')
                .select('locality_id, status')
                .eq('survey_id', params.id)
                .eq('tenant_id', ctx.tenantId)
                .match(interviewFilter)
                .in('status', ['completed', 'synced']);

            const collectedByLocality: Record<string, number> = {};
            (interviews ?? []).forEach((iv: { locality_id?: string }) => {
                if (iv.locality_id) {
                    collectedByLocality[iv.locality_id] = (collectedByLocality[iv.locality_id] || 0) + 1;
                }
            });

            quotasWithCounts = quotasWithCounts.map((q: Record<string, unknown>) => {
                const locId = q['locality_id'] as string | undefined;
                const collected = locId ? (collectedByLocality[locId] || 0) : 0;
                return {
                    ...q,
                    collected_count: collected,
                    remaining: Math.max(0, ((q['quota_total'] as number) || 0) - collected),
                };
            });
        }

        return apiSuccess({ role: member.role, quotas: quotasWithCounts });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/pesquisa/[id]/cotas', operation: 'GET', surveyId: params.id },
        });
    }
}
