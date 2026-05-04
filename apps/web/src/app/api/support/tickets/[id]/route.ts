// GET /api/support/tickets/[id] - Detalhes + mensagens
// POST /api/support/tickets/[id] - Enviar mensagem (usuário)
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { apiError, apiSuccess } from '@/lib/api-middleware';

function createSupabase() {
    const cookieStore = cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get: (name: string) => cookieStore.get(name)?.value,
                set: (name: string, value: string, options: any) => cookieStore.set(name, value, options),
                remove: (name: string) => cookieStore.delete(name),
            },
        }
    );
}

export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return apiError('Não autenticado', 401);

    const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

    if (ticketError || !ticket) return apiError('Ticket não encontrado', 404);

    const { data: messages } = await supabase
        .from('support_messages')
        .select('id, message, is_from_admin, created_at, sender_id')
        .eq('ticket_id', params.id)
        .order('created_at', { ascending: true });

    return apiSuccess({ ticket, messages: messages ?? [] });
}

export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const supabase = createSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return apiError('Não autenticado', 401);

    const body = await request.json();
    const { message } = body;
    if (!message?.trim()) return apiError('Mensagem é obrigatória', 400);

    // Verificar posse do ticket
    const { data: ticket } = await supabase
        .from('support_tickets')
        .select('id, status')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single();

    if (!ticket) return apiError('Ticket não encontrado', 404);
    if (ticket.status === 'closed') return apiError('Ticket está fechado', 400);

    const { data: newMsg, error: insertError } = await supabase
        .from('support_messages')
        .insert({
            ticket_id: params.id,
            sender_id: user.id,
            message: message.trim(),
            is_from_admin: false,
        })
        .select()
        .single();

    if (insertError) return apiError('Erro ao enviar mensagem', 500);

    // Reabrir ticket se estava aguardando usuário
    if (ticket.status === 'waiting_user') {
        await supabase
            .from('support_tickets')
            .update({ status: 'in_progress' })
            .eq('id', params.id);
    }

    // Incrementar response_count
    await supabase.rpc('increment_ticket_response_count', { ticket_uuid: params.id });

    return apiSuccess({ message: newMsg }, 201);
}
