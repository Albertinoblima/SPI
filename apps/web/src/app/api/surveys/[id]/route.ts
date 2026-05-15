// GET/PUT/DELETE /api/surveys/[id]
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/lib/api-middleware';

interface RouteParams { params: { id: string } }

type SurveyLegalFields = {
    is_registered_research?: boolean;
    registered_responsible_name?: string | null;
    registered_responsible_registry?: string | null;
    registered_responsible_body?: string | null;
    contracting_entity_name?: string | null;
    contracting_entity_document?: string | null;
    survey_total_value?: number | null;
    invoice_reference?: string | null;
    funding_source?: string | null;
    is_public_disclosure?: boolean;
    pesqele_registration_code?: string | null;
};

type SurveyGeographyFields = {
    geographic_scope?: 'national' | 'state' | 'city' | 'specific_public' | '' | null;
    scope_country_name?: string | null;
    scope_state_name?: string | null;
    scope_city_name?: string | null;
    specific_public_description?: string | null;
};

const LEGAL_FIELDS: Array<keyof SurveyLegalFields> = [
    'is_registered_research',
    'registered_responsible_name',
    'registered_responsible_registry',
    'registered_responsible_body',
    'contracting_entity_name',
    'contracting_entity_document',
    'survey_total_value',
    'invoice_reference',
    'funding_source',
    'is_public_disclosure',
    'pesqele_registration_code',
];

const GEOGRAPHY_FIELDS: Array<keyof SurveyGeographyFields> = [
    'geographic_scope',
    'scope_country_name',
    'scope_state_name',
    'scope_city_name',
    'specific_public_description',
];

function normalizeDocument(value?: string | null) {
    return (value ?? '').replace(/\D/g, '');
}

function validateLegalFields(fields: SurveyLegalFields): string | null {
    const isRegistered = fields.is_registered_research ?? false;
    if (!isRegistered) return null;

    const requiredTextValues = [
        fields.registered_responsible_name,
        fields.registered_responsible_registry,
        fields.registered_responsible_body,
        fields.contracting_entity_name,
        fields.invoice_reference,
        fields.funding_source,
    ];

    if (requiredTextValues.some(value => !value?.trim())) {
        return 'Pesquisa registrada exige preenchimento do responsável técnico, nota fiscal e origem dos recursos.';
    }

    const normalizedDocument = normalizeDocument(fields.contracting_entity_document);
    if (!(normalizedDocument.length === 11 || normalizedDocument.length === 14)) {
        return 'Informe um CNPJ ou CPF válido para o contratante.';
    }

    if (!fields.survey_total_value || fields.survey_total_value <= 0) {
        return 'Informe o valor da pesquisa com um montante maior que zero.';
    }

    if (fields.is_public_disclosure && !fields.pesqele_registration_code?.trim()) {
        return 'Para divulgação pública, o registro no PesqEle é obrigatório.';
    }

    return null;
}

