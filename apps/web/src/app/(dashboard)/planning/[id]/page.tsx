// Visualização de planejamento salvo
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { reportClientError } from '@/lib/monitoring/reportClientError';
import { 
    FileText, MapPin, Users, BarChart3, Copy, Edit2, ArrowRight, 
    Calendar, Target 
} from 'lucide-react';

const PlanningViewPage = () => {
    const params = useParams();
    const router = useRouter();
    const planId = params.id as string;

    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDuplicating, setIsDuplicating] = useState(false);

    useEffect(() => {
        const fetchPlan = async () => {
            if (!planId) return;

            setLoading(true);
            try {
                const supabase = createClient();
                const { data, error } = await supabase
                    .from('research_plans')
                    .select('*')
                    .eq('id', planId)
                    .single();

                if (error) throw error;
                setPlan(data);
            } catch (err: any) {
                setError(err.message || 'Erro ao carregar planejamento');
                await reportClientError({
                    errorCode: 'PLANNING_LOAD_FAILED',
                    errorMessage: `Falha ao carregar detalhes do planejamento ${planId}`,
                    severity: 'medium',
                    metadata: { planId },
                });
            } finally {
                setLoading(false);
            }
        };

        fetchPlan();
    }, [planId]);

    const handleDuplicate = async () => {
        if (!plan) return;

        setIsDuplicating(true);
        try {
            const { createResearchPlan } = await import('@/lib/supabase/researchPlans');
            
            const duplicatedName = `${plan.name} (Cópia)`;
            
            const newPlan = await createResearchPlan({
                name: duplicatedName,
                planningData: plan.planning_data,
            });

            // Redireciona para a página de edição do novo planejamento
            router.push(`/planning/new?editId=${newPlan.id}`);
        } catch (err: any) {
            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: 'Falha ao duplicar planejamento',
                severity: 'high',
                metadata: { originalPlanId: planId, error: err?.message },
            });
            alert('Erro ao duplicar planejamento. Tente novamente.');
        } finally {
            setIsDuplicating(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 bg-slate-800 rounded w-1/3"></div>
                    <div className="h-4 bg-slate-800 rounded w-1/4"></div>
                    <div className="h-64 bg-slate-900 border border-slate-700 rounded-2xl"></div>
                </div>
            </div>
        );
    }

    if (error || !plan) {
        return (
            <div className="max-w-4xl mx-auto p-8">
                <p className="text-red-400 text-lg">{error || 'Planejamento não encontrado'}</p>
                <Link href="/planning" className="text-blue-400 hover:underline mt-4 inline-block">
                    ← Voltar para meus planejamentos
                </Link>
            </div>
        );
    }

    const data = plan.planning_data || {};
    const sampleSize = data.sampleSize || data.distribution?.sampleSize;
    const municipalities = data.geographicBase?.municipalities || [];
    const totalQuotas = data.distribution?.quotas?.reduce((sum: number, q: any) => sum + (q.interviews || 0), 0);

    return (
        <div className="max-w-5xl mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <FileText className="text-blue-400" size={28} />
                        <h1 className="text-3xl font-semibold tracking-tight">{plan.name}</h1>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-2">
                        <div className="flex items-center gap-1.5">
                            <Calendar size={15} />
                            Criado em {new Date(plan.created_at).toLocaleDateString('pt-BR')}
                        </div>
                        {plan.updated_at && plan.updated_at !== plan.created_at && (
                            <div> • Atualizado em {new Date(plan.updated_at).toLocaleDateString('pt-BR')}</div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={handleDuplicate}
                        disabled={isDuplicating}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-60 rounded-lg text-sm font-medium transition-colors"
                    >
                        <Copy size={16} />
                        {isDuplicating ? 'Duplicando...' : 'Duplicar'}
                    </button>

                    <Link
                        href={`/planning/new?editId=${plan.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        <Edit2 size={16} />
                        Editar
                    </Link>

                    <Link
                        href={`/surveys/new?planId=${plan.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Criar Pesquisa
                        <ArrowRight size={16} />
                    </Link>
                </div>
            </div>

            {/* Resumo Rápido */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div className="text-xs text-slate-400">Tamanho da Amostra</div>
                    <div className="text-3xl font-semibold mt-1 text-white">
                        {sampleSize ? sampleSize.toLocaleString('pt-BR') : '—'}
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div className="text-xs text-slate-400">Municípios na Base</div>
                    <div className="text-3xl font-semibold mt-1 text-white">
                        {municipalities.length}
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div className="text-xs text-slate-400">Entrevistas Distribuídas</div>
                    <div className="text-3xl font-semibold mt-1 text-white">
                        {totalQuotas ? totalQuotas.toLocaleString('pt-BR') : '—'}
                    </div>
                </div>
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4">
                    <div className="text-xs text-slate-400">Status</div>
                    <div className="mt-1">
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-900 text-emerald-400">
                            {plan.status === 'draft' ? 'Rascunho' : plan.status || 'Ativo'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Seção: Definição Inicial */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Target className="text-blue-400" />
                    <h2 className="text-xl font-semibold">Definição Inicial</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <div>
                        <div className="text-slate-400">Nome</div>
                        <div className="font-medium mt-0.5">{plan.name}</div>
                    </div>
                    <div>
                        <div className="text-slate-400">Tipo de Pesquisa</div>
                        <div className="font-medium mt-0.5">{data.researchType || '—'}</div>
                    </div>
                    <div className="md:col-span-2">
                        <div className="text-slate-400">Objetivo</div>
                        <div className="mt-1 text-slate-200 whitespace-pre-wrap">
                            {data.objective || 'Não informado'}
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <div className="text-slate-400">Público-alvo</div>
                        <div className="mt-1 text-slate-200">{data.targetAudience || 'Não informado'}</div>
                    </div>
                </div>
            </div>

            {/* Seção: Base Geográfica */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <MapPin className="text-blue-400" />
                    <h2 className="text-xl font-semibold">Base Geográfica</h2>
                </div>

                {Array.isArray(data.geographicBase?.municipalities) && data.geographicBase.municipalities.length > 0 ? (
                    <div>
                        <div className="text-sm text-slate-400 mb-2">
                            Abrangência: <span className="text-white font-medium">{data.geographicBase?.scope || 'N/A'}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {data.geographicBase.municipalities.map((m: any, idx: number) => (
                                <div key={idx} className="bg-slate-800 border border-slate-700 px-3 py-1 rounded-full text-sm flex items-center gap-2">
                                    {m?.name || 'Desconhecido'} - {m?.uf || ''}
                                    {m?.population && (
                                        <span className="text-xs text-slate-400">({Number(m.population).toLocaleString('pt-BR')})</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-400">Nenhuma base geográfica definida.</p>
                )}
            </div>

            {/* Seção: Dimensionamento Amostral */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <BarChart3 className="text-blue-400" />
                    <h2 className="text-xl font-semibold">Dimensionamento Amostral</h2>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <div className="text-2xl font-semibold text-white">{data.population || '—'}</div>
                        <div className="text-xs text-slate-400 mt-1">População-alvo</div>
                    </div>
                    <div>
                        <div className="text-2xl font-semibold text-white">{data.margin || '—'}%</div>
                        <div className="text-xs text-slate-400 mt-1">Margem de erro</div>
                    </div>
                    <div>
                        <div className="text-2xl font-semibold text-white">{data.confidence || '—'}%</div>
                        <div className="text-xs text-slate-400 mt-1">Nível de confiança</div>
                    </div>
                    <div>
                        <div className="text-2xl font-semibold text-emerald-400">
                            {sampleSize ? sampleSize.toLocaleString('pt-BR') : '—'}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Tamanho da amostra</div>
                    </div>
                </div>
            </div>

            {/* Seção: Distribuição e Cotas */}
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Users className="text-blue-400" />
                    <h2 className="text-xl font-semibold">Distribuição e Cotas</h2>
                </div>

                {Array.isArray(data.distribution?.quotas) && data.distribution.quotas.length > 0 ? (
                    <div className="space-y-2">
                        {data.distribution.quotas.map((q: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center bg-slate-800 px-4 py-2.5 rounded-xl text-sm">
                                <span>{q?.name || 'Desconhecido'} {q?.uf ? `(${q.uf})` : ''}</span>
                                <span className="font-medium text-white">{Number(q?.interviews || 0).toLocaleString('pt-BR')} entrevistas</span>
                            </div>
                        ))}
                        <div className="text-right text-sm text-slate-400 mt-2">
                            Total: <span className="font-semibold text-white">{Number(data.distribution?.totalAssigned || 0).toLocaleString('pt-BR')}</span>
                        </div>
                    </div>
                ) : (
                    <p className="text-slate-400">Nenhuma distribuição definida.</p>
                )}
            </div>

            <div className="mt-8 flex justify-end">
                <Link href="/planning" className="text-sm text-slate-400 hover:text-white flex items-center gap-1">
                    ← Voltar para meus planejamentos
                </Link>
            </div>
        </div>
    );
};

export default PlanningViewPage;
