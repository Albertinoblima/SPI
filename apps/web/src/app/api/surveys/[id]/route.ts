// GET/PUT/DELETE /api/surveys/[id]
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/lib/api-middleware';

interface RouteParams { params: { id: string } }

async function getAuthContext() {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (!user || error) return null;
    const { data: userData } = await supabase
        .from('users').select('tenant_id, role').eq('id', user.id).single();
    if (!userData) return null;
    return { user, userData, supabase };
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getAuthContext();
        if (!ctx) return apiError('Não autenticado', 401);

        const { data: survey, error } = await ctx.supabase
            .from('surveys')
            .select(`
                *,
                survey_localities(*),
                survey_premises(*),
                questions(*)
            `)
            .eq('id', params.id)
            .eq('tenant_id', ctx.userData.tenant_id)
            .is('deleted_at', null)
            .single();

        if (error || !survey) return apiError('Pesquisa não encontrada', 404);

        return apiSuccess({ survey });
    } catch (error) {
        console.error('GET /api/surveys/[id] error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getAuthContext();
        if (!ctx) return apiError('Não autenticado', 401);

        const body = await request.json();
        const adminSupabase = createAdminClient();

        // Verificar ownership
        const { data: existing } = await adminSupabase
            .from('surveys').select('id').eq('id', params.id)
            .eq('tenant_id', ctx.userData.tenant_id).single();
        if (!existing) return apiError('Pesquisa não encontrada', 404);

        const { localities, premises, questions, ...surveyFields } = body;

        // Atualizar survey
        const { data: updated, error: updateError } = await adminSupabase
            .from('surveys')
            .update({ ...surveyFields, updated_at: new Date().toISOString() })
            .eq('id', params.id)
            .select('id, title, status')
            .single();

        if (updateError) return apiError('Erro ao atualizar pesquisa', 500);

        // Substituir localidades
        if (localities !== undefined) {
            await adminSupabase.from('survey_localities').delete().eq('survey_id', params.id);
            if (localities.length > 0) {
                await adminSupabase.from('survey_localities').insert(
                    localities.map((loc: Record<string, unknown>) => ({
                        ...loc,
                        survey_id: params.id,
                        tenant_id: ctx.userData.tenant_id,
                    }))
                );
            }
        }

        // Substituir premissas
        if (premises !== undefined) {
            await adminSupabase.from('survey_premises').delete().eq('survey_id', params.id);
            if (premises.length > 0) {
                await adminSupabase.from('survey_premises').insert(
                    premises.map((p: Record<string, unknown>, i: number) => ({
                        ...p,
                        survey_id: params.id,
                        tenant_id: ctx.userData.tenant_id,
                        order_index: i,
                    }))
                );
            }
        }

        // Substituir questões
        if (questions !== undefined) {
            await adminSupabase.from('questions').delete().eq('survey_id', params.id);
            if (questions.length > 0) {
                await adminSupabase.from('questions').insert(
                    questions.map((q: Record<string, unknown>, i: number) => ({
                        survey_id: params.id,
                        tenant_id: ctx.userData.tenant_id,
                        question_text: q.question_text,
                        question_type: q.question_type,
                        is_required: q.is_required ?? false,
                        order_index: i,
                        options: q.options ?? null,
                        validation_rules: q.validation_rules ?? null,
                    }))
                );
            }
        }

        return apiSuccess({ survey: updated, message: 'Pesquisa atualizada com sucesso' });
    } catch (error) {
        console.error('PUT /api/surveys/[id] error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getAuthContext();
        if (!ctx) return apiError('Não autenticado', 401);
        if (ctx.userData.role !== 'admin') return apiError('Sem permissão', 403);

        const adminSupabase = createAdminClient();
        const { error } = await adminSupabase
            .from('surveys')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', params.id)
            .eq('tenant_id', ctx.userData.tenant_id);

        if (error) return apiError('Erro ao remover pesquisa', 500);
        return apiSuccess({ message: 'Pesquisa removida com sucesso' });
    } catch (error) {
        console.error('DELETE /api/surveys/[id] error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
