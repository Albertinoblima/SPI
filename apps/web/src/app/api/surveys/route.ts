// POST /api/surveys - Cria survey com todos os dados do wizard (draft)
// GET  /api/surveys - Lista surveys do tenant
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/lib/api-middleware';

type SurveyLegalFields = {
    is_registered_research?: boolean;
    registered_responsible_name?: string;
    registered_responsible_registry?: string;
    registered_responsible_body?: string;
    contracting_entity_name?: string;
    contracting_entity_document?: string;
    survey_total_value?: number | null;
    invoice_reference?: string;
    funding_source?: string;
    is_public_disclosure?: boolean;
    pesqele_registration_code?: string;
};

type SurveyGeographyFields = {
    geographic_scope?: 'national' | 'state' | 'city' | 'specific_public' | '';
    scope_country_name?: string;
    scope_state_name?: string;
    scope_city_name?: string;
    specific_public_description?: string;
};

type SurveySamplingFields = {
    geographic_scope?: 'national' | 'state' | 'city' | 'specific_public' | '';
    population_size?: number | null;
};

function normalizeDocument(value?: string) {
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

function normalizeSamplingByScope(fields: SurveySamplingFields): SurveySamplingFields {
    if (fields.geographic_scope === 'national') {
        return {
            ...fields,
            population_size: null,
        };
    }

    return fields;
}

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
            registered_responsible_body, contracting_entity_name,
            contracting_entity_document, survey_total_value, invoice_reference,
            funding_source, is_public_disclosure, pesqele_registration_code,
            geographic_scope, scope_country_name, scope_state_name,
            scope_city_name, specific_public_description } = body;

        const normalizedSampling = normalizeSamplingByScope({
            geographic_scope,
            population_size,
        });

        if (!title?.trim()) return apiError('Título da pesquisa é obrigatório', 400);

        const legalValidationError = validateLegalFields({
            is_registered_research,
            registered_responsible_name,
            registered_responsible_registry,
            registered_responsible_body,
            contracting_entity_name,
            contracting_entity_document,
            survey_total_value,
            invoice_reference,
            funding_source,
            is_public_disclosure,
            pesqele_registration_code,
        });
        if (legalValidationError) return apiError(legalValidationError, 400);

        const geographyValidationError = validateGeographyFields({
            geographic_scope,
            scope_country_name,
            scope_state_name,
            scope_city_name,
            specific_public_description,
        });
        if (geographyValidationError) return apiError(geographyValidationError, 400);

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
                population_size: normalizedSampling.population_size ?? null,
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
                contracting_entity_name: contracting_entity_name?.trim() || null,
                contracting_entity_document: normalizeDocument(contracting_entity_document) || null,
                survey_total_value: survey_total_value ?? null,
                invoice_reference: invoice_reference?.trim() || null,
                funding_source: funding_source?.trim() || null,
                is_public_disclosure: is_public_disclosure ?? false,
                pesqele_registration_code: pesqele_registration_code?.trim() || null,
                geographic_scope: geographic_scope || null,
                scope_country_name: scope_country_name?.trim() || null,
                scope_state_name: scope_state_name?.trim() || null,
                scope_city_name: scope_city_name?.trim() || null,
                specific_public_description: specific_public_description?.trim() || null,
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
