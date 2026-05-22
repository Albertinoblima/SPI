// Auth Store (Zustand)
import { create } from 'zustand';
import type { User } from '@political-research/shared-types';
import {
    mobileLoginSchema,
    normalizeMobileAuthErrorMessage,
} from '@/utils/auth';
import {
    clearMobileSession,
    getValidSession,
    loginMobile,
    type MobileSession,
} from '@/services/mobileApi';

interface AuthState {
    user: User | null;
    session: MobileSession | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<void>;
    signUp: (_email: string, _password: string, _fullName: string) => Promise<void>;
    signOut: () => Promise<void>;
    checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    session: null,
    loading: true,

    signIn: async (email, password) => {
        const credentials = mobileLoginSchema.parse({ email, password });

        try {
            const session = await loginMobile(credentials.email, credentials.password);
            set({ session, user: session.user as User });
        } catch (error: any) {
            throw new Error(normalizeMobileAuthErrorMessage(error?.message));
        }
    },

    signUp: async () => {
        throw new Error('Cadastro via aplicativo nao habilitado. Solicite criacao de usuario ao administrador.');
    },

    signOut: async () => {
        await clearMobileSession();
        set({ user: null, session: null });
    },

    checkSession: async () => {
        set({ loading: true });

        const session = await getValidSession();
        if (!session) {
            set({ user: null, session: null, loading: false });
            return;
        }

        set({
            session,
            user: session.user as User,
            loading: false,
        });
    },
}));

export async function initializeAuthSession() {
    await useAuthStore.getState().checkSession();
    return () => undefined;
}
