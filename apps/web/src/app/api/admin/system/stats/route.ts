// GET /api/admin/system/stats - Estatísticas gerais do sistema
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        // Buscar estatísticas do sistema
        const { data: stats, error: statsError } = await auth.supabase
            .from('vw_system_stats')
            .select('*')
            .single();

        if (statsError) {
            return trackedApiError(request, 'Erro ao buscar estatísticas', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: auth.user.id,
                metadata: { route: '/api/admin/system/stats' },
            });
        }

        // Buscar últimos erros críticos
        const { data: recentErrors } = await auth.supabase
            .from('error_logs')
            .select('*')
            .eq('severity', 'critical')
            .order('created_at', { ascending: false })
            .limit(5);

        // Buscar tickets de suporte em aberto
        const { data: openTickets } = await auth.supabase
            .from('support_tickets')
            .select('id, title, tenant_id, priority, status')
            .in('status', ['open', 'in_progress'])
            .order('created_at', { ascending: false })
            .limit(5);

        // Buscar últimos dados de analytics
        const { data: analytics } = await auth.supabase
            .from('system_analytics')
            .select('*')
            .order('date_recorded', { ascending: false })
            .limit(7);

        return apiSuccess({
            stats,
            recentErrors,
            openTickets,
            analytics,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/system/stats' },
        });
    }
}
