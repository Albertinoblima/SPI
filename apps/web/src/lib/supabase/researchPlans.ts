import { createClient } from '@/lib/supabase/client';

export async function createResearchPlan({
    name,
    planningData,
    status = 'draft',
    linkedSurveyId = null,
}: {
    name: string;
    planningData: any;
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
    return data;
}

export async function listResearchPlans() {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('research_plans')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function updateResearchPlan(id: string, updates: any) {
    const supabase = createClient();
    const { data, error } = await supabase
        .from('research_plans')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
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
