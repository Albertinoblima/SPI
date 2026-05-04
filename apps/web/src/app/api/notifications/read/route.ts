// POST /api/notifications/read - marcar notificações como lidas
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

export async function POST(request: NextRequest) {
    const supabase = createSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiError('Não autorizado', 401);

    try {
        const body = await request.json();
        const { ids } = body; // array de UUIDs ou null (marca todos)

        if (ids && !Array.isArray(ids)) {
            return apiError('ids deve ser um array', 400);
        }

        if (ids && ids.length > 0) {
            // Marcar específicos como lidos (upsert ignora duplicatas)
            await supabase.from('notification_reads').upsert(
                ids.map((id: string) => ({ notification_id: id, user_id: user.id })),
                { onConflict: 'notification_id,user_id', ignoreDuplicates: true }
            );
        }

        return apiSuccess({ ok: true });
    } catch {
        return apiError('Erro interno', 500);
    }
}
