// Passo 5: Resumo, Salvamento e Exportação
// Consolida dados do planejamento e permite salvar/exportar
import React from 'react';

interface Step5SummaryProps {
    planningData: any;
    onSave: () => void;
    onBack: () => void;
}

const Step5Summary: React.FC<Step5SummaryProps> = ({ planningData, onSave, onBack }) => {
    // TODO: Implementar exportação PDF/JSON
    return (
        <div>
            <h2>Resumo do Planejamento</h2>
            <pre>{JSON.stringify(planningData, null, 2)}</pre>
            <button onClick={onBack}>Voltar</button>
            <button onClick={onSave}>Salvar Planejamento</button>
            {/* TODO: Botão de exportar PDF/JSON */}
        </div>
    );
};

export default Step5Summary;
