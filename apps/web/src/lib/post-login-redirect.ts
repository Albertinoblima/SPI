// Utilitária client-side para determinar redirecionamento pós-login
// Versão server-side disponível em post-login-redirect.server.ts

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
