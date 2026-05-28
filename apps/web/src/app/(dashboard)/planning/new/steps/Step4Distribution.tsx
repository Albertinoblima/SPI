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
    // (Integração com dados de municípios/localidades)

    return (
        <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold mb-1">Distribuição e Cotas</h2>
            <p className="text-slate-400 mb-6">
                Defina como a amostra será distribuída entre as localidades ou rotas.
            </p>

            <div className="border border-slate-700 bg-slate-900/50 rounded-2xl p-6 mb-6">
                <div className="text-center py-8 text-slate-400">
                    <p className="mb-2">⚠️ Interface de distribuição em desenvolvimento</p>
                    <p className="text-sm">
                        Aqui será possível definir cotas por município, localidade ou rota, com sugestão automática baseada no dimensionamento amostral.
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
                    onClick={() => onNext({ distribution: { /* distribuição definida */ } })}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    Próximo passo
                </button>
            </div>
        </div>
    );
};

export default Step4Distribution;
