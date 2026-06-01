// GET/POST /api/admin/system/admins
// Gestão de System Admins (Fase 0 - Segurança do Painel Administrativo)

import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

// Lista todos os system_admins
export async function GET(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401, correlationId);
    }

    try {
        const { data: admins, error } = await auth.supabase
            .from('users')
            .select('id, full_name, email, created_at, last_sign_in_at')
            .eq('is_system_admin', true)
            .order('created_at', { ascending: false });

        if (error) {
            return trackedApiError(request, 'Erro ao buscar system admins', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/system/admins' },
            });
        }

        return apiSuccess({ admins: admins ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/system/admins' },
        });
    }
}

// Promove ou rebaixa um usuário como system_admin
export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401, correlationId);
    }

    try {
        const body = await request.json();
        const { userId, isSystemAdmin } = body;

        if (!userId || typeof isSystemAdmin !== 'boolean') {
            return apiError('Parâmetros inválidos (userId e isSystemAdmin são obrigatórios)', 400, correlationId);
        }

        // Impede que o próprio usuário se rebaixe (proteção básica)
        if (userId === auth.user.id && isSystemAdmin === false) {
            return apiError('Você não pode remover seus próprios privilégios de system_admin', 400, correlationId);
        }

        const { error } = await auth.supabase
            .from('users')
            .update({ is_system_admin: isSystemAdmin })
            .eq('id', userId);

        if (error) {
            return trackedApiError(request, 'Erro ao atualizar status de system_admin', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/system/admins', targetUser: userId },
            });
        }

        // Registra a ação no audit_log (boa prática de Fase 0)
        await auth.supabase.from('audit_log').insert({
            user_id: auth.user.id,
            action: isSystemAdmin ? 'promote_system_admin' : 'demote_system_admin',
            entity_type: 'user',
            entity_id: userId,
            changes_description: `System admin privileges ${isSystemAdmin ? 'granted' : 'revoked'}`,
            is_critical: true,
        });

        return apiSuccess({
            success: true,
            message: `Usuário ${isSystemAdmin ? 'promovido a' : 'rebaixado de'} system_admin com sucesso`,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/system/admins' },
        });
    }
}
