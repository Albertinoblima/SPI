// GET /api/team - Lista membros da equipe do tenant
// POST /api/team - Cria novo membro da equipe
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (userError || !userData) return apiError('Usuário não encontrado', 404);

        const { data: members, error: membersError } = await supabase
            .from('users')
            .select('id, full_name, email, phone, role, is_active, last_login_at, created_at')
            .eq('tenant_id', userData.tenant_id)
            .order('full_name');

        if (membersError) {
            return trackedApiError(request, 'Erro ao buscar equipe', 500, {
                errorCode: 'DB_QUERY_FAILED',
                userId: user.id,
                tenantId: userData.tenant_id,
                metadata: { route: '/api/team', operation: 'GET' },
            });
        }

        return apiSuccess({ members });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/team', operation: 'GET' },
        });
    }
}

export async function POST(request: NextRequest) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (userError || !userData) return apiError('Usuário não encontrado', 404);
        if (!['admin', 'manager'].includes(userData.role)) {
            return apiError('Sem permissão para gerenciar equipe', 403);
        }

        const body = await request.json();
        const { full_name, email, phone, role, password } = body;

        if (!full_name?.trim() || !email?.trim() || !role || !password) {
            return apiError('Nome, e-mail, cargo e senha são obrigatórios', 400);
        }
        if (password.length < 8) {
            return apiError('A senha deve ter no mínimo 8 caracteres', 400);
        }

        const validRoles = [
            'admin',
            'manager',
            'coordinator_general',
            'coordinator_field',
            'supervisor_quality',
            'interviewer',
            'driver',
            'coordinator',
            'fiscal',
        ];
        if (!validRoles.includes(role)) {
            return apiError('Cargo inválido', 400);
        }

        const adminSupabase = createAdminClient();

        // Verificar limite de usuários do tenant
        const { data: tenant } = await adminSupabase
            .from('tenants')
            .select('max_users')
            .eq('id', userData.tenant_id)
            .single();

        const { count: currentCount } = await adminSupabase
            .from('users')
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', userData.tenant_id)
            .eq('is_active', true);

        if (tenant && currentCount !== null && currentCount >= tenant.max_users) {
            return apiError(`Limite de ${tenant.max_users} usuários atingido para este plano`, 403);
        }

        // Criar usuário no auth
        const { data: authData, error: createAuthError } = await adminSupabase.auth.admin.createUser({
            email: email.trim(),
            password,
            email_confirm: true,
            user_metadata: { full_name: full_name.trim() },
        });

        if (createAuthError || !authData?.user) {
            if (createAuthError?.message?.includes('already registered')) {
                return apiError('Este e-mail já está cadastrado no sistema', 409);
            }
            return trackedApiError(request, 'Erro ao criar usuário', 500, {
                errorCode: 'USER_SAVE_FAILED',
                userId: user.id,
                tenantId: userData.tenant_id,
                metadata: { route: '/api/team', operation: 'POST', stage: 'create_auth_user' },
            });
        }

        // Criar perfil
        const { data: newMember, error: profileError } = await adminSupabase
            .from('users')
            .insert({
                id: authData.user.id,
                tenant_id: userData.tenant_id,
                full_name: full_name.trim(),
                email: email.trim(),
                phone: phone?.trim() || null,
                role,
                is_active: true,
                is_system_admin: false,
            })
            .select('id, full_name, email, phone, role, is_active, created_at')
            .single();

        if (profileError) {
            await adminSupabase.auth.admin.deleteUser(authData.user.id);
            return trackedApiError(request, 'Erro ao criar perfil do membro', 500, {
                errorCode: 'USER_SAVE_FAILED',
                userId: user.id,
                tenantId: userData.tenant_id,
                metadata: { route: '/api/team', operation: 'POST', stage: 'create_profile' },
            });
        }

        return apiSuccess({ member: newMember, message: 'Membro criado com sucesso' }, 201);
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/team', operation: 'POST' },
        });
    }
}
