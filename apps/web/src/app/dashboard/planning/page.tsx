
'use client';
// Página inicial do módulo Planejamento de Pesquisa
// Exibe lista de planejamentos salvos e botão para novo planejamento

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useResearchPlans } from '@/hooks/useResearchPlans';
import { Plus, FileText, ArrowRight } from 'lucide-react';
import type { ResearchPlan } from '@/lib/supabase/researchPlans';

const PlanningDashboardPage = () => {
    const { plans, fetchPlans, loading, error } = useResearchPlans();

    useEffect(() => {
        fetchPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-semibold tracking-tight">Planejamento de Pesquisa</h1>
                    <p className="text-slate-400 mt-1">
                        Consulte planejamentos salvos ou inicie um novo planejamento auxiliar para sua próxima pesquisa.
                    </p>
                </div>

                <Link
                    href="/planning/new"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    <Plus size={18} />
                    Novo Planejamento
                </Link>
            </div>

            <div>
                <h2 className="text-xl font-medium mb-3">Planejamentos Salvos</h2>

                {loading && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className="border border-slate-700 bg-slate-900/60 rounded-2xl p-5 animate-pulse"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-5 h-5 bg-slate-700 rounded mt-1" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 bg-slate-700 rounded w-3/4" />
                                        <div className="h-3 bg-slate-700 rounded w-1/2" />
                                    </div>
                                </div>
                                <div className="mt-4 pt-4 border-t border-slate-800">
                                    <div className="h-3 bg-slate-700 rounded w-2/3" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-red-900/30 border border-red-700 text-red-400 rounded-xl mb-4">
                        Erro ao carregar planejamentos: {error.message || 'Ocorreu um erro inesperado.'}
                        <div className="text-xs opacity-75 mt-1">O incidente foi registrado automaticamente para análise.</div>
                    </div>
                )}

                {!loading && plans.length === 0 && !error && (
                    <div className="border border-dashed border-slate-700 rounded-2xl p-10 text-center">
                        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800">
                            <FileText className="text-slate-400" />
                        </div>
                        <h3 className="text-lg font-medium text-white">Nenhum planejamento salvo ainda</h3>
                        <p className="mt-1 text-sm text-slate-400 max-w-xs mx-auto">
                            Crie seu primeiro planejamento para estruturar amostras, bases geográficas e cotas antes de abrir uma pesquisa.
                        </p>
                        <div className="mt-5">
                            <Link
                                href="/planning/new"
                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                <Plus size={16} />
                                Criar primeiro planejamento
                            </Link>
                        </div>
                    </div>
                )}

                {plans.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {plans.map((plan: ResearchPlan) => (
                            <div
                                key={plan.id}
                                className="border border-slate-700 bg-slate-900/60 rounded-2xl p-5 hover:border-slate-600 transition-colors"
                            >
                                <div className="flex items-start gap-3">
                                    <FileText className="mt-1 text-slate-400" size={20} />
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-medium truncate">{plan.name}</h3>
                                        <p className="text-sm text-slate-500 mt-0.5">
                                            Criado em {new Date(plan.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap gap-3 text-sm">
                                    <Link
                                        href={`/planning/${plan.id}`}
                                        className="text-slate-300 hover:text-white font-medium"
                                    >
                                        Ver detalhes
                                    </Link>

                                    <Link
                                        href={`/planning/new?editId=${plan.id}`}
                                        className="text-amber-400 hover:text-amber-300 font-medium"
                                    >
                                        Editar
                                    </Link>

                                    <button
                                        onClick={async () => {
                                            if (!confirm(`Duplicar o planejamento "${plan.name}"?`)) return;

                                            try {
                                                const { createResearchPlan } = await import('@/lib/supabase/researchPlans');
                                                const newPlan = await createResearchPlan({
                                                    name: `${plan.name} (Cópia)`,
                                                    planningData: plan.planning_data || {},
                                                });
                                                window.location.href = `/planning/new?editId=${newPlan.id}`;
                                            } catch (e: unknown) {
                                                console.error('Duplicate planning error', e);
                                                alert('Erro ao duplicar planejamento. O incidente foi registrado.');
                                                // Report to monitoring
                                                try {
                                                    await fetch('/api/system/errors/ingest', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            errorCode: 'PLANNING_SAVE_FAILED',
                                                            errorMessage: 'Falha ao duplicar planejamento',
                                                            severity: 'high',
                                                            metadata: { planId: plan.id, error: e instanceof Error ? e.message : String(e) },
                                                        }),
                                                    });
                                                } catch { }
                                            }
                                        }}
                                        className="text-emerald-400 hover:text-emerald-300 font-medium"
                                    >
                                        Duplicar
                                    </button>

                                    <Link
                                        href={`/surveys/new?planId=${plan.id}`}
                                        className="text-blue-400 hover:text-blue-300 font-medium ml-auto flex items-center gap-1"
                                    >
                                        Criar Pesquisa <ArrowRight size={15} />
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PlanningDashboardPage;
