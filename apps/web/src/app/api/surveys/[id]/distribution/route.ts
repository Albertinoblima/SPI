import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import { getSurveyAuthContext, surveyBelongsToTenant } from '@/lib/surveys/auth-context';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

interface RouteParams {
    params: { id: string };
}

type DistributionInput = {
    entrevistadores?: Array<{ usuario_id: string }>;
};

type Cell = {
    locality_id: string;
    zone: 'urban' | 'rural' | 'mixed';
    gender: string;
    age_group: string;
    quota_total: number;
};

function normalizeLabel(value: string) {
    return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function splitEqually(total: number, count: number) {
    const base = Math.floor(total / count);
    let remainder = total % count;
    return Array.from({ length: count }, (_, idx) => {
        const extra = remainder > 0 ? 1 : 0;
        if (remainder > 0) remainder -= 1;
        return { index: idx, quota: base + extra };
    });
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401, correlationId);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404, correlationId);

        const admin = createAuditedSupabaseAdminClient('survey-distribution');
        const { data: rows, error } = await admin
            .from('survey_distribution_quotas')
            .select('interviewer_id, locality_id, zone, gender, age_group, quota_total, users!inner(id, full_name), survey_localities!inner(id, name)')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .order('interviewer_id', { ascending: true });

        if (error) return apiError(`Falha ao carregar distribuicao: ${error.message}`, 500, correlationId);

        return apiSuccess({ distribution: rows ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/distribution', operation: 'GET', surveyId: params.id },
        });
    }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401, correlationId);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404, correlationId);
        if (survey.status === 'published') {
            return apiError('Pesquisa publicada esta em coleta e nao pode mais alterar distribuicao.', 400, correlationId);
        }

        const body: DistributionInput = await request.json();
        const admin = createAuditedSupabaseAdminClient('survey-distribution');

        const providedInterviewers = body.entrevistadores?.map((i) => i.usuario_id).filter(Boolean) ?? [];

        let interviewerIds = providedInterviewers;
        if (interviewerIds.length === 0) {
            const { data: teamRows } = await admin
                .from('survey_team_members')
                .select('user_id')
                .eq('survey_id', params.id)
                .eq('tenant_id', ctx.tenantId)
                .eq('role', 'interviewer')
                .eq('is_active', true);
            interviewerIds = (teamRows ?? []).map((m) => m.user_id);
        }

        if (interviewerIds.length === 0) {
            return apiError('Nao ha entrevistadores selecionados na etapa de equipe', 400, correlationId);
        }

        const { data: localities } = await admin
            .from('survey_localities')
            .select('id, zone, interviews_required')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .order('name', { ascending: true });

        if (!localities || localities.length === 0) {
            return apiError('Nao ha localidades para distribuir', 400, correlationId);
        }

        const { data: premises } = await admin
            .from('survey_premises')
            .select('category, options')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId);

        const genderPremise = (premises ?? []).find((p) => normalizeLabel(p.category ?? '') === 'sexo');
        const agePremise = (premises ?? []).find((p) => normalizeLabel(p.category ?? '') === 'faixa_etaria');

        const genderOptions = Array.isArray(genderPremise?.options) && genderPremise.options.length > 0
            ? genderPremise.options
            : [{ label: 'M', quota_pct: 50 }, { label: 'F', quota_pct: 50 }];

        const ageOptions = Array.isArray(agePremise?.options) && agePremise.options.length > 0
            ? agePremise.options
            : [
                { label: '1a', quota_pct: 34 },
                { label: '2a', quota_pct: 33 },
                { label: '3a', quota_pct: 33 },
            ];

        const cells: Cell[] = [];

        localities.forEach((locality) => {
            const totalLocality = Math.max(0, Number(locality.interviews_required ?? 0));
            const withFallback = totalLocality > 0 ? totalLocality : Math.ceil(Number(survey.total_interviews ?? 0) / localities.length);

            genderOptions.forEach((gender) => {
                ageOptions.forEach((age) => {
                    const genderPct = Number(gender.quota_pct ?? 100 / genderOptions.length);
                    const agePct = Number(age.quota_pct ?? 100 / ageOptions.length);
                    const quota = Math.round(withFallback * (genderPct / 100) * (agePct / 100));

                    cells.push({
                        locality_id: locality.id,
                        zone: locality.zone,
                        gender: String(gender.label ?? '-'),
                        age_group: String(age.label ?? '-'),
                        quota_total: Math.max(0, quota),
                    });
                });
            });
        });

        const rows = cells.flatMap((cell) => {
            const split = splitEqually(cell.quota_total, interviewerIds.length);
            return split
                .filter((part) => part.quota > 0)
                .map((part) => ({
                    survey_id: params.id,
                    tenant_id: ctx.tenantId,
                    interviewer_id: interviewerIds[part.index],
                    locality_id: cell.locality_id,
                    zone: cell.zone,
                    gender: cell.gender,
                    age_group: cell.age_group,
                    quota_total: part.quota,
                }));
        });

        await admin.from('survey_distribution_quotas').delete().eq('survey_id', params.id).eq('tenant_id', ctx.tenantId);

        if (rows.length > 0) {
            const { error: insertError } = await admin.from('survey_distribution_quotas').insert(rows);
            if (insertError) {
                return apiError(`Falha ao salvar distribuicao: ${insertError.message}`, 500, correlationId);
            }
        }

        return apiSuccess({
            interviewers: interviewerIds.length,
            distribution_rows: rows.length,
            generated_cells: cells.length,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/distribution', operation: 'POST', surveyId: params.id },
        });
    }
}
