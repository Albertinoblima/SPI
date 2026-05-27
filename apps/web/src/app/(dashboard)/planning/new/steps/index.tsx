"use client";
// Componente orquestrador dos passos do planejamento
// Gerencia navegação, estado e persistência entre etapas
import React, { useState } from 'react';
import Step1Definition from './Step1Definition';
import Step2GeographicBase from './Step2GeographicBase';
import Step3SampleSize from './Step3SampleSize';
import Step4Distribution from './Step4Distribution';
import Step5Summary from './Step5Summary';

const steps = [
    Step1Definition,
    Step2GeographicBase,
    Step3SampleSize,
    Step4Distribution,
];

const PlanningSteps = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [planningData, setPlanningData] = useState<any>({});

    const handleNext = (data: any) => {
        setPlanningData((prev: any) => ({ ...prev, ...data }));
        setCurrentStep((prev) => prev + 1);
    };

    const handleBack = () => {
        setCurrentStep((prev) => Math.max(prev - 1, 0));
    };

    const handleSave = async () => {
        try {
            const { createResearchPlan } = await import('@/lib/supabase/researchPlans');
            await createResearchPlan({
                name: planningData.name || 'Planejamento sem nome',
                planningData,
            });
            alert('Planejamento salvo!');
        } catch (err: any) {
            alert('Erro ao salvar planejamento: ' + (err?.message || err));
        }
    };

    if (currentStep === steps.length) {
        return <Step5Summary planningData={planningData} onSave={handleSave} onBack={handleBack} />;
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
