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
                <div className="mb-6 p-4 bg-emerald-900/30 border border-emerald-700 text-emerald-400 rounded-xl">
                    <p className="font-medium">Planejamento salvo com sucesso!</p>
                    <div className="mt-3 flex gap-3">
                        <a
                            href="/planning"
                            className="text-sm px-4 py-1.5 bg-emerald-700 hover:bg-emerald-600 rounded-lg text-white inline-block"
                        >
                            Ver meus planejamentos
                        </a>
                        <a
                            href={`/surveys/new?planId=${planningData.id || ''}`}
                            className="text-sm px-4 py-1.5 border border-emerald-600 hover:bg-emerald-900/50 rounded-lg inline-block"
                        >
                            Criar Pesquisa a partir deste plano
                        </a>
                    </div>
                </div>
            )}

            {saveError && (
                <div className="mb-4 p-3 bg-red-900/30 border border-red-700 text-red-400 rounded-lg">
                    {saveError}
                </div>
            )}

            <div className="flex gap-3 items-center">
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

                {!saveSuccess && (
                    <button
                        onClick={() => {
                            if (confirm('Deseja descartar este rascunho?')) {
                                localStorage.removeItem('planning_draft_v1');
                                window.location.href = '/planning/new';
                            }
                        }}
                        className="text-sm text-slate-400 hover:text-red-400 ml-3"
                    >
                        Descartar rascunho
                    </button>
                )}
            </div>

            {/* TODO: Botão de exportar PDF/JSON */}
        </div>
    );
};

export default Step5Summary;
