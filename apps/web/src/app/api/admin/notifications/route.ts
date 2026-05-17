// GET /api/admin/notifications - contar tickets abertos sem resposta (badge no header)
// POST /api/admin/notifications/broadcast - enviar notificação para empresas
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);
    if (!auth.isAuthorized) return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);

    try {
        const incidentThreshold = new Date(Date.now() - 5 * 60 * 1000).toISOString();

        const [
            { count: openTicketsCount },
            { data: openTickets },
            { count: criticalIncidentsCount },
            { data: criticalIncidents },
        ] = await Promise.all([
            auth.supabase
                .from('support_tickets')
                .select('*', { count: 'exact', head: true })
                .in('status', ['open', 'in_progress']),
            auth.supabase
                .from('support_tickets')
                .select('id, title, status, priority, updated_at, tenants(name), user:users(full_name, email)')
                .in('status', ['open', 'in_progress'])
                .order('updated_at', { ascending: false })
                .limit(6),
            auth.supabase
                .from('error_logs')
                .select('*', { count: 'exact', head: true })
                .eq('resolved', false)
                .in('severity', ['critical', 'high'])
                .gte('created_at', incidentThreshold),
            auth.supabase
                .from('error_logs')
                .select('id, error_code, error_message, severity, http_path, created_at, correlation_id')
                .eq('resolved', false)
                .in('severity', ['critical', 'high'])
                .order('created_at', { ascending: false })
                .limit(6),
        ]);

        return apiSuccess({
            unread: (openTicketsCount ?? 0) + (criticalIncidentsCount ?? 0),
            support: {
                openCount: openTicketsCount ?? 0,
                tickets: openTickets ?? [],
            },
            incidents: {
                criticalWindowMinutes: 5,
                openCount: criticalIncidentsCount ?? 0,
                items: criticalIncidents ?? [],
            },
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/notifications' },
        });
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireSystemAdmin(request);
    if (!auth.isAuthorized) return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);

    try {
        const body = await request.json();
        const { title, message, target_type, tenant_id } = body;

        if (!title?.trim() || !message?.trim()) {
            return apiError('Título e mensagem são obrigatórios', 400);
        }
        if (!['all', 'tenant'].includes(target_type)) {
            return apiError('target_type inválido', 400);
        }
        if (target_type === 'tenant' && !tenant_id) {
            return apiError('tenant_id obrigatório para target_type=tenant', 400);
        }

        const { data: adminUser } = await auth.supabase.auth.getUser();

        const { data, error } = await auth.supabase
            .from('notifications')
            .insert({
                type: 'broadcast',
                title: title.trim(),
                message: message.trim(),
                target_type,
                tenant_id: target_type === 'tenant' ? tenant_id : null,
                created_by: adminUser.user?.id,
            })
            .select()
            .single();

        if (error) {
            console.error('Broadcast error:', error);
            return apiError('Erro ao enviar notificação', 500);
        }

        return apiSuccess({ notification: data }, 201);
    } catch {
        return apiError('Erro interno', 500);
    }
}
