import { NextRequest } from 'next/server';
import { apiError, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { getSurveyAuthContext, surveyBelongsToTenant } from '@/lib/surveys/auth-context';
import { buildQuestionnaireHtml } from '@/lib/surveys/documents';

interface RouteParams {
    params: { id: string };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getSurveyAuthContext();
        if (!ctx) return apiError('Nao autenticado', 401);

        const survey = await surveyBelongsToTenant(params.id, ctx.tenantId);
        if (!survey) return apiError('Pesquisa nao encontrada', 404);

        const admin = createAdminClient();
        const { data, error } = await admin
            .from('surveys')
            .select('title, started_at, users!surveys_created_by_fkey(full_name), questions(*), survey_premises(*)')
            .eq('id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .single();

        if (error || !data) {
            return apiError(`Falha ao montar questionario: ${error?.message ?? 'desconhecido'}`, 500);
        }

        const usersRelation = data.users as { full_name?: string } | Array<{ full_name?: string }> | null;

        const html = buildQuestionnaireHtml({
            title: data.title,
            started_at: data.started_at,
            created_by_name: (Array.isArray(usersRelation) ? usersRelation[0]?.full_name : usersRelation?.full_name) ?? null,
            questions: data.questions ?? [],
            premises: data.survey_premises ?? [],
        });

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-store',
            },
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/surveys/[id]/questionnaire/preview', operation: 'GET', surveyId: params.id },
        });
    }
}
