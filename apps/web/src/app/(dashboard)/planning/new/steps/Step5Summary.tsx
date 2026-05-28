// Passo 5: Resumo, Salvamento e Exportação
// Consolida dados do planejamento e permite salvar/exportar
import React from 'react';

interface Step5SummaryProps {
    planningData: any;
    onSave: () => void;
    onBack: () => void;
    saveSuccess?: boolean;
    saveError?: string | null;
    isSaving?: boolean;
}

const Step5Summary: React.FC<Step5SummaryProps> = ({
    planningData,
    onSave,
    onBack,
    saveSuccess = false,
    saveError = null,
    isSaving = false,
}) => {
    const geo = planningData.geographicBase || {};
    const dist = planningData.distribution || {};
    const sampleSize = planningData.sampleSize || dist.sampleSize || 0;
    const totalPop = geo.metadata?.total_population || 0;

    const municipalities = geo.municipalities || [];
    const quotas = dist.quotas || [];

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h2 className="text-2xl font-semibold mb-1">Resumo do Planejamento</h2>
            <p className="text-slate-400 mb-6">Revise os principais dados antes de salvar.</p>

            {/* Definição */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <span>1. Definição Inicial</span>
                </h3>
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-2 text-sm">
                    <div><span className="text-slate-400">Nome:</span> <span className="font-medium">{planningData.name || '—'}</span></div>
                    <div><span className="text-slate-400">Objetivo:</span> {planningData.objective || '—'}</div>
                    <div><span className="text-slate-400">Tipo de Pesquisa:</span> {planningData.researchType || '—'}</div>
                    <div><span className="text-slate-400">Público-alvo:</span> {planningData.targetAudience || '—'}</div>
                </div>
            </div>

            {/* Base Geográfica */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">2. Base Geográfica</h3>
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm">
                    <div className="mb-2">
                        <span className="text-slate-400">Abrangência:</span> <span className="font-medium">{geo.scope || '—'}</span>
                    </div>
                    <div className="mb-2">
                        <span className="text-slate-400">Municípios selecionados:</span> <span className="font-medium">{municipalities.length}</span>
                    </div>
                    <div>
                        <span className="text-slate-400">População total estimada:</span> <span className="font-semibold text-emerald-400">{totalPop.toLocaleString('pt-BR')}</span>
                    </div>
                    {municipalities.length > 0 && (
                        <div className="mt-3 text-xs text-slate-400">
                            {municipalities.slice(0, 5).map((m: any) => m.name).join(' • ')}
                            {municipalities.length > 5 && ` +${municipalities.length - 5} mais`}
                        </div>
                    )}
                </div>
            </div>

            {/* Dimensionamento */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">3. Dimensionamento Amostral</h3>
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                        <div className="text-slate-400 text-xs">População</div>
                        <div className="font-semibold">{planningData.population?.toLocaleString('pt-BR') || '—'}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs">Margem de erro</div>
                        <div className="font-semibold">{planningData.margin || '—'}%</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs">Nível de confiança</div>
                        <div className="font-semibold">{planningData.confidence || '—'}%</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs">Tamanho da amostra</div>
                        <div className="font-semibold text-emerald-400 text-lg">{sampleSize.toLocaleString('pt-BR')}</div>
                    </div>
                </div>
            </div>

            {/* Distribuição */}
            <div className="mb-6">
                <h3 className="text-lg font-medium mb-3">4. Distribuição e Cotas</h3>
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm">
                    {quotas.length > 0 ? (
                        <div className="space-y-1">
                            {quotas.slice(0, 6).map((q: any, idx: number) => (
                                <div key={idx} className="flex justify-between text-sm">
                                    <span>{q.name} {q.uf ? `(${q.uf})` : ''}</span>
                                    <span className="font-medium">{q.interviews?.toLocaleString('pt-BR') || 0}</span>
                                </div>
                            ))}
                            {quotas.length > 6 && <div className="text-xs text-slate-500">+ {quotas.length - 6} outros...</div>}
                            <div className="pt-2 mt-2 border-t border-slate-700 flex justify-between font-semibold">
                                <span>Total</span>
                                <span>{(dist.totalAssigned || 0).toLocaleString('pt-BR')} entrevistas</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-400">Nenhuma distribuição definida.</p>
                    )}
                </div>
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
                    disabled={saveSuccess || isSaving}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? 'Salvando...' : saveSuccess ? 'Salvo' : 'Salvar Planejamento'}
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
