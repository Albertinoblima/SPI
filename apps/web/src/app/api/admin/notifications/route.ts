// GET /api/admin/notifications - contar tickets abertos sem resposta (badge no header)
// POST /api/admin/notifications/broadcast - enviar notificação para empresas
import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);
    if (!auth.isAuthorized) return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);

    try {
        // Contar tickets abertos (não atribuídos ou aguardando admin)
        const { count: openCount } = await auth.supabase
            .from('support_tickets')
            .select('*', { count: 'exact', head: true })
            .in('status', ['open', 'in_progress']);

        return apiSuccess({ unread: openCount ?? 0 });
    } catch {
        return apiError('Erro ao buscar notificações', 500);
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
