'use client';
// Componente orquestrador dos passos do planejamento
// Gerencia navegação, estado e persistência entre etapas
import React, { useState, useEffect } from 'react';
import Step1Definition from './Step1Definition';
import Step2GeographicBase from './Step2GeographicBase';
import Step3SampleSize from './Step3SampleSize';
import Step4Distribution from './Step4Distribution';
import Step5Summary from './Step5Summary';
import { reportClientError } from '@/lib/monitoring/reportClientError';
import { Check } from 'lucide-react';

const DRAFT_KEY = 'planning_draft_v1';

const stepTitles = [
    'Definição Inicial',
    'Base Geográfica',
    'Dimensionamento Amostral',
    'Distribuição e Cotas',
    'Resumo e Salvamento',
];

const PlanningSteps = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [planningData, setPlanningData] = useState<any>({});
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    // Load draft from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.data) {
                    setPlanningData(parsed.data);
                    if (typeof parsed.step === 'number') {
                        setCurrentStep(Math.min(parsed.step, stepTitles.length - 1));
                    }
                }
            }
        } catch {}
    }, []);

    // Auto-save draft
    useEffect(() => {
        if (Object.keys(planningData).length > 0) {
            try {
                localStorage.setItem(DRAFT_KEY, JSON.stringify({
                    data: planningData,
                    step: currentStep,
                    savedAt: new Date().toISOString(),
                }));
            } catch {}
        }
    }, [planningData, currentStep]);

    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        setPlanningData({});
        setCurrentStep(0);
        setSaveSuccess(false);
        setSaveError(null);
    };

    const handleNext = (data: any) => {
        const updatedData = { ...planningData, ...data };
        setPlanningData(updatedData);
        setSaveError(null);

        // Basic validation before advancing
        if (currentStep === 0 && !updatedData.name?.trim()) {
            setSaveError('O nome do planejamento é obrigatório.');
            return;
        }

        const nextStep = currentStep + 1;
        setCurrentStep(nextStep);
    };

    const handleBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
        setSaveError(null);
    };

    const handleSave = async () => {
        setSaveError(null);
        setSaveSuccess(false);
        setIsSaving(true);

        try {
            const { createResearchPlan } = await import('@/lib/supabase/researchPlans');
            const savedPlan = await createResearchPlan({
                name: planningData.name || 'Planejamento sem nome',
                planningData,
            });

            setSaveSuccess(true);

            // Clear draft after successful save
            localStorage.removeItem(DRAFT_KEY);

            // Update local data with saved plan (so links work)
            setPlanningData((prev: any) => ({ ...prev, id: savedPlan.id }));
        } catch (err: any) {
            const message = err?.message || 'Erro desconhecido ao salvar planejamento';
            setSaveError(message);

            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: message,
                severity: 'high',
                metadata: {
                    step: currentStep,
                    hasName: !!planningData.name,
                    planningDataKeys: Object.keys(planningData),
                },
            });
        } finally {
            setIsSaving(false);
        }
    };

    // Simple Stepper
    const renderStepper = () => (
        <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
            {stepTitles.map((title, index) => {
                const isActive = index === currentStep;
                const isCompleted = index < currentStep;

                return (
                    <div key={index} className="flex flex-col items-center flex-1">
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium mb-1 transition-colors ${
                                isCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-slate-700 text-slate-400'
                            }`}
                        >
                            {isCompleted ? <Check size={16} /> : index + 1}
                        </div>
                        <span className={`text-xs text-center hidden md:block ${isActive ? 'text-white' : 'text-slate-400'}`}>
                            {title}
                        </span>
                    </div>
                );
            })}
        </div>
    );

    // Render Step 5 (Summary)
    if (currentStep === 4) {
        return (
            <div>
                {renderStepper()}
                <Step5Summary
                    planningData={planningData}
                    onSave={handleSave}
                    onBack={handleBack}
                    saveSuccess={saveSuccess}
                    saveError={saveError}
                    isSaving={isSaving}
                />
            </div>
        );
    }

    const stepComponents = [
        Step1Definition,
        Step2GeographicBase,
        Step3SampleSize,
        Step4Distribution,
    ];

    const StepComponent = stepComponents[currentStep];

    return (
        <div>
            {renderStepper()}

            <StepComponent
                initialData={planningData}
                onNext={handleNext}
                onBack={handleBack}
            />
        </div>
    );
};

export default PlanningSteps;
