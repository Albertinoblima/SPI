// Passo 4: Distribuição e Cotas
// Interface para definir número de entrevistas por localidade/rota
import React from 'react';

interface Step4DistributionProps {
    initialData?: any;
    onNext: (data: any) => void;
    onBack: () => void;
}

const Step4Distribution: React.FC<Step4DistributionProps> = ({ initialData, onNext, onBack }) => {
    // TODO: Sugerir distribuição automática com base na amostra e dados geográficos
    return (
        <div>
            <h2>Distribuição e Cotas</h2>
            <p>Defina o número de entrevistas por localidade/rota.</p>
            {/* TODO: Interface de distribuição automática/manual */}
            <button onClick={onBack}>Voltar</button>
            <button onClick={() => onNext({ /* distribuição definida */ })}>Próximo</button>
        </div>
    );
};

export default Step4Distribution;
