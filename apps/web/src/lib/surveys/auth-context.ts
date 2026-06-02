import { createClient } from '@/lib/supabase/server';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';

export interface SurveyAuthContext {
    userId: string;
    tenantId: string;
    role: string;
}

export async function getSurveyAuthContext(): Promise<SurveyAuthContext | null> {
    const { supabase } = await createClient();
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        return null;
    }

    const { data: userData } = await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

    if (!userData?.tenant_id) {
        return null;
    }

    return {
        userId: user.id,
        tenantId: userData.tenant_id,
        role: userData.role,
    };
}

export async function surveyBelongsToTenant(surveyId: string, tenantId: string) {
    const admin = createAuditedSupabaseAdminClient('survey-auth-context');
    const { data: survey } = await admin
        .from('surveys')
        .select('id, tenant_id, title, started_at, ended_at, status, published_at, total_interviews')
        .eq('id', surveyId)
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .single();

    return survey ?? null;
}
