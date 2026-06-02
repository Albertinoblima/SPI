// Página de orquestração dos passos do planejamento
import React, { Suspense } from 'react';
import PlanningSteps from './index';

function PlanningStepsContent() {
    return <PlanningSteps />;
}

const PlanningStepsPage = () => {
    return (
        <Suspense fallback={<div className="p-8 text-slate-400">Carregando assistente de planejamento...</div>}>
            <PlanningStepsContent />
        </Suspense>
    );
};

export default PlanningStepsPage;
