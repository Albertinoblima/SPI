// GET /api/admin/support/tickets - Listar tickets de suporte
import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    try {
        const searchParams = request.nextUrl.searchParams;
        const status = searchParams.get('status') || 'open';
        const priority = searchParams.get('priority');
        const page = parseInt(searchParams.get('page') || '1');
        const pageSize = 20;
        const offset = (page - 1) * pageSize;

        let query = auth.supabase
            .from('support_tickets')
            .select(
                `
                *,
                tenants:tenant_id (name, slug),
                messages:support_messages (count)
                `,
                { count: 'exact' }
            )
            .order('created_at', { ascending: false });

        if (status !== 'all') {
            query = query.eq('status', status);
        }

        if (priority) {
            query = query.eq('priority', priority);
        }

        const { data: tickets, count, error: fetchError } = await query
            .range(offset, offset + pageSize - 1);

        if (fetchError) {
            console.error('Fetch error:', fetchError);
            return apiError('Erro ao buscar tickets', 500);
        }

        // Enriquecer com dados de usuário da tabela public.users
        const enrichedTickets = await Promise.all(
            (tickets ?? []).map(async (ticket) => {
                const [{ data: user }, { data: assignedUser }] = await Promise.all([
                    auth.supabase
                        .from('users')
                        .select('full_name, email')
                        .eq('id', ticket.user_id)
                        .single(),
                    ticket.assigned_to
                        ? auth.supabase
                            .from('users')
                            .select('full_name, email')
                            .eq('id', ticket.assigned_to)
                            .single()
                        : Promise.resolve({ data: null }),
                ]);
                return {
                    ...ticket,
                    user,
                    assigned_user: assignedUser,
                };
            })
        );

        return apiSuccess({
            tickets: enrichedTickets,
            pagination: {
                page,
                pageSize,
                total: count,
                totalPages: Math.ceil((count || 0) / pageSize),
            },
        });
    } catch (error) {
        console.error('Erro ao buscar tickets:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
