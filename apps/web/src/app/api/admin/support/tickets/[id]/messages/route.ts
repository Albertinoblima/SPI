// POST /api/admin/support/tickets/[id]/messages - Admin envia resposta ao ticket
import { NextRequest } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const auth = await requireSystemAdmin(request);
    if (!auth.isAuthorized) return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);

    const body = await request.json();
    const { message, status } = body;

    if (!message?.trim()) return apiError('Mensagem é obrigatória', 400);

    const ticketId = params.id;

    // Verificar ticket
    const { data: ticket } = await auth.supabase
        .from('support_tickets')
        .select('id, status')
        .eq('id', ticketId)
        .single();

    if (!ticket) return apiError('Ticket não encontrado', 404);

    // Inserir mensagem do admin
    const { data: newMsg, error: insertError } = await auth.supabase
        .from('support_messages')
        .insert({
            ticket_id: ticketId,
            sender_id: auth.user.id,
            message: message.trim(),
            is_from_admin: true,
        })
        .select()
        .single();

    if (insertError) return apiError('Erro ao enviar mensagem', 500);

    // Atualizar status se informado, senão mudar para waiting_user
    const newStatus = status ?? 'waiting_user';
    const validStatuses = ['open', 'in_progress', 'waiting_user', 'resolved', 'closed'];
    if (!validStatuses.includes(newStatus)) return apiError('Status inválido', 400);

    const updatePayload: Record<string, unknown> = {
        status: newStatus,
        assigned_to: auth.user.id,
    };
    if (newStatus === 'resolved') updatePayload.resolved_at = new Date().toISOString();

    await auth.supabase
        .from('support_tickets')
        .update(updatePayload)
        .eq('id', ticketId);

    // Incrementar contador
    await auth.supabase.rpc('increment_ticket_response_count', { ticket_uuid: ticketId });

    return apiSuccess({ message: newMsg }, 201);
}