function validateGeographyFields(fields: SurveyGeographyFields): string | null {
    if (!fields.geographic_scope) {
        return 'Selecione a abrangência territorial da pesquisa.';
    }
    if (fields.geographic_scope === 'national' && !fields.scope_country_name?.trim()) {
        return 'Para pesquisa nacional, informe o país.';
    }
    if (fields.geographic_scope === 'state' && !fields.scope_state_name?.trim()) {
        return 'Para pesquisa estadual, informe o estado.';
    }
    if (fields.geographic_scope === 'city' && (!fields.scope_state_name?.trim() || !fields.scope_city_name?.trim())) {
        return 'Para pesquisa municipal, informe estado e cidade.';
    }
    if (fields.geographic_scope === 'specific_public' && !fields.specific_public_description?.trim()) {
        return 'Para público específico, descreva o recorte do público-alvo.';
    }
    return null;
}

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
            .from('surveys')
            .select('id, is_registered_research, registered_responsible_name, registered_responsible_registry, registered_responsible_body, contracting_entity_name, contracting_entity_document, survey_total_value, invoice_reference, funding_source, is_public_disclosure, pesqele_registration_code, geographic_scope, scope_country_name, scope_state_name, scope_city_name, specific_public_description')
            .eq('id', params.id)
            .eq('tenant_id', ctx.userData.tenant_id).single();
        if (!existing) return apiError('Pesquisa não encontrada', 404);

        const { localities, premises, questions, ...surveyFields } = body;

        const hasLegalFieldInPayload = LEGAL_FIELDS.some((key) => key in surveyFields);
        if (hasLegalFieldInPayload) {
            const legalValidationError = validateLegalFields({
                ...existing,
                ...surveyFields,
            });
            if (legalValidationError) return apiError(legalValidationError, 400);

            if ('contracting_entity_document' in surveyFields) {
                surveyFields.contracting_entity_document = normalizeDocument(surveyFields.contracting_entity_document) || null;
            }
            if ('registered_responsible_name' in surveyFields) {
                surveyFields.registered_responsible_name = surveyFields.registered_responsible_name?.trim() || null;
            }
            if ('registered_responsible_registry' in surveyFields) {
                surveyFields.registered_responsible_registry = surveyFields.registered_responsible_registry?.trim() || null;
            }
            if ('registered_responsible_body' in surveyFields) {
                surveyFields.registered_responsible_body = surveyFields.registered_responsible_body?.trim() || null;
            }
            if ('contracting_entity_name' in surveyFields) {
                surveyFields.contracting_entity_name = surveyFields.contracting_entity_name?.trim() || null;
            }
            if ('invoice_reference' in surveyFields) {
                surveyFields.invoice_reference = surveyFields.invoice_reference?.trim() || null;
            }
            if ('funding_source' in surveyFields) {
                surveyFields.funding_source = surveyFields.funding_source?.trim() || null;
            }
            if ('pesqele_registration_code' in surveyFields) {
                surveyFields.pesqele_registration_code = surveyFields.pesqele_registration_code?.trim() || null;
            }
        }

        const hasGeographyFieldInPayload = GEOGRAPHY_FIELDS.some((key) => key in surveyFields);
        if (hasGeographyFieldInPayload) {
            const geographyValidationError = validateGeographyFields({
                ...existing,
                ...surveyFields,
            });
            if (geographyValidationError) return apiError(geographyValidationError, 400);

            if ('scope_country_name' in surveyFields) {
                surveyFields.scope_country_name = surveyFields.scope_country_name?.trim() || null;
            }
            if ('scope_state_name' in surveyFields) {
                surveyFields.scope_state_name = surveyFields.scope_state_name?.trim() || null;
            }
            if ('scope_city_name' in surveyFields) {
                surveyFields.scope_city_name = surveyFields.scope_city_name?.trim() || null;
            }
            if ('specific_public_description' in surveyFields) {
                surveyFields.specific_public_description = surveyFields.specific_public_description?.trim() || null;
            }
        }

        // Atualizar survey
        const { data: updated, error: updateError } = await adminSupabase
            .from('surveys')
            .update({ ...surveyFields, updated_at: new Date().toISOString() })
            .eq('id', params.id)
            .select('id, title, status')
            .single();

        if (updateError) {
            console.error('Supabase updateError:', JSON.stringify(updateError));
            return apiError(`Erro ao atualizar pesquisa: ${updateError.message}`, 500);
        }

        // Substituir localidades
        if (localities !== undefined) {
            await adminSupabase.from('survey_localities').delete().eq('survey_id', params.id);
            if (localities.length > 0) {
                await adminSupabase.from('survey_localities').insert(
                    localities.map((loc: Record<string, unknown>) => ({
                        survey_id: params.id,
                        tenant_id: ctx.userData.tenant_id,
                        name: String(loc.name ?? '').trim(),
                        zone: (loc.zone as string) || 'urban',
                        population: Number(loc.population ?? 0),
                        population_type: (loc.population_type as string) || 'publico_geral',
                        interviews_required: Number(loc.interviews_required ?? 0),
                        interviews_weight: Number(loc.interviews_weight ?? 0),
                        geo_level: (loc.geo_level as string) || 'locality',
                        parent_state_name: (loc.parent_state_name as string) || null,
                        parent_city_name: (loc.parent_city_name as string) || null,
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
