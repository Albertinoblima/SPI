// Passo 5: Resumo, Salvamento e Exportação
// Consolida dados do planejamento e permite salvar/exportar
import React from 'react';

interface Step5SummaryProps {
    planningData: any;
    onSave: () => void;
    onBack: () => void;
    saveSuccess?: boolean;
    saveError?: string | null;
}

const Step5Summary: React.FC<Step5SummaryProps> = ({
    planningData,
    onSave,
    onBack,
    saveSuccess = false,
    saveError = null,
}) => {
    return (
        <div className="max-w-2xl mx-auto p-6">
            <h2 className="text-2xl font-semibold mb-4">Resumo do Planejamento</h2>

            <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 mb-6">
                <pre className="text-sm text-slate-300 overflow-auto">
                    {JSON.stringify(planningData, null, 2)}
                </pre>
            </div>

            {saveSuccess && (
                <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-700 text-emerald-400 rounded-lg">
                    Planejamento salvo com sucesso!
                </div>
            )}

            {saveError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 text-red-400 rounded-lg">
                    {saveError}
                </div>
            )}

            <div className="flex gap-3">
                <button
                    onClick={onBack}
                    className="px-4 py-2 rounded-lg border border-slate-600 hover:bg-slate-800"
                >
                    Voltar
                </button>
                <button
                    onClick={onSave}
                    disabled={saveSuccess}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50"
                >
                    {saveSuccess ? 'Salvo' : 'Salvar Planejamento'}
                </button>
            </div>

            {/* TODO: Botão de exportar PDF/JSON */}
        </div>
    );
};

export default Step5Summary;
