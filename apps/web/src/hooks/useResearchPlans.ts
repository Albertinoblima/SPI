import { useState } from 'react';
import {
    createResearchPlan,
    listResearchPlans,
    updateResearchPlan,
    deleteResearchPlan,
} from '@/lib/supabase/researchPlans';
import { reportClientError } from '@/lib/monitoring/reportClientError';

export function useResearchPlans() {
    const [plans, setPlans] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<any>(null);

    const fetchPlans = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listResearchPlans();
            setPlans(data);
        } catch (err: any) {
            setError(err);
            await reportClientError({
                errorCode: 'PLANNING_LOAD_FAILED',
                errorMessage: err?.message || 'Falha ao carregar planejamentos',
                severity: 'medium',
                metadata: { operation: 'fetchPlans' },
            });
        } finally {
            setLoading(false);
        }
    };

    const createPlan = async (args: any) => {
        setLoading(true);
        setError(null);
        try {
            const data = await createResearchPlan(args);
            setPlans((prev) => [data, ...prev]);
            return data;
        } catch (err: any) {
            setError(err);
            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: err?.message || 'Falha ao salvar planejamento',
                severity: 'high',
                metadata: { operation: 'createPlan', name: args?.name },
            });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const updatePlan = async (id: string, updates: any) => {
        setLoading(true);
        setError(null);
        try {
            const data = await updateResearchPlan(id, updates);
            setPlans((prev) => prev.map((p) => (p.id === id ? data : p)));
            return data;
        } catch (err: any) {
            setError(err);
            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: err?.message || 'Falha ao atualizar planejamento',
                severity: 'high',
                metadata: { operation: 'updatePlan', id },
            });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const deletePlan = async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            await deleteResearchPlan(id);
            setPlans((prev) => prev.filter((p) => p.id !== id));
        } catch (err: any) {
            setError(err);
            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: err?.message || 'Falha ao excluir planejamento',
                severity: 'high',
                metadata: { operation: 'deletePlan', id },
            });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        plans,
        loading,
        error,
        fetchPlans,
        createPlan,
        updatePlan,
        deletePlan,
    };
}

