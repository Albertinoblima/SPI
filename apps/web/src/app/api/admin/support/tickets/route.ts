// GET /api/admin/support/tickets - Listar tickets de suporte
import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error, auth.status);
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
                users:user_id (full_name, email),
                tenants:tenant_id (name, slug),
                assigned_user:assigned_to (full_name, email),
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

        return apiSuccess({
            tickets,
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
