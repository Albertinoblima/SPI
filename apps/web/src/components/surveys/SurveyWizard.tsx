'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { Step1TechnicalData, type SurveyTechData, shouldUseStatisticalSampling } from './Step1TechnicalData';
import { getEffectiveLocalities, checkLocalitiesCompatibility } from '@/lib/survey-decisions';
import { Step2Localities, type Locality } from './Step2Localities';
import { Step3SampleSize } from './Step3SampleSize';
import { Step3Premises, type Premise } from './Step3Premises';
import { Step4Questions } from './Step4Questions';
import type { Question } from '@political-research/shared-types';

const STEPS = [
    { id: 1, label: 'Dados Técnicos', description: 'Identificação da pesquisa' },
    { id: 2, label: 'Localidades', description: 'Abrangência e territórios' },
    { id: 3, label: 'Dimensionamento', description: 'Revisão do cálculo amostral' },
    { id: 4, label: 'Premissas', description: 'Perfil e cotas do entrevistado' },
    { id: 5, label: 'Questionário', description: 'Perguntas da pesquisa' },
];

export interface WizardData {
    tech: SurveyTechData;
    localities: Locality[];
    premises: Premise[];
    questions: Question[];
}

const initialWizardData: WizardData = {
    tech: {
        title: '',
        description: '',
        research_category: '' as const,
        survey_type: '',
        margin_of_error: 3,
        confidence_interval: 95,
        total_interviews: 1067,
        population_size: null,
        deff: 1.0,
        p_proportion: 0.5,
        stats_mode: 'auto',
        infinite_population_mode: 'national_only',
        infinite_population_threshold: 50000,
        population_type: 'eleitores',
        objective: '',
        methodology: '',
        target_audience: '',
        is_registered_research: false,
        registered_responsible_name: '',
        registered_responsible_registry: '',
        registered_responsible_body: '',
        contracting_entity_name: '',
        contracting_entity_document: '',
        survey_total_value: null,
        invoice_reference: '',
        funding_source: '',
        is_public_disclosure: false,
        pesqele_registration_code: '',
        non_registered_disclaimer: '',
        requires_geolocation: true,
        requires_photo: false,
        requires_signature: false,
        allow_offline: true,
        started_at: '',
        ended_at: '',
        geographic_scope: '',
        scope_country_name: 'Brasil',
        scope_state_name: '',
        scope_city_name: '',
        specific_public_description: '',
    },
    localities: [],
    premises: [],
    questions: [],
};

function shouldForceInfinitePopulation(scope: SurveyTechData['geographic_scope']): boolean {
    return scope === 'national';
}

/** Determina se uma localidade específica usa população infinita conforme o modo escolhido. */
export function localityUsesInfinitePopulation(
    population: number,
    tech: Pick<SurveyTechData, 'infinite_population_mode' | 'infinite_population_threshold' | 'geographic_scope'>,
): boolean {
    const mode = tech.infinite_population_mode ?? 'national_only';
    if (mode === 'force_all') return true;
    if (mode === 'auto_threshold') return population >= (tech.infinite_population_threshold ?? 50000);
    // national_only
    return tech.geographic_scope === 'national';
}

