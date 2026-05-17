// Middleware para verificar se usuário é system_admin
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { captureSystemError } from '@/lib/monitoring/error-monitor';

export async function requireSystemAdmin(request: NextRequest) {
    const cookieStore = cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    cookieStore.set(name, value, options);
                },
                remove(name: string, options: any) {
                    cookieStore.delete(name);
                },
            },
        }
    );

    // Verificar autenticação
    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        return {
            isAuthorized: false as const,
            error: 'Não autenticado',
            status: 401,
        };
    }

    // Verificar se é system_admin
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('is_system_admin')
        .eq('id', user.id)
        .single();

    if (userError || !userData?.is_system_admin) {
        return {
            isAuthorized: false as const,
            error: 'Acesso negado. Requer privilégios de administrador do sistema.',
            status: 403,
        };
    }

    return {
        isAuthorized: true as const,
        user,
        supabase,
    };
}

export async function requireTenantAdmin(request: NextRequest) {
    const cookieStore = cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: any) {
                    cookieStore.set(name, value, options);
                },
                remove(name: string, options: any) {
                    cookieStore.delete(name);
                },
            },
        }
    );

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        return {
            isAuthorized: false as const,
            error: 'Não autenticado',
            status: 401,
        };
    }

    // Verificar se é admin ou manager do tenant
    const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role, tenant_id, is_system_admin')
        .eq('id', user.id)
        .single();

    if (userError || !userData) {
        return {
            isAuthorized: false as const,
            error: 'Erro ao verificar permissões',
            status: 403,
        };
    }

    if (!['admin', 'manager', 'system_admin'].includes(userData.role) && !userData.is_system_admin) {
        return {
            isAuthorized: false as const,
            error: 'Acesso negado. Requer privilégios de administrador.',
            status: 403,
        };
    }

    return {
        isAuthorized: true as const,
        user,
        userData,
        supabase,
    };
}

/**
 * Utilitário para retornar erro com formato consistente
 */
export function apiError(message: string, status: number = 400) {
    return NextResponse.json({ error: message }, { status });
}

export async function trackedApiError(
    request: NextRequest,
    message: string,
    status: number,
    options?: {
        errorCode?: string;
        tenantId?: string | null;
        userId?: string | null;
        metadata?: Record<string, unknown>;
    }
) {
    if (status >= 500 || options?.errorCode) {
        await captureSystemError({
            request,
            errorCode: options?.errorCode ?? 'API_HTTP_5XX',
            errorMessage: message,
            tenantId: options?.tenantId,
            userId: options?.userId,
            httpStatusCode: status,
            metadata: options?.metadata,
        });
    }

    return apiError(message, status);
}

export async function handleApiUnhandledError(
    request: NextRequest,
    error: unknown,
    options?: {
        errorCode?: string;
        tenantId?: string | null;
        userId?: string | null;
        metadata?: Record<string, unknown>;
    }
) {
    const result = await captureSystemError({
        request,
        errorCode: options?.errorCode ?? 'API_UNHANDLED_EXCEPTION',
        error,
        tenantId: options?.tenantId,
        userId: options?.userId,
        httpStatusCode: 500,
        metadata: options?.metadata,
    });

    return NextResponse.json(
        {
            error: 'Erro interno do servidor',
            correlationId: result.correlationId,
        },
        { status: 500 }
    );
}

/**
 * Utilitário para retornar sucesso com formato consistente
 */
export function apiSuccess(data: any, status: number = 200) {
    return NextResponse.json({ success: true, data }, { status });
}
