// Passo 5: Resumo, Salvamento e Exportação
// Consolida dados do planejamento e permite salvar/exportar
import React from 'react';

interface PlanningData {
    id?: string;
    sampleSize?: number;
    geographicBase?: {
        municipalities?: Array<{
            id?: string;
            name: string;
            uf?: string;
            population?: number;
            localities?: any[]; // keep for now
        }>;
        metadata?: {
            total_population?: number;
        };
    };
    distribution?: {
        sampleSize?: number;
        quotas?: Array<{
            name: string;
            population?: number;
            interviews?: number;
        }>;
        interviewerAssignments?: Array<{
            interviewerId: string;
            localityKey?: string;
            interviews?: number;
        }>;
    };
}

interface Step5SummaryProps {
    planningData: PlanningData;
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
                            {municipalities.slice(0, 5).map((m: { name: string }) => m.name).join(' • ')}
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
                        <>
                            <div className="space-y-1">
                                {quotas.slice(0, 6).map((q: { name: string; interviews?: number }, idx: number) => (
                                    <div key={item.id || item.name || idx} className="flex justify-between text-sm">
                                        <span>{q.name} {q.uf ? `(${q.uf})` : ''}</span>
                                        <span className="font-medium">{q.interviews?.toLocaleString('pt-BR') || 0}</span>
                                    </div>
                                ))}
                                {quotas.length > 6 && <div className="text-xs text-slate-500">+ {quotas.length - 6} outros...</div>}
                            </div>

                            <div className="pt-3 mt-3 border-t border-slate-700">
                                <div className="flex justify-between font-semibold">
                                    <span>Total</span>
                                    <span>{(dist.totalAssigned || 0).toLocaleString('pt-BR')} entrevistas</span>
                                </div>

                                {/* Alerta de qualidade da distribuição */}
                                {sampleSize > 0 && Math.abs((dist.totalAssigned || 0) - sampleSize) > sampleSize * 0.1 && (
                                    <div className="mt-2 text-xs text-amber-400">
                                        ⚠️ A distribuição atual tem mais de 10% de diferença em relação ao tamanho da amostra.
                                    </div>
                                )}

                                {geo?.municipalities?.length > 0 && totalPop > 0 && (
                                    <div className="mt-1 text-xs text-slate-400">
                                        Densidade geral: {((dist.totalAssigned || 0) / totalPop * 10000).toFixed(1)} entrevistas por 10 mil habitantes.
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <p className="text-slate-400">Nenhuma distribuição definida.</p>
                    )}
                </div>
            </div>

            {/* Nova seção: Distribuição por Entrevistador (Planejamento Ponta a Ponta) */}
            {dist.interviewerAssignments && dist.interviewerAssignments.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-lg font-medium mb-3">5. Distribuição por Entrevistador</h3>
                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm">
                        <div className="text-emerald-400 text-xs mb-2">Cotas atribuídas individualmente • Visível no app do entrevistador</div>

                        {/* Simple grouped view by interviewer */}
                        {(() => {
                            const byInterviewer: Record<string, number> = {};
                            dist.interviewerAssignments.forEach((a: { interviewerId: string; interviews?: number }) => {
                                byInterviewer[a.interviewerId] = (byInterviewer[a.interviewerId] || 0) + (a.interviews || 0);
                            });
                            return Object.entries(byInterviewer).slice(0, 6).map(([interviewer, total]) => (
                                <div key={interviewer} className="flex justify-between py-0.5">
                                    <span className="text-slate-300">{interviewer}</span>
                                    <span className="font-semibold">{total} entrevistas</span>
                                </div>
                            ));
                        })()}

                        <div className="pt-2 mt-2 border-t border-slate-700 text-[10px] text-emerald-400">
                            Total distribuído para equipe: {dist.interviewerAssignments.reduce((s: number, a: { interviews?: number }) => s + (a.interviews || 0), 0)}
                        </div>
                    </div>
                </div>
            )}

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
                            className="text-sm px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg inline-block font-medium"
                        >
                            Criar Pesquisa com esta Distribuição por Entrevistador →
                        </a>
                        <p className="text-[10px] text-emerald-500 mt-1">
                            As cotas por entrevistador serão aplicadas automaticamente ao publicar a pesquisa.
                        </p>

                        {/* Direct powerful action - best UX decision for closing the loop */}
                        <button
                            onClick={async () => {
                                if (!confirm('Criar a pesquisa agora com as cotas por entrevistador definidas?')) return;

                                // Simple local loading state
                                try {
                                    const dist = planningData.distribution || {};
                                    const geo = planningData.geographicBase || {};

                                    const createRes = await fetch('/api/surveys', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            title: planningData.name || 'Pesquisa sem título',
                                            description: planningData.objective || '',
                                            total_interviews: dist.sampleSize || 0,
                                            planning_data_id: planningData.id,
                                            localities: (geo.municipalities || []).map((m: { name: string; population?: number }) => ({
                                                name: m.name,
                                                zone: m.zone || 'mixed',
                                                population: m.population || m.enriched?.population_census || 0,
                                            })),
                                        }),
                                    });

                                    const createJson = await createRes.json();
                                    if (!createRes.ok) {
                                        alert('Erro ao criar pesquisa: ' + (createJson.error || 'Desconhecido'));
                                        return;
                                    }

                                    const newSurveyId = createJson.data?.survey?.id;
                                    if (!newSurveyId) {
                                        alert('Pesquisa criada, mas não foi possível obter o ID.');
                                        return;
                                    }

                                    // 1. Add interviewers to the team
                                    if (dist.interviewerAssignments && dist.interviewerAssignments.length > 0) {
                                        const uniqueInterviewers = [...new Set(dist.interviewerAssignments.map((a: { interviewerId: string }) => a.interviewerId))];
                                        for (const interviewerId of uniqueInterviewers) {
                                            await fetch(`/api/surveys/${newSurveyId}/team`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    user_id: interviewerId,
                                                    role: 'interviewer',
                                                }),
                                            }).catch(() => {});
                                        }
                                    }

                                    // 2. Seed the interviewer distribution (core of ponta a ponta)
                                    if (dist.interviewerAssignments && dist.interviewerAssignments.length > 0) {
                                        await fetch(`/api/surveys/${newSurveyId}/distribution`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                interviewer_quotas: dist.interviewerAssignments.map((a: { interviewerId: string; localityKey?: string; interviews?: number }) => ({
                                                    interviewer_id: a.interviewerId,
                                                    locality: a.localityKey,
                                                    quota: a.interviews,
                                                })),
                                            }),
                                        });
                                    }

                                    alert('Pesquisa criada com sucesso! Equipe + cotas por entrevistador aplicadas automaticamente (loop ponta a ponta completo). Redirecionando...');
                                    window.location.href = `/surveys/${newSurveyId}`;
                                } catch (e: unknown) {
                                    const message = e instanceof Error ? e.message : String(e);
                                    alert('Erro: ' + message);
                                }
                            }}
                            className="mt-3 w-full text-sm px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg font-semibold"
                        >
                            Criar Pesquisa AGORA + Aplicar Cotas por Entrevistador
                        </button>
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
