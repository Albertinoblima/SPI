// Auth Store (Zustand)
import { create } from 'zustand';
import { supabase, getSupabaseConfigError } from '@/services/supabase';
import type { User } from '@political-research/shared-types';
import type { Session } from '@supabase/supabase-js';
import {
    mobileLoginSchema,
    normalizeMobileAuthErrorMessage,
} from '@/utils/auth';

interface AuthState {
    user: User | null;
    session: Session | null;
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
        const configError = getSupabaseConfigError();
        if (configError) throw new Error(configError);

        const credentials = mobileLoginSchema.parse({ email, password });

        const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
        });
        if (error) throw new Error(normalizeMobileAuthErrorMessage(error.message));
        set({ session: data.session, user: data.user as any });
    },

    signUp: async (email, password, fullName) => {
        const configError = getSupabaseConfigError();
        if (configError) throw new Error(configError);

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } },
        });
        if (error) throw error;
    },

    signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(normalizeMobileAuthErrorMessage(error.message));
        set({ user: null, session: null });
    },

    checkSession: async () => {
        const configError = getSupabaseConfigError();
        if (configError) {
            set({ user: null, session: null, loading: false });
            return;
        }

        set({ loading: true });

        const { data, error } = await supabase.auth.getSession();

        if (error) {
            set({ user: null, session: null, loading: false });
            return;
        }

        set({
            session: data.session,
            user: data.session?.user as any,
            loading: false,
        });
    },
}));

export async function initializeAuthSession() {
    await useAuthStore.getState().checkSession();

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        useAuthStore.setState({
            session,
            user: session?.user as any,
            loading: false,
        });
    });

    return () => {
        data.subscription.unsubscribe();
    };
}
