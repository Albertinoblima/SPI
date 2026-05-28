// Visualização de planejamento salvo
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const PlanningViewPage = () => {
    const params = useParams();
    const planId = params.id as string;

    const [plan, setPlan] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

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
            } finally {
                setLoading(false);
            }
        };

        fetchPlan();
    }, [planId]);

    if (loading) {
        return <div className="p-8">Carregando planejamento...</div>;
    }

    if (error || !plan) {
        return (
            <div className="p-8">
                <p className="text-red-400">Erro: {error || 'Planejamento não encontrado'}</p>
                <Link href="/planning" className="text-blue-400 hover:underline mt-4 inline-block">
                    Voltar para lista
                </Link>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-3xl font-semibold">{plan.name}</h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Criado em {new Date(plan.created_at).toLocaleDateString('pt-BR')}
                    </p>
                </div>

                <div className="flex gap-3">
                    <Link
                        href={`/planning/new?editId=${plan.id}`}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-sm font-medium"
                    >
                        Editar Planejamento
                    </Link>
                    <Link
                        href={`/surveys/new?planId=${plan.id}`}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium"
                    >
                        Criar Pesquisa
                    </Link>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                <h2 className="text-xl font-medium mb-4">Dados do Planejamento</h2>
                <pre className="text-sm bg-slate-950 p-4 rounded-lg overflow-auto">
                    {JSON.stringify(plan.planning_data, null, 2)}
                </pre>
            </div>

            <div className="mt-6">
                <Link href="/planning" className="text-slate-400 hover:text-white text-sm">
                    ← Voltar para meus planejamentos
                </Link>
            </div>
        </div>
    );
};

export default PlanningViewPage;
