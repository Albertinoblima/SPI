// GET /api/admin/support/tickets/[id] - Detalhes de um ticket
// PUT /api/admin/support/tickets/[id] - Atualizar ticket (status, atribuição)
// POST /api/admin/support/tickets/[id]/messages - Adicionar mensagem de resposta
import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin, requireTenantAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    // Pode ser system_admin ou tenant_admin
    const auth = await requireTenantAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const ticketId = params.id;

        // Buscar ticket
        const { data: ticket, error: ticketError } = await auth.supabase
            .from('support_tickets')
            .select(
                `
                *,
                users:user_id (full_name, email),
                tenants:tenant_id (name, slug),
                assigned_user:assigned_to (full_name, email)
                `
            )
            .eq('id', ticketId)
            .single();

        if (ticketError || !ticket) {
            return apiError('Ticket não encontrado', 404);
        }

        // Verificar acesso (system_admin vê tudo, tenant_admin vê do seu tenant)
        if (!auth.userData.is_system_admin && ticket.tenant_id !== auth.userData.tenant_id) {
            return apiError('Acesso negado', 403);
        }

        // Buscar mensagens
        const { data: messages } = await auth.supabase
            .from('support_messages')
            .select(
                `
                *,
                users:sender_id (full_name, email, avatar_url)
                `
            )
            .eq('ticket_id', ticketId)
            .order('created_at', { ascending: true });

        return apiSuccess({
            ticket,
            messages,
        });
    } catch (error) {
        console.error('Erro ao buscar ticket:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const ticketId = params.id;
        const body = await request.json();
        const { status, priority, assigned_to } = body;

        // Validar valores
        const validStatuses = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
        const validPriorities = ['low', 'medium', 'high', 'urgent'];

        if (status && !validStatuses.includes(status)) {
            return apiError('Status inválido', 400);
        }

        if (priority && !validPriorities.includes(priority)) {
            return apiError('Prioridade inválida', 400);
        }

        const updatePayload: any = {};
        if (status) updatePayload.status = status;
        if (priority) updatePayload.priority = priority;
        if (assigned_to !== undefined) updatePayload.assigned_to = assigned_to;

        if (status === 'resolved') {
            updatePayload.resolved_at = new Date().toISOString();
        }

        // Atualizar ticket
        const { data: updated, error: updateError } = await auth.supabase
            .from('support_tickets')
            .update(updatePayload)
            .eq('id', ticketId)
            .select();

        if (updateError) {
            return apiError('Erro ao atualizar ticket', 500);
        }

        return apiSuccess({ ticket: updated[0] });
    } catch (error) {
        console.error('Erro ao atualizar ticket:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

// POST /api/admin/support/tickets/[id]/messages - Adicionar mensagem
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireTenantAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const ticketId = params.id;
        const body = await request.json();
        const { message } = body;

        if (!message || message.trim().length === 0) {
            return apiError('Mensagem é obrigatória', 400);
        }

        // Verificar acesso ao ticket
        const { data: ticket } = await auth.supabase
            .from('support_tickets')
            .select('tenant_id, response_count')
            .eq('id', ticketId)
            .single();

        if (!ticket) {
            return apiError('Ticket não encontrado', 404);
        }

        if (!auth.userData.is_system_admin && ticket.tenant_id !== auth.userData.tenant_id) {
            return apiError('Acesso negado', 403);
        }

        // Inserir mensagem
        const { data: newMessage, error: insertError } = await auth.supabase
            .from('support_messages')
            .insert({
                ticket_id: ticketId,
                sender_id: auth.user.id,
                message: message.trim(),
                is_admin_response: auth.userData.is_system_admin || auth.userData.role === 'admin',
            })
            .select();

        if (insertError) {
            return apiError('Erro ao adicionar mensagem', 500);
        }

        // Atualizar contador e last_response_at do ticket
        await auth.supabase
            .from('support_tickets')
            .update({
                response_count: ticket.response_count + 1,
                last_response_at: new Date().toISOString(),
                status: 'in_progress', // Mudar para in_progress ao responder
            })
            .eq('id', ticketId);

        return apiSuccess({ message: newMessage[0] }, 201);
    } catch (error) {
        console.error('Erro ao adicionar mensagem:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
