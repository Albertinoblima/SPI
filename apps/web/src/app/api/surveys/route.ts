// POST /api/surveys - Cria survey com todos os dados do wizard (draft)
// GET  /api/surveys - Lista surveys do tenant
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET() {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();
        if (!userData) return apiError('Usuário não encontrado', 404);

        const { data: surveys, error } = await supabase
            .from('surveys')
            .select(`
                id, title, description, status, survey_type,
                margin_of_error, confidence_interval, total_interviews,
                started_at, ended_at, created_at, updated_at
            `)
            .eq('tenant_id', userData.tenant_id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) return apiError('Erro ao listar pesquisas', 500);

        return apiSuccess({ surveys });
    } catch (error) {
        console.error('GET /api/surveys error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();
        if (!userData) return apiError('Usuário não encontrado', 404);

        const body = await request.json();
        const { title, description, survey_type, margin_of_error, confidence_interval,
            total_interviews, population_size, deff, p_proportion, stats_mode,
            objective, methodology, target_audience, requires_geolocation,
            requires_photo, requires_signature, allow_offline,
            started_at, ended_at, is_registered_research,
            registered_responsible_name, registered_responsible_registry,
            registered_responsible_body } = body;

        if (!title?.trim()) return apiError('Título da pesquisa é obrigatório', 400);

        const adminSupabase = createAdminClient();

        const { data: survey, error: surveyError } = await adminSupabase
            .from('surveys')
            .insert({
                tenant_id: userData.tenant_id,
                created_by: user.id,
                title: title.trim(),
                description: description?.trim() || null,
                survey_type: survey_type || null,
                margin_of_error: margin_of_error || null,
                confidence_interval: confidence_interval || null,
                total_interviews: total_interviews || null,
                population_size: population_size || null,
                deff: deff ?? 1.0,
                p_proportion: p_proportion ?? 0.5,
                stats_mode: stats_mode || 'auto',
                objective: objective?.trim() || null,
                methodology: methodology?.trim() || null,
                target_audience: target_audience?.trim() || null,
                is_registered_research: is_registered_research ?? false,
                registered_responsible_name: registered_responsible_name?.trim() || null,
                registered_responsible_registry: registered_responsible_registry?.trim() || null,
                registered_responsible_body: registered_responsible_body?.trim() || null,
                requires_geolocation: requires_geolocation ?? true,
                requires_photo: requires_photo ?? false,
                requires_signature: requires_signature ?? false,
                allow_offline: allow_offline ?? true,
                started_at: started_at || null,
                ended_at: ended_at || null,
                status: 'draft',
            })
            .select('id, title, status')
            .single();

        if (surveyError || !survey) {
            console.error('Survey creation error:', JSON.stringify(surveyError));
            return apiError(`Erro ao criar pesquisa: ${surveyError?.message ?? 'desconhecido'} [${surveyError?.code ?? ''}]`, 500);
        }

        return apiSuccess({ survey }, 201);
    } catch (error) {
        console.error('POST /api/surveys error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
