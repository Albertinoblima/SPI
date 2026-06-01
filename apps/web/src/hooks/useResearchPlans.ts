import { useState } from 'react';
import {
    createResearchPlan,
    listResearchPlans,
    updateResearchPlan,
    deleteResearchPlan,
    type ResearchPlan,
} from '@/lib/supabase/researchPlans';
import { reportClientError } from '@/lib/monitoring/reportClientError';

export function useResearchPlans() {
    const [plans, setPlans] = useState<ResearchPlan[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchPlans = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await listResearchPlans();
            setPlans(data);
        } catch (err: unknown) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            await reportClientError({
                errorCode: 'PLANNING_LOAD_FAILED',
                errorMessage: e.message || 'Falha ao carregar planejamentos',
                severity: 'medium',
                metadata: { operation: 'fetchPlans' },
            });
        } finally {
            setLoading(false);
        }
    };

    const createPlan = async (args: { name: string; planningData: Record<string, unknown>; status?: string; linkedSurveyId?: string | null }) => {
        setLoading(true);
        setError(null);
        try {
            const data = await createResearchPlan(args);
            setPlans((prev) => [data, ...prev]);
            return data;
        } catch (err: unknown) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: e.message || 'Falha ao salvar planejamento',
                severity: 'high',
                metadata: { operation: 'createPlan', name: (args as { name?: string }).name },
            });
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const updatePlan = async (id: string, updates: Partial<ResearchPlan>) => {
        setLoading(true);
        setError(null);
        try {
            const data = await updateResearchPlan(id, updates);
            setPlans((prev) => prev.map((p) => (p.id === id ? data : p)));
            return data;
        } catch (err: unknown) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: e.message || 'Falha ao atualizar planejamento',
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
        } catch (err: unknown) {
            const e = err instanceof Error ? err : new Error(String(err));
            setError(e);
            await reportClientError({
                errorCode: 'PLANNING_SAVE_FAILED',
                errorMessage: e.message || 'Falha ao excluir planejamento',
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