function computeAutoTotalInterviews(tech: SurveyTechData, localities: Locality[]): number {
    const Z: Record<number, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };
    const z = Z[tech.confidence_interval] ?? 1.96;
    const E = tech.margin_of_error / 100;
    const p = tech.p_proportion ?? 0.5;
    const n0 = (z * z * p * (1 - p)) / (E * E);
    const deff = tech.deff ?? 1;
    const mode = tech.infinite_population_mode ?? 'national_only';

    const effectiveLocs = getEffectiveLocalities(localities);

    if (effectiveLocs.length > 0) {
        const threshold = tech.infinite_population_threshold ?? 50000;
        const isNational = tech.geographic_scope === 'national';

        const totalByLocality = effectiveLocs.reduce((acc, loc) => {
            const manualInterviews = Math.max(0, Number(loc.interviews_required ?? 0));
            if (manualInterviews > 0) {
                return acc + Math.ceil(manualInterviews);
            }

            const population = Number(loc.population ?? 0);
            // Populacao 0 significa valor desconhecido: so considera se houver entrevistas manuais.
            if (!Number.isFinite(population) || population <= 0) {
                return acc;
            }

            const useInfinite =
                mode === 'force_all'
                    ? true
                    : mode === 'auto_threshold'
                        ? population >= threshold
                        : isNational;

            const n = useInfinite
                ? n0
                : n0 / (1 + (n0 - 1) / population);

            return acc + Math.ceil(n * deff);
        }, 0);

        if (totalByLocality > 0) {
            return totalByLocality;
        }
    }

    if (mode === 'force_all') {
        return Math.ceil(n0 * deff);
    }

    if (mode === 'auto_threshold') {
        if (effectiveLocs.length === 0) return Math.ceil(n0 * deff);
        const threshold = tech.infinite_population_threshold ?? 50000;
        const total = effectiveLocs.reduce((acc, loc) => {
            const useInfinite = (loc.population ?? 0) >= threshold;
            const n = useInfinite || loc.population <= 0
                ? n0
                : n0 / (1 + (n0 - 1) / loc.population);
            return acc + Math.ceil(n * deff);
        }, 0);
        return total;
    }

    // national_only (padrão)
    const isNational = tech.geographic_scope === 'national';
    if (isNational || effectiveLocs.length === 0) {
        return Math.ceil(n0 * deff);
    }
    const totalPop = effectiveLocs.reduce((s, l) => s + (l.population ?? 0), 0);
    const nWithPop = totalPop > 0 ? n0 / (1 + (n0 - 1) / totalPop) : n0;
    return Math.ceil(nWithPop * deff);
}

