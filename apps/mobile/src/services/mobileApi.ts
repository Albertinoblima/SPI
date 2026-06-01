import * as SecureStore from 'expo-secure-store';
import type { Survey, User } from '@political-research/shared-types';

const API_BASE_URL = (process.env['EXPO_PUBLIC_WEB_API_URL'] ?? '').trim().replace(/\/$/, '');

const ACCESS_TOKEN_KEY = 'mobile_access_token';
const REFRESH_TOKEN_KEY = 'mobile_refresh_token';
const ACCESS_EXPIRES_AT_KEY = 'mobile_access_expires_at';
const REFRESH_EXPIRES_AT_KEY = 'mobile_refresh_expires_at';
const USER_KEY = 'mobile_user_profile';

export interface MobileSession {
    accessToken: string;
    refreshToken: string;
    accessExpiresAt: string;
    refreshExpiresAt: string;
    user: User;
}

interface AssignedSurveysPayload {
    surveys?: Survey[];
}

interface SurveyBundlePayload {
    survey: Survey;
    role: string;
    routes: unknown[];
    quotas: unknown[];
}

function ensureApiBaseUrl() {
    if (!API_BASE_URL) {
        throw new Error('Defina EXPO_PUBLIC_WEB_API_URL no .env do mobile para habilitar autenticação e coleta.');
    }
}

async function saveSession(session: MobileSession): Promise<void> {
    await Promise.all([
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken),
        SecureStore.setItemAsync(ACCESS_EXPIRES_AT_KEY, session.accessExpiresAt),
        SecureStore.setItemAsync(REFRESH_EXPIRES_AT_KEY, session.refreshExpiresAt),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(session.user)),
    ]);
}

export async function clearMobileSession(): Promise<void> {
    await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(ACCESS_EXPIRES_AT_KEY),
        SecureStore.deleteItemAsync(REFRESH_EXPIRES_AT_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
    ]);
}

export async function getStoredMobileSession(): Promise<MobileSession | null> {
    const [accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, userRaw] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(ACCESS_EXPIRES_AT_KEY),
        SecureStore.getItemAsync(REFRESH_EXPIRES_AT_KEY),
        SecureStore.getItemAsync(USER_KEY),
    ]);

    if (!accessToken || !refreshToken || !accessExpiresAt || !refreshExpiresAt || !userRaw) {
        return null;
    }

    const user = JSON.parse(userRaw) as User;
    return { accessToken, refreshToken, accessExpiresAt, refreshExpiresAt, user };
}

function isExpired(isoDate: string, bufferSeconds = 0): boolean {
    const targetTime = new Date(isoDate).getTime();
    if (Number.isNaN(targetTime)) return true;
    return Date.now() + bufferSeconds * 1000 >= targetTime;
}

async function refreshSession(session: MobileSession): Promise<MobileSession> {
    ensureApiBaseUrl();

    const response = await fetch(`${API_BASE_URL}/api/mobile/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: session.refreshToken }),
    });

    const json = await response.json();
    if (!response.ok || !json?.data?.access_token) {
        throw new Error(json?.error ?? 'Sessão expirada. Faça login novamente.');
    }

    const nextSession: MobileSession = {
        ...session,
        accessToken: json.data.access_token,
        refreshToken: json.data.refresh_token,
        accessExpiresAt: json.data.access_expires_at,
        refreshExpiresAt: json.data.refresh_expires_at,
    };

    await saveSession(nextSession);
    return nextSession;
}

export async function loginMobile(email: string, password: string): Promise<MobileSession> {
    ensureApiBaseUrl();

    const response = await fetch(`${API_BASE_URL}/api/mobile/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    const json = await response.json();
    if (!response.ok || !json?.data?.access_token) {
        throw new Error(json?.error ?? 'Falha no login mobile');
    }

    const session: MobileSession = {
        accessToken: json.data.access_token,
        refreshToken: json.data.refresh_token,
        accessExpiresAt: json.data.access_expires_at,
        refreshExpiresAt: json.data.refresh_expires_at,
        user: json.data.user,
    };

    await saveSession(session);
    return session;
}

export async function getValidSession(): Promise<MobileSession | null> {
    const session = await getStoredMobileSession();
    if (!session) return null;

    if (isExpired(session.refreshExpiresAt, 0)) {
        await clearMobileSession();
        return null;
    }

    if (isExpired(session.accessExpiresAt, 30)) {
        try {
            return await refreshSession(session);
        } catch {
            await clearMobileSession();
            return null;
        }
    }

    return session;
}

async function requestWithAuth<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    ensureApiBaseUrl();

    const session = await getValidSession();
    if (!session) {
        throw new Error('Sessão inválida. Faça login novamente.');
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.accessToken}`,
            ...(init?.headers ?? {}),
        },
    });

    const json = await response.json();
    if (!response.ok) {
        throw new Error(json?.error ?? 'Falha na requisição mobile');
    }

    return json?.data as T;
}

export async function fetchAssignedSurveys(): Promise<Survey[]> {
    const data = await requestWithAuth<AssignedSurveysPayload>('/api/mobile/pesquisas', { method: 'GET' });
    return (data?.surveys ?? []) as Survey[];
}

export async function fetchSurveyBundle(surveyId: string): Promise<{
    survey: Survey;
    role: string;
    routes: unknown[];
    quotas: unknown[];
}> {
    return requestWithAuth<SurveyBundlePayload>(`/api/mobile/pesquisa/${surveyId}`, { method: 'GET' });
}
