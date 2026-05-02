// GET /api/dashboard — métricas e pesquisas recentes para a tela inicial
import { createClient } from '@/lib/supabase/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET() {
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

        const tid = userData.tenant_id;

        // Buscar em paralelo
        const [surveysRes, teamRes, tenantRes] = await Promise.all([
            supabase
                .from('surveys')
                .select('id, title, status, survey_type, total_interviews, created_at, started_at, ended_at')
                .eq('tenant_id', tid)
                .is('deleted_at', null)
                .order('created_at', { ascending: false }),
            supabase
                .from('users')
                .select('id, is_active, role')
                .eq('tenant_id', tid),
            supabase
                .from('tenants')
                .select('name, logo_url, max_surveys, max_users, status, cnpj, city, state')
                .eq('id', tid)
                .single(),
        ]);

        const surveys = surveysRes.data ?? [];
        const team = teamRes.data ?? [];
        const tenant = tenantRes.data;

        // Métricas
        const metrics = {
            total_surveys: surveys.length,
            active_surveys: surveys.filter(s => s.status === 'active').length,
            draft_surveys: surveys.filter(s => s.status === 'draft').length,
            closed_surveys: surveys.filter(s => s.status === 'closed').length,
            total_team: team.length,
            active_team: team.filter(m => m.is_active).length,
            interviewers: team.filter(m => m.role === 'interviewer').length,
        };

        // Verificar se o onboarding foi concluído (empresa com dados mínimos)
        const onboardingComplete = Boolean(
            tenant?.cnpj && tenant?.city
        );

        return apiSuccess({
            tenant,
            metrics,
            surveys,
            onboarding_complete: onboardingComplete,
        });
    } catch (error) {
        console.error('GET /api/dashboard error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
