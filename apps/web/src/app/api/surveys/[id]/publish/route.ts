import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSurveyAuthContext, surveyBelongsToTenant } from '@/lib/surveys/auth-context';

interface RouteParams {
    params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404);
        if (survey.status === 'published') {
            return apiSuccess({
                survey_id: params.id,
                status: 'published',
                published_at: survey.published_at,
                notified_users: 0,
                message: 'Pesquisa ja estava publicada.',
            });
        }

        const admin = createAdminClient();

        const { data: interviewers } = await admin
            .from('survey_team_members')
            .select('user_id')
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('role', 'interviewer')
            .eq('is_active', true);

        if (!interviewers || interviewers.length === 0) {
            return apiError('A pesquisa precisa ter ao menos um entrevistador antes da publicacao', 400);
        }

        const { data: routesCount } = await admin
            .from('survey_routes')
            .select('id', { count: 'exact', head: true })
            .eq('survey_id', params.id)
            .eq('tenant_id', ctx.tenantId);

        if ((routesCount as unknown as { count?: number })?.count === 0) {
            return apiError('Configure as rotas antes de publicar a pesquisa', 400);
        }

        const nowIso = new Date().toISOString();
        const { error: surveyUpdateError } = await admin
            .from('surveys')
            .update({ status: 'published', published_at: nowIso, updated_at: nowIso })
            .eq('id', params.id)
            .eq('tenant_id', ctx.tenantId);

        if (surveyUpdateError) {
            return apiError(`Falha ao publicar pesquisa: ${surveyUpdateError.message}`, 500);
        }

        const notificationRows = interviewers.map((member) => ({
            type: 'system',
            title: 'Pesquisa publicada',
            message: `A pesquisa ${survey.title} esta disponivel para coleta no aplicativo mobile.`,
            target_type: 'user',
            tenant_id: ctx.tenantId,
            user_id: member.user_id,
            created_by: ctx.userId,
            data: { survey_id: params.id, event: 'survey_published' },
        }));

        await admin.from('notifications').insert(notificationRows);

        return apiSuccess({
            survey_id: params.id,
            status: 'published',
            published_at: nowIso,
            notified_users: notificationRows.length,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/publish', operation: 'POST', surveyId: params.id },
        });
    }
}
