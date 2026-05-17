// POST /api/auth/register - Registro completo de empresa + admin
import { NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

function slugify(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { companyName, fullName, email, password } = body;

        if (!companyName || !fullName || !email || !password) {
            return apiError('Todos os campos são obrigatórios', 400);
        }

        if (password.length < 8) {
            return apiError('A senha deve ter no mínimo 8 caracteres', 400);
        }

        const adminSupabase = createAdminClient();

        // 1. Verificar se email já existe
        const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
        const emailExists = existingUsers?.users?.some(u => u.email === email);
        if (emailExists) {
            return apiError('Este e-mail já está cadastrado', 409);
        }

        // 2. Gerar slug único para o tenant
        let slug = slugify(companyName);
        const { data: existingTenant } = await adminSupabase
            .from('tenants')
            .select('slug')
            .eq('slug', slug)
            .maybeSingle();

        if (existingTenant) {
            slug = `${slug}-${Date.now()}`;
        }

        // 3. Criar tenant
        const { data: tenant, error: tenantError } = await adminSupabase
            .from('tenants')
            .insert({
                name: companyName,
                slug,
                status: 'active',
                max_users: 10,
                max_surveys: 50,
                storage_limit_mb: 1024,
            })
            .select('id')
            .single();

        if (tenantError || !tenant) {
            return trackedApiError(request, 'Erro ao criar empresa', 500, {
                errorCode: 'DB_WRITE_FAILED',
                metadata: { route: '/api/auth/register', stage: 'create_tenant' },
            });
        }

        // 4. Criar usuário auth (confirmado, sem email de verificação)
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName },
        });

        if (authError || !authData?.user) {
            // Rollback: remover tenant criado
            await adminSupabase.from('tenants').delete().eq('id', tenant.id);
            return trackedApiError(request, 'Erro ao criar usuário', 500, {
                errorCode: 'USER_SAVE_FAILED',
                metadata: { route: '/api/auth/register', stage: 'create_auth_user' },
            });
        }

        // 5. Criar perfil em public.users
        const { error: profileError } = await adminSupabase
            .from('users')
            .insert({
                id: authData.user.id,
                tenant_id: tenant.id,
                full_name: fullName,
                email,
                role: 'admin',
                is_active: true,
                is_system_admin: false,
            });

        if (profileError) {
            // Rollback: remover usuário auth e tenant
            await adminSupabase.auth.admin.deleteUser(authData.user.id);
            await adminSupabase.from('tenants').delete().eq('id', tenant.id);
            return trackedApiError(request, 'Erro ao criar perfil de usuário', 500, {
                errorCode: 'USER_SAVE_FAILED',
                metadata: { route: '/api/auth/register', stage: 'create_profile' },
            });
        }

        return apiSuccess({
            message: 'Empresa e conta criadas com sucesso',
            tenantSlug: slug,
        }, 201);

    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/auth/register' },
        });
    }
}
