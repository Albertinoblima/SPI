// GET /api/notifications - listar notificações não lidas do usuário logado
// POST /api/notifications/read - marcar como lidas
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
                get(name: string) { return cookieStore.get(name)?.value; },
                set(name: string, value: string, options: Record<string, unknown>) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: Record<string, unknown>) {
                    cookieStore.set({ name, value: '', ...options });
                },
            },
        }
    );
}

export async function GET(_request: NextRequest) {
    const supabase = createSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiError('Não autorizado', 401);

    try {
        // Buscar notificações destinadas ao usuário (pelo user_id, tenant ou all)
        const { data: userRow } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        // Notificações não lidas
        let query = supabase
            .from('notifications')
            .select('*, notification_reads!left(id)')
            .order('created_at', { ascending: false })
            .limit(20);

        // Aplicar filtro de alvo
        if (userRow?.tenant_id) {
            query = query.or(
                `target_type.eq.all,tenant_id.eq.${userRow.tenant_id},user_id.eq.${user.id}`
            );
        } else {
            query = query.or(`target_type.eq.all,user_id.eq.${user.id}`);
        }

        const { data: notifications, error } = await query;
        if (error) {
            console.error('Notifications fetch error:', error);
            return apiError('Erro ao buscar notificações', 500);
        }

        // Buscar IDs lidos separadamente para calcular não lidas
        const { data: reads } = await supabase
            .from('notification_reads')
            .select('notification_id')
            .eq('user_id', user.id);

        const readIds = new Set((reads ?? []).map((r) => r.notification_id));

        const enriched = (notifications ?? []).map((n) => ({
            ...n,
            is_read: readIds.has(n.id),
        }));

        const unreadCount = enriched.filter((n) => !n.is_read).length;

        return apiSuccess({ notifications: enriched, unread: unreadCount });
    } catch {
        return apiError('Erro interno', 500);
    }
}
