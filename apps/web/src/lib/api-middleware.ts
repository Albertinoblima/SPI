// Middleware para verificar se usuário é system_admin
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { captureSystemError } from '@/lib/monitoring/error-monitor';

export async function requireSystemAdmin(request: NextRequest) {
    const { supabase, applyCookies } = await createClient();

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
            applyCookies,
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
            applyCookies,
        };
    }

    return {
        isAuthorized: true as const,
        user,
        supabase,
        applyCookies,
    };
}

export async function requireTenantAdmin(request: NextRequest) {
    const { supabase, applyCookies } = await createClient();

    const {
        data: { user },
        error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
        return {
            isAuthorized: false as const,
            error: 'Não autenticado',
            status: 401,
            applyCookies,
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
            applyCookies,
        };
    }

    if (!['admin', 'manager', 'system_admin'].includes(userData.role) && !userData.is_system_admin) {
        return {
            isAuthorized: false as const,
            error: 'Acesso negado. Requer privilégios de administrador.',
            status: 403,
            applyCookies,
        };
    }

    // === Suporte a Impersonation (Fase 2 hardened) ===
    // Todas as operações de impersonation devem usar createAuditedSupabaseAdminClient
    // e rate limiting. RLS policies on admin_impersonation_sessions devem restringir a system_admins.
    let effectiveTenantId = userData.tenant_id;

    if (userData.is_system_admin) {
        // Verifica se existe uma sessão ativa de impersonation
        const { data: impersonation } = await supabase
            .from('admin_impersonation_sessions')
            .select('target_tenant_id')
            .eq('admin_user_id', user.id)
            .eq('is_active', true)
            .order('started_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (impersonation?.target_tenant_id) {
            effectiveTenantId = impersonation.target_tenant_id;
        }
    }

    return {
        isAuthorized: true as const,
        user,
        userData: {
            ...userData,
            tenant_id: effectiveTenantId, // Tenant efetivo (pode ser o impersonated)
        },
        supabase,
        applyCookies,
        isImpersonating: effectiveTenantId !== userData.tenant_id,
    };
}

/**
 * Utilitário para retornar erro com formato consistente + suporte a correlationId (Fase 5 Observability)
 */
export function apiError(message: string, status: number = 400, correlationId?: string) {
    const body: Record<string, unknown> = { error: message };
    if (correlationId) body['correlationId'] = correlationId;
    return NextResponse.json(body, { status });
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
        correlationId?: string;
    }
) {
    if (status >= 500 || options?.errorCode) {
        await captureSystemError({
            request,
            errorCode: options?.errorCode ?? 'API_HTTP_5XX',
            errorMessage: message,
            ...(options?.tenantId !== undefined ? { tenantId: options.tenantId } : {}),
            ...(options?.userId !== undefined ? { userId: options.userId } : {}),
            httpStatusCode: status,
            ...(options?.metadata ? { metadata: options.metadata } : {}),
            ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
        });
    }

    return apiError(message, status, options?.correlationId);
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
        ...(options?.tenantId !== undefined ? { tenantId: options.tenantId } : {}),
        ...(options?.userId !== undefined ? { userId: options.userId } : {}),
        httpStatusCode: 500,
        ...(options?.metadata ? { metadata: options.metadata } : {}),
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
 * Utilitário para retornar sucesso com formato consistente + suporte a correlationId (Fase 5 Observability)
 */
export function apiSuccess<T = unknown>(data: T, status: number = 200, correlationId?: string) {
    const body: Record<string, unknown> = { success: true, data };
    if (correlationId) body['correlationId'] = correlationId;
    return NextResponse.json(body, { status });
}
