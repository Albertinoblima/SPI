
"use client";
// Página inicial do módulo Planejamento de Pesquisa
// Exibe lista de planejamentos salvos e botão para novo planejamento


import React, { useEffect } from 'react';
import { useResearchPlans } from '@/hooks/useResearchPlans';
import styles from './planning.module.css';

const PlanningDashboardPage = () => {
    const { plans, fetchPlans, loading, error } = useResearchPlans();

    useEffect(() => {
        fetchPlans();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <main>
            <h1>Planejamento de Pesquisa</h1>
            <p>Consulte planejamentos salvos ou inicie um novo planejamento auxiliar para sua próxima pesquisa.</p>
            <a href="/planning/new">Novo Planejamento</a>
            <hr />
            <h2>Planejamentos Salvos</h2>
            {loading && <p>Carregando...</p>}
            {error && <p className={styles['text-error']}>Erro: {error.message || String(error)}</p>}
            {plans.length === 0 && !loading && <p>Nenhum planejamento salvo.</p>}
            <ul>
                {plans.map((plan: any) => (
                    <li key={plan.id}>
                        <strong>{plan.name}</strong> <br />
                        <small>Criado em: {new Date(plan.created_at).toLocaleString()}</small>
                        <br />
                        <a
                            href={`/surveys/new?planId=${plan.id}`}
                            className={styles['create-survey-btn']}
                            title="Criar Pesquisa a partir deste Planejamento"
                        >
                            Criar Pesquisa a partir deste Planejamento
                        </a>
                        {/* Link para detalhes/edição futura */}
                    </li>
                ))}
            </ul>
        </main>
    );
};

export default PlanningDashboardPage;
