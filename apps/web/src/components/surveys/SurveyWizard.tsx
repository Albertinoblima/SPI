'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, ChevronLeft, RefreshCw } from 'lucide-react';
import { Step1TechnicalData, type SurveyTechData, shouldUseStatisticalSampling } from './Step1TechnicalData';
import { Step2Localities, type Locality } from './Step2Localities';
import { Step3Premises, type Premise } from './Step3Premises';
import { Step4Questions } from './Step4Questions';
import type { Question } from '@political-research/shared-types';

const STEPS = [
    { id: 1, label: 'Dados Técnicos', description: 'Identificação e parâmetros estatísticos' },
    { id: 2, label: 'Localidades', description: 'Municípios e cálculo amostral' },
    { id: 3, label: 'Premissas', description: 'Perfil e cotas do entrevistado' },
    { id: 4, label: 'Questionário', description: 'Perguntas da pesquisa' },
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
    },
    localities: [],
    premises: [],
    questions: [],
};

export function SurveyWizard({ draftId }: { draftId?: string }) {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [data, setData] = useState<WizardData>(initialWizardData);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [loadingDraft, setLoadingDraft] = useState(!!draftId);
    const [surveyId, setSurveyId] = useState<string | undefined>(draftId);

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
                    },
                    localities: (s.survey_localities ?? []).map((l: Record<string, unknown>) => ({
                        id: l.id as string,
                        name: l.name as string,
                        zone: l.zone as 'urban' | 'rural' | 'mixed',
                        population: (l.population as number) ?? 0,
                        population_type: (l.population_type as Locality['population_type']) ?? 'eleitores',
                        interviews_required: (l.interviews_required as number) ?? 0,
                        interviews_weight: (l.interviews_weight as number) ?? 0,
                    })),
                    premises: s.survey_premises ?? [],
                    questions: s.questions ?? [],
                });
            })
            .catch(() => setAlert({ type: 'error', message: 'Não foi possível carregar o rascunho.' }))
            .finally(() => setLoadingDraft(false));
    }, [draftId]);
    const updateTech = useCallback((tech: SurveyTechData) => {
        setData(prev => ({ ...prev, tech }));
    }, []);

    // Quando localidades mudam, recalcula population_size (soma das populações)
    // e atualiza total_interviews no modo auto (mantendo deff e p do usuário).
    const updateLocalities = useCallback((localities: Locality[]) => {
        setData(prev => {
            const totalPop = localities.reduce((s, l) => s + (l.population ?? 0), 0);
            const tech = prev.tech;
            if (tech.stats_mode !== 'auto') {
                return { ...prev, localities };
            }
            const usesSampling = shouldUseStatisticalSampling(tech.survey_type);
            if (!usesSampling) {
                return { ...prev, localities };
            }
            const Z: Record<number, number> = { 90: 1.645, 95: 1.96, 99: 2.576 };
            const z = Z[tech.confidence_interval] ?? 1.96;
            const E = tech.margin_of_error / 100;
            const p = tech.p_proportion ?? 0.5;
            const n0 = (z * z * p * (1 - p)) / (E * E);
            const popForCalc = totalPop > 0 ? totalPop : null;
            const nWithPop = popForCalc && popForCalc > 0
                ? n0 / (1 + (n0 - 1) / popForCalc)
                : n0;
            const total_interviews = Math.ceil(nWithPop * (tech.deff ?? 1));
            return {
                ...prev,
                localities,
                tech: {
                    ...tech,
                    population_size: totalPop > 0 ? totalPop : null,
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

    const goNext = () => setCurrentStep(s => Math.min(s + 1, 4));
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
            let currentSurveyId = surveyId;

            if (currentSurveyId) {
                // Rascunho existente: atualiza via PUT
                const res = await fetch(`/api/surveys/${currentSurveyId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...data.tech,
                        localities: data.localities,
                        premises: data.premises,
                        questions: data.questions,
                    }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Erro ao salvar');
            } else {
                // Nova pesquisa: cria via POST
                const res = await fetch('/api/surveys', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...data.tech,
                        localities: data.localities,
                        premises: data.premises,
                    }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Erro ao salvar');

                currentSurveyId = json.data?.survey?.id;
                if (currentSurveyId) setSurveyId(currentSurveyId);

                // Salvar localidades, premissas e questões
                if (currentSurveyId) {
                    const putRes = await fetch(`/api/surveys/${currentSurveyId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            localities: data.localities,
                            premises: data.premises,
                            questions: data.questions,
                        }),
                    });
                    if (!putRes.ok) {
                        const putJson = await putRes.json();
                        throw new Error(putJson.error || 'Erro ao salvar dados da pesquisa');
                    }
                }
            }

            setAlert({ type: 'success', message: 'Pesquisa salva como rascunho!' });
            setTimeout(() => router.push('/surveys'), 1500);
        } catch (err) {
            setAlert({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar pesquisa' });
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
            return;
        }
        await handleSaveDraft();
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
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
                        <h1 className="text-2xl font-bold text-slate-900">
                            {surveyId ? 'Editar Rascunho' : 'Nova Pesquisa'}
                        </h1>
                        <p className="text-slate-500 mt-1">Preencha as informações nas 4 etapas abaixo</p>
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
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all
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
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
                        {currentStep === 1 && (
                            <Step1TechnicalData data={data.tech} onChange={updateTech} />
                        )}
                        {currentStep === 2 && (
                            <Step2Localities
                                localities={data.localities}
                                onChange={updateLocalities}
                                marginOfError={data.tech.margin_of_error}
                                confidenceInterval={data.tech.confidence_interval}
                                surveyType={data.tech.survey_type}
                            />
                        )}
                        {currentStep === 3 && (
                            <Step3Premises premises={data.premises} onChange={updatePremises} />
                        )}
                        {currentStep === 4 && (
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
                            {currentStep < 4 ? (
                                <button
                                    type="button"
                                    onClick={goNext}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
                                >
                                    Próximo
                                    <ChevronRight size={18} />
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
