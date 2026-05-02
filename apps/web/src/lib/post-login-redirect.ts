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

        // Verificar se o onboarding da empresa foi concluído (apenas para admin/manager)
        if (userProfile.role === 'admin' || userProfile.role === 'manager') {
            try {
                const { data: tenantData } = await supabase
                    .from('users')
                    .select('tenant_id')
                    .eq('id', user.id)
                    .single();

                if (tenantData?.tenant_id) {
                    const { data: tenant } = await supabase
                        .from('tenants')
                        .select('cnpj, city')
                        .eq('id', tenantData.tenant_id)
                        .single();

                    // Se dados mínimos ausentes, redirecionar para onboarding
                    if (!tenant?.cnpj || !tenant?.city) {
                        return '/settings?onboarding=1';
                    }
                }
            } catch {
                // Em caso de erro, seguir para dashboard normalmente
            }
            return '/dashboard';
        }

        switch (userProfile.role) {
            case 'interviewer':
                return '/dashboard';
            default:
                return '/dashboard';
        }
    } catch (error) {
        console.error('Erro ao determinar redirecionamento pós-login:', error);
        return '/dashboard';
    }
}
