// GET /api/support/tickets - Listar tickets do usuário logado
// POST /api/support/tickets - Criar novo ticket
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

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

export async function GET(request: NextRequest) {
    const supabase = createSupabase();

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const status = request.nextUrl.searchParams.get('status');

        let query = supabase
            .from('support_tickets')
            .select('id, title, status, priority, category, created_at, updated_at, response_count')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false });

        if (status && status !== 'all') query = query.eq('status', status);

        const { data: tickets, error } = await query;
        if (error) {
            return trackedApiError(request, 'Erro ao buscar tickets', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: user.id,
                metadata: { route: '/api/support/tickets', operation: 'GET' },
            });
        }

        return apiSuccess({ tickets: tickets ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/support/tickets', operation: 'GET' },
        });
    }
}

export async function POST(request: NextRequest) {
    const supabase = createSupabase();

    try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        if (!userData?.tenant_id) return apiError('Usuário sem tenant', 403);

        const body = await request.json();
        const { title, message, category = 'general', priority = 'medium' } = body;

        if (!title?.trim()) return apiError('Título é obrigatório', 400);
        if (!message?.trim()) return apiError('Mensagem é obrigatória', 400);

        const validPriorities = ['low', 'medium', 'high', 'urgent'];
        const validCategories = ['general', 'technical', 'billing', 'feature', 'bug'];
        if (!validPriorities.includes(priority)) return apiError('Prioridade inválida', 400);
        if (!validCategories.includes(category)) return apiError('Categoria inválida', 400);

        // Criar ticket
        const { data: ticket, error: ticketError } = await supabase
            .from('support_tickets')
            .insert({
                tenant_id: userData.tenant_id,
                user_id: user.id,
                title: title.trim(),
                category,
                priority,
                status: 'open',
            })
            .select()
            .single();

        if (ticketError || !ticket) {
            return trackedApiError(request, 'Erro ao criar ticket', 500, {
                errorCode: 'DB_WRITE_FAILED',
                userId: user.id,
                tenantId: userData.tenant_id,
                metadata: { route: '/api/support/tickets', operation: 'POST' },
            });
        }

        // Inserir primeira mensagem
        await supabase.from('support_messages').insert({
            ticket_id: ticket.id,
            sender_id: user.id,
            message: message.trim(),
            is_from_admin: false,
        });

        return apiSuccess({ ticket }, 201);
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/support/tickets', operation: 'POST' },
        });
    }
}