export function SurveyWizard({ draftId }: { draftId?: string }) {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [data, setData] = useState<WizardData>(initialWizardData);
    const [saving, setSaving] = useState(false);
    const [autoSaving, setAutoSaving] = useState(false);
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [loadingDraft, setLoadingDraft] = useState(!!draftId);
    const [surveyId, setSurveyId] = useState<string | undefined>(draftId);
    const [localitiesConflict, setLocalitiesConflict] = useState<string | null>(null);

    // Carrega rascunho existente
    useEffect(() => {
        if (!draftId) return;
        setLoadingDraft(true);
        fetch(`/api/surveys/${draftId}`)
            .then(r => r.json())
            .then(json => {
                const s = json.data?.survey;
                if (!s) return;
                setData({
                    tech: {
                        title: s.title ?? '',
                        description: s.description ?? '',
                        research_category: (s.research_category ?? '') as import('./Step1TechnicalData').ResearchCategory | '',
                        survey_type: s.survey_type ?? '',
                        margin_of_error: s.margin_of_error ?? 3,
                        confidence_interval: s.confidence_interval ?? 95,
                        total_interviews: s.total_interviews ?? 1067,
                        population_size: s.population_size ?? null,
                        deff: s.deff ?? 1.0,
                        p_proportion: s.p_proportion ?? 0.5,
                        stats_mode: s.stats_mode ?? 'auto',
                        infinite_population_mode: s.infinite_population_mode ?? 'national_only',
                        infinite_population_threshold: s.infinite_population_threshold ?? 50000,
                        population_type: s.population_type ?? 'eleitores',
                        objective: s.objective ?? '',
                        methodology: s.methodology ?? '',
                        target_audience: s.target_audience ?? '',
                        is_registered_research: s.is_registered_research ?? false,
                        registered_responsible_name: s.registered_responsible_name ?? '',
                        registered_responsible_registry: s.registered_responsible_registry ?? '',
                        registered_responsible_body: s.registered_responsible_body ?? '',
                        contracting_entity_name: s.contracting_entity_name ?? '',
                        contracting_entity_document: s.contracting_entity_document ?? '',
                        survey_total_value: s.survey_total_value ?? null,
                        invoice_reference: s.invoice_reference ?? '',
                        funding_source: s.funding_source ?? '',
                        is_public_disclosure: s.is_public_disclosure ?? false,
                        pesqele_registration_code: s.pesqele_registration_code ?? '',
                        non_registered_disclaimer: s.non_registered_disclaimer ?? '',
                        requires_geolocation: s.requires_geolocation ?? true,
                        requires_photo: s.requires_photo ?? false,
                        requires_signature: s.requires_signature ?? false,
                        allow_offline: s.allow_offline ?? true,
                        started_at: s.started_at ? s.started_at.slice(0, 10) : '',
                        ended_at: s.ended_at ? s.ended_at.slice(0, 10) : '',
                        geographic_scope: (s.geographic_scope ?? '') as import('./Step1TechnicalData').SurveyTechData['geographic_scope'],
                        scope_country_name: s.scope_country_name ?? 'Brasil',
                        scope_state_name: s.scope_state_name ?? '',
                        scope_city_name: s.scope_city_name ?? '',
                        specific_public_description: s.specific_public_description ?? '',
                    },
                    localities: (s.survey_localities ?? []).map((l: Record<string, unknown>) => ({
                        id: l.id as string,
                        name: l.name as string,
                        zone: l.zone as 'urban' | 'rural' | 'mixed',
                        population: (l.population as number) ?? 0,
                        population_type: (l.population_type as Locality['population_type']) ?? 'eleitores',
                        interviews_required: (l.interviews_required as number) ?? 0,
                        interviews_weight: (l.interviews_weight as number) ?? 0,
                        geo_level: (l.geo_level as Locality['geo_level']) ?? 'locality',
                        parent_state_name: (l.parent_state_name as string) ?? null,
                        parent_city_name: (l.parent_city_name as string) ?? null,
                    })),
                    premises: s.survey_premises ?? [],
                    questions: s.questions ?? [],
                });

                // Retoma o wizard no último passo com dados preenchidos
                const loadedLocalities = s.survey_localities ?? [];
                const loadedPremises = s.survey_premises ?? [];
                const loadedQuestions = s.questions ?? [];
                if (loadedQuestions.length > 0) setCurrentStep(5);
                else if (loadedPremises.length > 0) setCurrentStep(4);
                else if (loadedLocalities.length > 0) setCurrentStep(3);
                else if (s.geographic_scope) setCurrentStep(2);
                // else: mantém step 1
            })
            .catch(() => setAlert({ type: 'error', message: 'Não foi possível carregar o rascunho.' }))
            .finally(() => setLoadingDraft(false));
    }, [draftId]);
    const updateTech = useCallback((tech: SurveyTechData) => {
        setData(prev => {
            // Detectar conflito de localidades ao mudar survey_type ou geographic_scope
            const conflict = checkLocalitiesCompatibility(prev.localities, tech.geographic_scope, tech.survey_type);
            setLocalitiesConflict(conflict);

            const effectiveLocalities = getEffectiveLocalities(prev.localities);
            const totalPop = effectiveLocalities.reduce((s, l) => s + (l.population ?? 0), 0);
            const isNational = tech.geographic_scope === 'national';
            const mode = tech.infinite_population_mode ?? 'national_only';

            const normalizedTech: SurveyTechData = {
                ...tech,
                population_size: (isNational || mode === 'force_all') ? null : (totalPop > 0 ? totalPop : null),
            };

            if (normalizedTech.stats_mode !== 'auto' || !shouldUseStatisticalSampling(normalizedTech.survey_type)) {
                return { ...prev, tech: normalizedTech };
            }

            return {
                ...prev,
                tech: {
                    ...normalizedTech,
                    total_interviews: computeAutoTotalInterviews(normalizedTech, prev.localities),
                },
            };
        });
    }, []);

    // Quando localidades mudam, recalcula population_size (soma das populações)
    // e atualiza total_interviews no modo auto (mantendo deff e p do usuário).
    const updateLocalities = useCallback((localities: Locality[]) => {
        setData(prev => {
            // Limpa conflito se localidades foram corrigidas
            const conflict = checkLocalitiesCompatibility(localities, prev.tech.geographic_scope, prev.tech.survey_type);
            setLocalitiesConflict(conflict);

            const effectiveLocalities = getEffectiveLocalities(localities);
            const totalPop = effectiveLocalities.reduce((s, l) => s + (l.population ?? 0), 0);
            const tech = prev.tech;
            if (tech.stats_mode !== 'auto') {
                return { ...prev, localities };
            }
            const usesSampling = shouldUseStatisticalSampling(tech.survey_type);
            if (!usesSampling) {
                return { ...prev, localities };
            }
            const isNational = tech.geographic_scope === 'national';
            const mode = tech.infinite_population_mode ?? 'national_only';
            const total_interviews = computeAutoTotalInterviews(tech, localities);
            return {
                ...prev,
                localities,
                tech: {
                    ...tech,
                    population_size: (isNational || mode === 'force_all') ? null : (totalPop > 0 ? totalPop : null),
                    total_interviews,
                },
            };
        });
    }, []);

    const updatePremises = useCallback((premises: Premise[]) => {
        setData(prev => ({ ...prev, premises }));
    }, []);

    const updateQuestions = useCallback((questions: Question[]) => {
        setData(prev => ({ ...prev, questions }));
    }, []);

    const updateScopeData = useCallback((scopeData: Pick<SurveyTechData, 'geographic_scope' | 'scope_country_name' | 'scope_state_name' | 'scope_city_name' | 'specific_public_description'>) => {
        setData(prev => {
            const effectiveLocalities = getEffectiveLocalities(prev.localities);
            const totalPop = effectiveLocalities.reduce((s, l) => s + (l.population ?? 0), 0);

            const nextTech: SurveyTechData = {
                ...prev.tech,
                ...scopeData,
            };
            const isNational = nextTech.geographic_scope === 'national';
            const mode = nextTech.infinite_population_mode ?? 'national_only';
            if (isNational || mode === 'force_all') {
                nextTech.population_size = null;
            } else {
                nextTech.population_size = totalPop > 0 ? totalPop : null;
            }

            if (nextTech.stats_mode === 'auto' && shouldUseStatisticalSampling(nextTech.survey_type)) {
                nextTech.total_interviews = computeAutoTotalInterviews(nextTech, prev.localities);
            }

            return {
                ...prev,
                tech: nextTech,
            };
        });
    }, []);

    const updateSampleMode = useCallback((updates: Partial<Pick<SurveyTechData, 'infinite_population_mode' | 'infinite_population_threshold' | 'margin_of_error' | 'confidence_interval'>>) => {
        setData(prev => {
            const effectiveLocalities = getEffectiveLocalities(prev.localities);
            const totalPop = effectiveLocalities.reduce((s, l) => s + (l.population ?? 0), 0);
            const nextTech: SurveyTechData = { ...prev.tech, ...updates };
            const isNational = nextTech.geographic_scope === 'national';
            const mode = nextTech.infinite_population_mode;
            nextTech.population_size = (isNational || mode === 'force_all') ? null : (totalPop > 0 ? totalPop : null);
            if (nextTech.stats_mode === 'auto' && shouldUseStatisticalSampling(nextTech.survey_type)) {
                nextTech.total_interviews = computeAutoTotalInterviews(nextTech, prev.localities);
            }
            return { ...prev, tech: nextTech };
        });
    }, []);

    const goPrev = () => setCurrentStep(s => Math.max(s - 1, 1));

    const validateRegisteredResearchRequirements = () => {
        if (!data.tech.is_registered_research) return null;

        const legalRequired = [
            data.tech.registered_responsible_name,
            data.tech.registered_responsible_registry,
            data.tech.registered_responsible_body,
            data.tech.contracting_entity_name,
            data.tech.contracting_entity_document,
            data.tech.invoice_reference,
            data.tech.funding_source,
        ];

        if (legalRequired.some(value => !value?.trim()) || !data.tech.survey_total_value || data.tech.survey_total_value <= 0) {
            return 'Pesquisa registrada exige dados legais obrigatórios: responsável técnico, contratante (nome e CNPJ/CPF), valor da pesquisa, nota fiscal e origem dos recursos.';
        }

        if (data.tech.is_public_disclosure && !data.tech.pesqele_registration_code.trim()) {
            return 'Para divulgação pública, informe o registro no PesqEle.';
        }

        return null;
    };

    /**
     * Persiste o rascunho atual sem redirecionar.
     * Retorna o surveyId (novo ou existente) em caso de sucesso, ou null em caso de erro.
     */
    const persistDraft = useCallback(async (
        wizardData: WizardData,
        currentId: string | undefined,
    ): Promise<{ id: string | null; error: string | null }> => {
        try {
            if (currentId) {
                const res = await fetch(`/api/surveys/${currentId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...wizardData.tech,
                        localities: wizardData.localities,
                        premises: wizardData.premises,
                        questions: wizardData.questions,
                    }),
                });
                const json = await res.json();
                if (!res.ok) return { id: null, error: json.error || 'Erro ao atualizar rascunho' };
                return { id: currentId, error: null };
            }

            // Primeira vez: cria via POST
            const res = await fetch('/api/surveys', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...wizardData.tech,
                    localities: wizardData.localities,
                    premises: wizardData.premises,
                }),
            });
            const json = await res.json();
            if (!res.ok) return { id: null, error: json.error || 'Erro ao criar rascunho' };

            const newId: string | undefined = json.data?.survey?.id;
            if (!newId) return { id: null, error: 'Resposta inválida do servidor' };

            // Salva localidades, premissas e questões no registro recém-criado
            const putRes = await fetch(`/api/surveys/${newId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    localities: wizardData.localities,
                    premises: wizardData.premises,
                    questions: wizardData.questions,
                }),
            });
            if (!putRes.ok) {
                const putJson = await putRes.json();
                // Rascunho criado mas detalhes falharam — retorna id mesmo assim
                return { id: newId, error: putJson.error || 'Erro ao salvar detalhes da pesquisa' };
            }

            return { id: newId, error: null };
        } catch {
            return { id: null, error: 'Erro de conexão com o servidor' };
        }
    }, []);

    const handleSaveDraft = async () => {
        if (!data.tech.title.trim()) {
            setAlert({ type: 'error', message: 'Preencha ao menos o título da pesquisa antes de salvar.' });
            setCurrentStep(1);
            return;
        }
        const legalValidationError = validateRegisteredResearchRequirements();
        if (legalValidationError) {
            setAlert({ type: 'error', message: legalValidationError });
            setCurrentStep(1);
            return;
        }
        setSaving(true);
        setAlert(null);
        try {
            const result = await persistDraft(data, surveyId);
            if (result.id && !surveyId) setSurveyId(result.id);
            if (result.error) {
                setAlert({ type: 'error', message: result.error });
                return;
            }
            setAlert({ type: 'success', message: 'Pesquisa salva como rascunho!' });
            setTimeout(() => router.push('/dashboard'), 1500);
        } finally {
            setSaving(false);
        }
    };

    const handleFinish = async () => {
        if (!data.tech.title.trim()) {
            setAlert({ type: 'error', message: 'Preencha o título da pesquisa.' });
            setCurrentStep(1);
            return;
        }
        const legalValidationError = validateRegisteredResearchRequirements();
        if (legalValidationError) {
            setAlert({ type: 'error', message: legalValidationError });
            setCurrentStep(1);
            return;
        }
        if (data.localities.length === 0) {
            setAlert({ type: 'error', message: 'Adicione ao menos uma localidade.' });
            setCurrentStep(2);
            return;
        }
        if (data.questions.length === 0) {
            setAlert({ type: 'error', message: 'Adicione ao menos uma pergunta ao questionário.' });
            setCurrentStep(5);
            return;
        }
        await handleSaveDraft();
    };

    /** Salva silenciosamente e avança para o próximo passo. */
    const goNext = async () => {
        if (!data.tech.title.trim()) {
            setAlert({ type: 'error', message: 'Preencha o título da pesquisa antes de avançar.' });
            return;
        }
        setAutoSaving(true);
        setAlert(null);
        try {
            const result = await persistDraft(data, surveyId);
            if (result.id && !surveyId) setSurveyId(result.id);
            if (result.error) {
                // Avisa mas não bloqueia — dados estão na memória
                setAlert({ type: 'error', message: `Rascunho não salvo: ${result.error}` });
            }
        } finally {
            setAutoSaving(false);
        }
        setCurrentStep(s => Math.min(s + 1, 5));
    };

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            {/* Carregando rascunho */}
            {loadingDraft && (
                <div className="flex items-center justify-center h-64 gap-3 text-slate-400">
                    <RefreshCw size={22} className="animate-spin" />
                    <span className="text-sm">Carregando rascunho...</span>
                </div>
            )}
            {!loadingDraft && (
                <>
                    {/* Cabeçalho */}
                    <div className="mb-8">
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                            {surveyId ? 'Editar Rascunho' : 'Nova Pesquisa'}
                        </h1>
                        <p className="text-slate-500 mt-1">Preencha as informações nas 5 etapas abaixo</p>
                    </div>

                    {/* Stepper */}
                    <nav className="flex items-center gap-0 mb-8" aria-label="Etapas do wizard">
                        {STEPS.map((step, index) => {
                            const done = currentStep > step.id;
                            const active = currentStep === step.id;
                            return (
                                <div key={step.id} className="flex items-center flex-1 last:flex-none">
                                    <button
                                        type="button"
                                        onClick={() => done && setCurrentStep(step.id)}
                                        className={`flex flex-col items-center group ${done ? 'cursor-pointer' : 'cursor-default'}`}
                                        aria-current={active ? 'step' : undefined}
                                    >
                                        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all
                                    ${active ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                                    ${done ? 'bg-green-500 text-white' : ''}
                                    ${!active && !done ? 'bg-slate-200 text-slate-500' : ''}`}>
                                            {done ? <CheckCircle2 size={20} /> : step.id}
                                        </div>
                                        <div className="mt-2 text-center hidden sm:block">
                                            <div className={`text-xs font-semibold ${active ? 'text-blue-700' : done ? 'text-green-700' : 'text-slate-400'}`}>
                                                {step.label}
                                            </div>
                                            <div className="text-xs text-slate-400 max-w-[90px]">{step.description}</div>
                                        </div>
                                    </button>
                                    {index < STEPS.length - 1 && (
                                        <div className={`flex-1 h-0.5 mx-2 mt-[-20px] sm:mt-[-28px] rounded
                                    ${currentStep > step.id ? 'bg-green-400' : 'bg-slate-200'}`} />
                                    )}
                                </div>
                            );
                        })}
                    </nav>

                    {/* Alerta */}
                    {alert && (
                        <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium
                    ${alert.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {alert.message}
                        </div>
                    )}

                    {/* Conteúdo da etapa atual */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-8">
                        {currentStep === 1 && (
                            <Step1TechnicalData data={data.tech} onChange={updateTech} />
                        )}
                        {currentStep === 2 && (
                            <Step2Localities
                                localities={data.localities}
                                onChange={updateLocalities}
                                surveyType={data.tech.survey_type}
                                scopeData={{
                                    geographic_scope: data.tech.geographic_scope,
                                    scope_country_name: data.tech.scope_country_name,
                                    scope_state_name: data.tech.scope_state_name,
                                    scope_city_name: data.tech.scope_city_name,
                                    specific_public_description: data.tech.specific_public_description,
                                }}
                                onScopeChange={updateScopeData}
                                defaultPopulationType={data.tech.population_type}
                                externalConflict={localitiesConflict}
                            />
                        )}
                        {currentStep === 3 && (
                            <Step3SampleSize
                                localities={data.localities}
                                tech={data.tech}
                                onTechChange={updateSampleMode}
                                onLocalitiesChange={updateLocalities}
                            />
                        )}
                        {currentStep === 4 && (
                            <Step3Premises 
                                premises={data.premises} 
                                onChange={updatePremises}
                                localities={data.localities}
                            />
                        )}
                        {currentStep === 5 && (
                            <Step4Questions
                                questions={data.questions}
                                onChange={updateQuestions}
                                surveyTitle={data.tech.title}
                            />
                        )}
                    </div>



                    {/* Rodapé de navegação */}
                    <div className="mt-6 flex items-center justify-between">
                        <div className="flex gap-3">
                            {currentStep > 1 && (
                                <button
                                    type="button"
                                    onClick={goPrev}
                                    className="flex items-center gap-2 px-5 py-2.5 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition"
                                >
                                    <ChevronLeft size={18} />
                                    Anterior
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => router.push('/surveys')}
                                className="px-5 py-2.5 text-slate-500 font-medium hover:text-slate-700 transition"
                            >
                                Cancelar
                            </button>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleSaveDraft}
                                disabled={saving}
                                className="px-5 py-2.5 border border-blue-300 text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition disabled:opacity-50"
                            >
                                {saving ? 'Salvando...' : 'Salvar Rascunho'}
                            </button>
                            {currentStep < 5 ? (
                                <button
                                    type="button"
                                    onClick={goNext}
                                    disabled={autoSaving}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-70"
                                >
                                    {autoSaving ? (
                                        <>
                                            <RefreshCw size={16} className="animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            Próximo
                                            <ChevronRight size={18} />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleFinish}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition disabled:opacity-50"
                                >
                                    <CheckCircle2 size={18} />
                                    {saving ? 'Salvando...' : 'Concluir e Salvar'}
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
