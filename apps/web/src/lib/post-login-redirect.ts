// Utilitária para determinar redirecionamento pós-login baseado no role do usuário
import { createClient as createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Determina para qual página redirecionar após o login
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
                    set(name: string, value: string, options: any) {
                        cookieStore.set(name, value, options);
                    },
                    remove(name: string, options: any) {
                        cookieStore.delete(name);
                    },
                },
            }
        );

        // Obter usuário autenticado
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return '/login'; // Se não há usuário, voltar ao login
        }

        // Buscar perfil do usuário para obter role e is_system_admin
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('role, is_system_admin')
            .eq('id', user.id)
            .single();

        if (error || !userProfile) {
            return '/login'; // Erro ao buscar perfil
        }

        // Lógica de redirecionamento baseada no role
        if (userProfile.is_system_admin) {
            return '/admin'; // System admin vai para painel administrativo
        }

        switch (userProfile.role) {
            case 'admin':
            case 'manager':
                return '/dashboard'; // Admin/manager vai para dashboard da empresa
            case 'interviewer':
                return '/dashboard/surveys'; // Entrevistador vai direto para pesquisas
            default:
                return '/dashboard'; // Default para dashboard
        }
    } catch (error) {
        console.error('Erro ao determinar redirecionamento pós-login:', error);
        return '/dashboard'; // Fallback para dashboard em caso de erro
    }
}

/**
 * Versão para client-side (sem acesso ao cookies do server)
 * Busca os dados do usuário e retorna o redirecionamento
 */
export async function getPostLoginRedirectUrlClient(supabase: any): Promise<string> {
    try {
        // Obter usuário autenticado
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return '/login';
        }

        // Buscar perfil do usuário
        const { data: userProfile, error } = await supabase
            .from('users')
            .select('role, is_system_admin')
            .eq('id', user.id)
            .single();

        if (error || !userProfile) {
            return '/login';
        }

        // Lógica de redirecionamento
        if (userProfile.is_system_admin) {
            return '/admin';
        }

        switch (userProfile.role) {
            case 'admin':
            case 'manager':
                return '/dashboard';
            case 'interviewer':
                return '/dashboard/surveys';
            default:
                return '/dashboard';
        }
    } catch (error) {
        console.error('Erro ao determinar redirecionamento pós-login:', error);
        return '/dashboard';
    }
}
