// Survey Store (Zustand)
import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import type { Survey } from '@political-research/shared-types';

interface SurveyState {
    surveys: Survey[];
    currentSurvey: Survey | null;
    loading: boolean;
    fetchSurveys: () => Promise<void>;
    fetchSurveyById: (id: string) => Promise<void>;
    setCurrentSurvey: (survey: Survey | null) => void;
}

export const useSurveyStore = create<SurveyState>((set) => ({
    surveys: [],
    currentSurvey: null,
    loading: false,

    fetchSurveys: async () => {
        set({ loading: true });
        try {
            const { data, error } = await supabase
                .from('surveys')
                .select('*')
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;
            set({ surveys: data ?? [] });
        } finally {
            set({ loading: false });
        }
    },

    fetchSurveyById: async (id) => {
        const { data, error } = await supabase
            .from('surveys')
            .select('*, questions(*)')
            .eq('id', id)
            .single();

        if (error) throw error;
        set({ currentSurvey: data });
    },

    setCurrentSurvey: (survey) => set({ currentSurvey: survey }),
}));
