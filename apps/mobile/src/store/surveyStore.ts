// Survey Store (Zustand)
import { create } from 'zustand';
import type { Survey } from '@political-research/shared-types';
import { fetchAssignedSurveys, fetchSurveyBundle } from '@/services/mobileApi';

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
            const surveys = await fetchAssignedSurveys();
            set({ surveys: surveys ?? [] });
        } finally {
            set({ loading: false });
        }
    },

    fetchSurveyById: async (id) => {
        const bundle = await fetchSurveyBundle(id);
        set({ currentSurvey: bundle.survey ?? null });
    },

    setCurrentSurvey: (survey) => set({ currentSurvey: survey }),
}));
