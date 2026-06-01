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
    const { data, error } = await supabase
        .from('research_plans')
        .insert([
            {
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
