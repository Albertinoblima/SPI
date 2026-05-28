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
    // (Municípios, Localidades, dados demográficos/eleitorais)

    return (
        <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold mb-1">Base Geográfica</h2>
            <p className="text-slate-400 mb-6">
                Selecione os municípios e localidades que farão parte da base da pesquisa.
            </p>

            <div className="border border-slate-700 bg-slate-900/50 rounded-2xl p-6 mb-6">
                <div className="text-center py-8 text-slate-400">
                    <p className="mb-2">⚠️ Integração com seleção geográfica em desenvolvimento</p>
                    <p className="text-sm">
                        Aqui será integrado o seletor de municípios/localidades + visualização de dados demográficos e eleitorais.
                    </p>
                </div>
            </div>

            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-800 transition-colors"
                >
                    Voltar
                </button>
                <button
                    onClick={() => onNext({ geographicBase: { /* dados selecionados */ } })}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    Próximo passo
                </button>
            </div>
        </div>
    );
};

export default Step2GeographicBase;
