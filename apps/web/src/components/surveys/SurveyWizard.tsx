'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { Step1TechnicalData, type SurveyTechData } from './Step1TechnicalData';
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
        survey_type: '',
        margin_of_error: 3,
        confidence_interval: 95,
        objective: '',
        methodology: '',
        target_audience: '',
        is_registered_research: false,
        registered_responsible_name: '',
        registered_responsible_registry: '',
        registered_responsible_body: '',
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

export function SurveyWizard() {
    const router = useRouter();
    const [currentStep, setCurrentStep] = useState(1);
    const [data, setData] = useState<WizardData>(initialWizardData);
    const [saving, setSaving] = useState(false);
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const updateTech = useCallback((tech: SurveyTechData) => {
        setData(prev => ({ ...prev, tech }));
    }, []);

    const updateLocalities = useCallback((localities: Locality[]) => {
        setData(prev => ({ ...prev, localities }));
    }, []);

    const updatePremises = useCallback((premises: Premise[]) => {
        setData(prev => ({ ...prev, premises }));
    }, []);

    const updateQuestions = useCallback((questions: Question[]) => {
        setData(prev => ({ ...prev, questions }));
    }, []);

    const goNext = () => setCurrentStep(s => Math.min(s + 1, 4));
    const goPrev = () => setCurrentStep(s => Math.max(s - 1, 1));

    const handleSaveDraft = async () => {
        if (!data.tech.title.trim()) {
            setAlert({ type: 'error', message: 'Preencha ao menos o título da pesquisa antes de salvar.' });
            setCurrentStep(1);
            return;
        }
        setSaving(true);
        setAlert(null);
        try {
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

            const surveyId = json.data?.survey?.id;

            // Salvar localidades, premissas e questões
            if (surveyId) {
                const putRes = await fetch(`/api/surveys/${surveyId}`, {
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
            {/* Cabeçalho */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Nova Pesquisa</h1>
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
        </div>
    );
}
