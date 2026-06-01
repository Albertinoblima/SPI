import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient, checkRateLimit, adminRateLimitKey } from '@political-research/shared-utils';
import { getMobileAuthContext } from '@/lib/mobile/auth';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

type SyncInterviewPayload = {
    local_id?: string;
    survey_id: string;
    localidade_id?: string | null;
    horario_inicio: string;
    horario_fim?: string | null;
    latitude_inicio?: number | null;
    longitude_inicio?: number | null;
    assinatura_nome?: string | null;
    status?: 'in_progress' | 'completed' | 'synced';
    foto_path?: string | null;
    respostas?: Array<{ question_id: string; resposta_texto?: string | null; resposta_opcao?: unknown }>;
};

function toDuration(start: string, end?: string | null) {
    if (!end) return null;
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (Number.isNaN(s) || Number.isNaN(e)) return null;
    return Math.max(0, Math.round((e - s) / 1000));
}

export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const ctx = await getMobileAuthContext(request);
        if (!ctx) return apiError('Nao autenticado', 401, correlationId);

        // Fase 2: Rate limit on interview sync (prevents abuse of admin client)
        const rateKey = adminRateLimitKey(ctx.userId || 'mobile-unknown', 'sync-interviews');
        if (!checkRateLimit(rateKey, { windowMs: 60_000, maxRequests: 20 })) {
            return apiError('Limite de sincronização excedido. Tente novamente em breve.', 429, correlationId);
        }

        const payload = await request.json();
        const interviews = Array.isArray(payload) ? (payload as SyncInterviewPayload[]) : [];

        if (interviews.length === 0) {
            return apiError('Envie um array de entrevistas para sincronizar', 400, correlationId);
        }

        const admin = createAuditedSupabaseAdminClient('entrevistas-sync');
        const result: Array<{ local_id?: string; interview_id?: string; ok: boolean; error?: string }> = [];

        for (const item of interviews) {
            try {
                if (!item.survey_id || !item.horario_inicio) {
                    result.push({
                        ...(item.local_id ? { local_id: item.local_id } : {}),
                        ok: false,
                        error: 'survey_id e horario_inicio obrigatorios',
                    });
                    continue;
                }

                const { data: interview, error: interviewError } = await admin
                    .from('interviews')
                    .insert({
                        survey_id: item.survey_id,
                        tenant_id: ctx.tenantId,
                        interviewer_id: ctx.userId,
                        locality_id: item.localidade_id ?? null,
                        started_at: item.horario_inicio,
                        ended_at: item.horario_fim ?? null,
                        duration_seconds: toDuration(item.horario_inicio, item.horario_fim),
                        start_latitude: item.latitude_inicio ?? null,
                        start_longitude: item.longitude_inicio ?? null,
                        signature_name: item.assinatura_nome?.trim() || null,
                        photo_path: item.foto_path ?? null,
                        status: item.status ?? 'synced',
                        synced: true,
                    })
                    .select('id')
                    .single();

                if (interviewError || !interview) {
                    result.push({
                        ...(item.local_id ? { local_id: item.local_id } : {}),
                        ok: false,
                        error: interviewError?.message ?? 'erro ao inserir entrevista',
                    });
                    continue;
                }

                const answers = (item.respostas ?? [])
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
                        result.push({
                            ...(item.local_id ? { local_id: item.local_id } : {}),
                            ok: false,
                            error: answersError.message,
                        });
                        continue;
                    }
                }

                result.push({
                    ...(item.local_id ? { local_id: item.local_id } : {}),
                    interview_id: interview.id,
                    ok: true,
                });
            } catch (error) {
                result.push({
                    ...(item.local_id ? { local_id: item.local_id } : {}),
                    ok: false,
                    error: error instanceof Error ? error.message : 'erro desconhecido',
                });
            }
        }

        return apiSuccess({
            synced: result.filter((r) => r.ok).length,
            failed: result.filter((r) => !r.ok).length,
            items: result,
            correlationId,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/entrevistas/sync', operation: 'POST', correlationId },
        });
    }
}
