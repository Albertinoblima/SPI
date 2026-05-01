// Auth Store (Zustand)
import { create } from 'zustand';
import { supabase } from '@/services/supabase';
import type { User } from '@political-research/shared-types';

interface AuthState {
    user: User | null;
    session: any | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (email: string, password: string, fullName: string) => Promise<void>;
    signOut: () => Promise<void>;
    checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    loading: true,

    signIn: async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        if (error) throw error;
        set({ session: data.session, user: data.user as any });
    },

    signUp: async (email, password, fullName) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
        });
        if (error) throw error;
    },

    signOut: async () => {
        await supabase.auth.signOut();
        set({ user: null, session: null });
    },

    checkSession: async () => {
        const { data } = await supabase.auth.getSession();
        set({
            session: data.session,
            user: data.session?.user as any,
            loading: false,
        });
    },
}));
