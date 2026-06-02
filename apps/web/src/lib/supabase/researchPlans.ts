import { createClient } from '@/lib/supabase/client';
import type { PlanningData } from '@political-research/shared-utils';

export interface ResearchPlan {
    id: string;
    tenant_id?: string;
    name: string;
    planning_data: PlanningData | Record<string, unknown>;
    status: 'draft' | 'active' | 'archived';
    linked_survey_id?: string | null;
    created_by?: string;
    created_at: string;
    updated_at?: string;
}

export async function createResearchPlan({
    name,
    planningData,
    status = 'draft',
    linkedSurveyId = null,
}: {
    name: string;
    planningData: PlanningData | Record<string, unknown>;
    status?: string;
    linkedSurveyId?: string | null;
}) {
    const supabase = createClient();

    // Senior pattern: ensure multi-tenant context from authenticated user's profile.
    // Prevents RLS violations (the table requires tenant_id + created_by NOT NULL, and policy enforces isolation).
    // We fetch the profile (RLS allows users to see their own row) instead of relying on broken client insert or triggers.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado para criar planejamento');

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('tenant_id')
        .eq('id', user.id)
        .single();

    if (profileError || !profile?.tenant_id) {
        throw new Error('Não foi possível determinar o tenant do usuário para o planejamento. Verifique o perfil.');
    }

    const { data, error } = await supabase
        .from('research_plans')
        .insert([
            {
                tenant_id: profile.tenant_id,
                created_by: user.id,
                name,
                planning_data: planningData,
                status,
                linked_survey_id: linkedSurveyId,
            },
        ])
        .select()
        .single();
    if (error) throw error;
    return data as ResearchPlan;
}

export async function listResearchPlans(): Promise<ResearchPlan[]> {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('research_plans')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as ResearchPlan[];
}

export async function updateResearchPlan(id: string, updates: Partial<Omit<ResearchPlan, 'id' | 'created_at'>>) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('research_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as ResearchPlan;
}

export async function deleteResearchPlan(id: string) {
    const supabase = createClient();
    const { error } = await supabase
        .from('research_plans')
        .delete()
        .eq('id', id);
    if (error) throw error;
    return true;
}
