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

const DRAFT_KEY = 'planning_draft_v1';

const steps = [
    Step1Definition,
    Step2GeographicBase,
    Step3SampleSize,
    Step4Distribution,
];

const PlanningSteps = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [planningData, setPlanningData] = useState<any>({});
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    // Load draft from localStorage on mount
    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed?.data) {
                    setPlanningData(parsed.data);
                    if (typeof parsed.step === 'number') {
                        setCurrentStep(Math.min(parsed.step, steps.length));
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

    const handleNext = (data: any) => {
        setPlanningData((prev: any) => ({ ...prev, ...data }));
        setCurrentStep((prev) => prev + 1);
        setSaveError(null);
    };

    const handleBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
        setSaveError(null);
    };

    const handleSave = async () => {
        setSaveError(null);
        setSaveSuccess(false);

        try {
            const { createResearchPlan } = await import('@/lib/supabase/researchPlans');
            await createResearchPlan({
                name: planningData.name || 'Planejamento sem nome',
                planningData,
            });
            setSaveSuccess(true);
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
        }
    };

    if (currentStep === steps.length) {
        return (
            <Step5Summary
                planningData={planningData}
                onSave={handleSave}
                onBack={handleBack}
                saveSuccess={saveSuccess}
                saveError={saveError}
            />
        );
    }

    const StepComponent = steps[currentStep];
    return (
        <StepComponent
            initialData={planningData}
            onNext={handleNext}
            onBack={handleBack}
        />
    );
};

export default PlanningSteps;
