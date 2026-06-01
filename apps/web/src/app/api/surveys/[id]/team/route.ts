import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import { getSurveyAuthContext, surveyBelongsToTenant } from '@/lib/surveys/auth-context';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

interface RouteParams {
    params: { id: string };
}

const ROLE_MAP: Record<string, 'coordinator' | 'supervisor' | 'interviewer' | null> = {
    coordinator: 'coordinator',
    coordinator_general: 'coordinator',
    coordinator_field: 'coordinator',
    supervisor: 'supervisor',
    supervisor_quality: 'supervisor',
    interviewer: 'interviewer',
};

export async function GET(request: NextRequest, { params }: RouteParams) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401, correlationId);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404, correlationId);

        const admin = createAuditedSupabaseAdminClient('survey-team');
        const { data: members, error } = await admin
            .from('survey_team_members')
            .select('id, user_id, role, is_active, created_at, users!inner(id, full_name, email, role, is_active)')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .order('created_at', { ascending: true });

        if (error) return apiError(`Falha ao consultar equipe: ${error.message}`, 500, correlationId);

        return apiSuccess({ survey, members: members ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/team', operation: 'GET', surveyId: params.id },
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
            return apiError('Pesquisa publicada esta em coleta e nao pode mais alterar equipe.', 400, correlationId);
        }

        const body = await request.json();
        const members = Array.isArray(body?.membros) ? body.membros : [];

        if (members.length === 0) {
            return apiError('Informe ao menos um membro para a equipe', 400, correlationId);
        }

        const mapped = members
            .map((m: Record<string, unknown>) => {
                const userId = String(m['usuario_id'] ?? '').trim();
                const role = String(m['papel'] ?? '').trim();
                if (!userId || !role) return null;
                return { userId, role };
            })
            .filter(Boolean) as Array<{ userId: string; role: string }>;

        if (mapped.length === 0) {
            return apiError('Corpo invalido. Use { membros: [{ usuario_id, papel }] }', 400);
        }

        const interviewersCount = mapped.filter((m) => m.role === 'interviewer').length;
        if (interviewersCount < 1) {
            return apiError('Selecione ao menos um entrevistador para avancar', 400, correlationId);
        }

        const admin = createAuditedSupabaseAdminClient('survey-team');
        const userIds = mapped.map((m) => m.userId);

        const { data: users, error: userError } = await admin
            .from('users')
            .select('id, role, tenant_id, is_active')
            .in('id', userIds)
            .eq('tenant_id', ctx.tenantId);

        if (userError) return apiError(`Falha ao validar usuarios: ${userError.message}`, 500, correlationId);
        if (!users || users.length !== userIds.length) {
            return apiError('Existem usuarios invalidos para este tenant', 400, correlationId);
        }

        const byId = new Map(users.map((u) => [u.id, u]));
        const rows = mapped.map((member) => {
            const user = byId.get(member.userId)!;
            const fallbackRole = ROLE_MAP[user.role] ?? 'interviewer';
            const finalRole = member.role === 'auto' ? fallbackRole : member.role;

            if (!['coordinator', 'supervisor', 'interviewer'].includes(finalRole)) {
                throw new Error(`Papel invalido para membro ${member.userId}`);
            }

            return {
                survey_id: params.id,
                tenant_id: ctx.tenantId,
                user_id: member.userId,
                role: finalRole,
                is_active: user.is_active ?? true,
            };
        });

        await admin.from('survey_team_members').delete().eq('survey_id', params.id).eq('tenant_id', ctx.tenantId);

        const { data: created, error: insertError } = await admin
            .from('survey_team_members')
            .insert(rows)
            .select('id, user_id, role, is_active');

        if (insertError) return apiError(`Falha ao salvar equipe: ${insertError.message}`, 500, correlationId);

        return apiSuccess({ members: created ?? [] });
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Papel invalido')) {
            return apiError(error.message, 400, correlationId);
        }

        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/team', operation: 'POST', surveyId: params.id },
        });
    }
}
