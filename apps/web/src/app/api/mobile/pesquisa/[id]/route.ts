import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient, checkRateLimit, adminRateLimitKey } from '@political-research/shared-utils';
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

        // Fase 2 rate limiting for mobile data sync
        const rateKey = adminRateLimitKey('mobile', 'pesquisa-data');
        if (!checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 30 })) {
            return apiError('Limite de sincronização excedido.', 429, correlationId);
        }

        const admin = createAuditedSupabaseAdminClient('mobile-pesquisa-data');

        const { data: survey, error: surveyError } = await admin
            .from('surveys')
            .select('id, tenant_id, title, description, status, requires_geolocation, requires_photo, requires_signature, allow_offline, published_at, updated_at, questions(*), survey_premises(*)')
            .eq('id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('status', 'published')
            .is('deleted_at', null)
            .single();

        if (surveyError || !survey) return apiError('Pesquisa nao encontrada ou nao publicada', 404, correlationId);

        const { data: teamMembership } = await admin
            .from('survey_team_members')
            .select('role')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('user_id', ctx.userId)
            .eq('is_active', true)
            .single();

        if (!teamMembership) {
            return apiError('Usuario sem permissao nesta pesquisa', 403, correlationId);
        }

        const baseRoutesQuery = admin
            .from('survey_routes')
            .select('id, zone, route_number, route_name, survey_route_localities(locality_id, order_index, survey_localities(id, name, zone))')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId);

        const { data: routes } = await baseRoutesQuery;

        let quotasQuery = admin
            .from('survey_distribution_quotas')
            .select('interviewer_id, locality_id, zone, gender, age_group, quota_total, survey_localities(name)')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId);

        if (teamMembership.role === 'interviewer') {
            quotasQuery = quotasQuery.eq('interviewer_id', ctx.userId);
        }

        const { data: quotas } = await quotasQuery;

        // === POLISH 100%: Real collected counts from interviews table (ponta a ponta) ===
        let quotasWithCounts = (quotas ?? []) as Array<Record<string, unknown>>;

        if (quotasWithCounts.length > 0) {
            // Fetch completed/synced interviews for this survey + current user (interviewer scoped)
            const interviewFilter = teamMembership.role === 'interviewer'
                ? { interviewer_id: ctx.userId }
                : {};

            const { data: interviews } = await admin
                .from('interviews')
                .select('locality_id, status')
                .eq('survey_id', params.id)
                .eq('tenant_id', ctx.tenantId)
                .match(interviewFilter)
                .in('status', ['completed', 'synced']);

            // Aggregate collected per locality_id (sum across any strata)
            const collectedByLocality: Record<string, number> = {};
            (interviews ?? []).forEach((iv: { locality_id?: string }) => {
                if (iv.locality_id) {
                    collectedByLocality[iv.locality_id] = (collectedByLocality[iv.locality_id] || 0) + 1;
                }
            });

            // Attach collected_count + remaining to each quota row (for mobile UI)
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

        return apiSuccess({
            survey,
            role: teamMembership.role,
            routes: routes ?? [],
            quotas: quotasWithCounts,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/pesquisa/[id]', operation: 'GET', surveyId: params.id },
        });
    }
}
