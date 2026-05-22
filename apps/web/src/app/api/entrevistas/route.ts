import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMobileAuthContext } from '@/lib/mobile/auth';

type InterviewPayload = {
    survey_id: string;
    localidade_id?: string | null;
    horario_inicio: string;
    horario_fim?: string | null;
    latitude_inicio?: number | null;
    longitude_inicio?: number | null;
    assinatura_nome?: string | null;
    status?: 'in_progress' | 'completed' | 'synced';
    respostas?: Array<{ question_id: string; resposta_texto?: string | null; resposta_opcao?: unknown }>;
};

function getDurationSeconds(start: string, end?: string | null) {
    if (!end) return null;
    const started = new Date(start).getTime();
    const finished = new Date(end).getTime();
    if (Number.isNaN(started) || Number.isNaN(finished)) return null;
    return Math.max(0, Math.round((finished - started) / 1000));
}

export async function POST(request: NextRequest) {
    try {
        const ctx = await getMobileAuthContext(request);
        if (!ctx) return apiError('Nao autenticado', 401);

        const body = (await request.json()) as InterviewPayload;
        if (!body?.survey_id || !body?.horario_inicio) {
            return apiError('survey_id e horario_inicio sao obrigatorios', 400);
        }

        const admin = createAdminClient();

        const { data: survey } = await admin
            .from('surveys')
            .select('id')
            .eq('id', body.survey_id)
            .eq('tenant_id', ctx.tenantId)
            .eq('status', 'published')
            .single();

        if (!survey) return apiError('Pesquisa nao encontrada ou nao publicada', 404);

        const { data: teamMember } = await admin
            .from('survey_team_members')
            .select('id, role')
            .eq('survey_id', body.survey_id)
            .eq('tenant_id', ctx.tenantId)
            .eq('user_id', ctx.userId)
            .eq('is_active', true)
            .single();

        if (!teamMember) return apiError('Usuario sem permissao para coletar nesta pesquisa', 403);

        const startedAt = body.horario_inicio;
        const endedAt = body.horario_fim ?? null;

        const { data: interview, error: interviewError } = await admin
            .from('interviews')
            .insert({
                survey_id: body.survey_id,
                tenant_id: ctx.tenantId,
                interviewer_id: ctx.userId,
                locality_id: body.localidade_id ?? null,
                started_at: startedAt,
                ended_at: endedAt,
                duration_seconds: getDurationSeconds(startedAt, endedAt),
                start_latitude: body.latitude_inicio ?? null,
                start_longitude: body.longitude_inicio ?? null,
                signature_name: body.assinatura_nome?.trim() || null,
                status: body.status ?? (endedAt ? 'completed' : 'in_progress'),
                synced: false,
            })
            .select('id, status')
            .single();

        if (interviewError || !interview) {
            return apiError(`Falha ao criar entrevista: ${interviewError?.message ?? 'desconhecido'}`, 500);
        }

        if (Array.isArray(body.respostas) && body.respostas.length > 0) {
            const answers = body.respostas
                .filter((answer) => answer.question_id)
                .map((answer) => ({
                    interview_id: interview.id,
                    tenant_id: ctx.tenantId,
                    question_id: answer.question_id,
                    answer_text: answer.resposta_texto ?? null,
                    answer_option: answer.resposta_opcao ?? null,
                }));

            if (answers.length > 0) {
                const { error: answersError } = await admin.from('interview_answers').insert(answers);
                if (answersError) {
                    return apiError(`Falha ao salvar respostas: ${answersError.message}`, 500);
                }
            }
        }

        return apiSuccess({ interview });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/entrevistas', operation: 'POST' },
        });
    }
}
