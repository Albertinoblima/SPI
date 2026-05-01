// Utilitária server-side para determinar redirecionamento pós-login
// ATENÇÃO: Só pode ser importada em Server Components ou Route Handlers
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Determina para qual página redirecionar após o login (Server Component)
 * baseado no role e is_system_admin do usuário
 */
export async function getPostLoginRedirectUrl(): Promise<string> {
    try {
        const cookieStore = cookies();

        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        return cookieStore.get(name)?.value;
                    },
                    set(name: string, value: string, options: Record<string, unknown>) {
                        cookieStore.set(name, value, options);
                    },
                    remove(name: string, options: Record<string, unknown>) {
                        cookieStore.delete({ name, ...options });
                    },
                },
            }
        );

        const { data: { user } } = await supabase.auth.getUser();

        if (!user) return '/login';

        const { data: userProfile, error } = await supabase
            .from('users')
            .select('role, is_system_admin')
            .eq('id', user.id)
            .single();

        if (error || !userProfile) return '/login';

        if (userProfile.is_system_admin) return '/admin';

        switch (userProfile.role) {
            case 'admin':
            case 'manager':
                return '/dashboard';
            case 'interviewer':
                return '/dashboard/surveys';
            default:
                return '/dashboard';
        }
    } catch {
        return '/dashboard';
    }
}
