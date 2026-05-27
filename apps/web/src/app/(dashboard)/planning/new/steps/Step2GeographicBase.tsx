// Passo 2: Base Geográfica
// Reutiliza componentes de seleção de municípios/localidades e visualização de dados demográficos/eleitorais
import React from 'react';

interface Step2GeographicBaseProps {
    initialData?: any;
    onNext: (data: any) => void;
    onBack: () => void;
}

const Step2GeographicBase: React.FC<Step2GeographicBaseProps> = ({ initialData, onNext, onBack }) => {
    // TODO: Integrar componentes e endpoints de Base Geográfica já existentes
    return (
        <div>
            <h2>Base Geográfica</h2>
            <p>Selecione municípios e localidades para compor a base da pesquisa.</p>
            {/* TODO: Componente de seleção de municípios/localidades */}
            {/* TODO: Visualização de dados demográficos/eleitorais */}
            <button onClick={onBack}>Voltar</button>
            <button onClick={() => onNext({ /* dados selecionados */ })}>Próximo</button>
        </div>
    );
};

export default Step2GeographicBase;
