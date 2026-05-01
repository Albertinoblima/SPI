// GET /api/team/[id] - Busca membro
// PUT /api/team/[id] - Atualiza membro
// DELETE /api/team/[id] - Desativa membro (soft delete)
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/lib/api-middleware';

interface RouteParams {
    params: { id: string };
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

        if (!userData) return apiError('Usuário não encontrado', 404);

        const { data: member, error } = await supabase
            .from('users')
            .select('id, full_name, email, phone, role, is_active, last_login_at, created_at')
            .eq('id', params.id)
            .eq('tenant_id', userData.tenant_id)
            .single();

        if (error || !member) return apiError('Membro não encontrado', 404);

        return apiSuccess({ member });
    } catch (error) {
        console.error('GET /api/team/[id] error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        const { data: userData } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (!userData) return apiError('Usuário não encontrado', 404);
        if (!['admin', 'manager'].includes(userData.role)) {
            return apiError('Sem permissão para editar membros', 403);
        }

        // Não permitir editar a si mesmo por aqui
        if (params.id === user.id) {
            return apiError('Use as configurações de perfil para editar seus próprios dados', 400);
        }

        const body = await request.json();
        const { full_name, phone, role, is_active, password } = body;

        const validRoles = ['admin', 'manager', 'coordinator', 'interviewer', 'fiscal', 'driver'];
        if (role && !validRoles.includes(role)) {
            return apiError('Cargo inválido', 400);
        }

        const adminSupabase = createAdminClient();

        // Verificar se o membro pertence ao mesmo tenant
        const { data: targetMember } = await adminSupabase
            .from('users')
            .select('id, tenant_id')
            .eq('id', params.id)
            .eq('tenant_id', userData.tenant_id)
            .single();

        if (!targetMember) return apiError('Membro não encontrado', 404);

        // Atualizar perfil
        const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (full_name?.trim()) updateData.full_name = full_name.trim();
        if (phone !== undefined) updateData.phone = phone?.trim() || null;
        if (role) updateData.role = role;
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data: updated, error: updateError } = await adminSupabase
            .from('users')
            .update(updateData)
            .eq('id', params.id)
            .select('id, full_name, email, phone, role, is_active')
            .single();

        if (updateError) {
            console.error('Member update error:', updateError);
            return apiError('Erro ao atualizar membro', 500);
        }

        // Se nova senha for fornecida, atualizar no auth
        if (password) {
            if (password.length < 8) return apiError('A senha deve ter no mínimo 8 caracteres', 400);
            const { error: pwError } = await adminSupabase.auth.admin.updateUserById(params.id, { password });
            if (pwError) {
                console.error('Password update error:', pwError);
                return apiError('Dados atualizados, mas houve erro ao atualizar senha', 207);
            }
        }

        return apiSuccess({ member: updated, message: 'Membro atualizado com sucesso' });
    } catch (error) {
        console.error('PUT /api/team/[id] error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
    try {
        const supabase = createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (!user || authError) return apiError('Não autenticado', 401);

        if (params.id === user.id) {
            return apiError('Não é possível desativar sua própria conta', 400);
        }

        const { data: userData } = await supabase
            .from('users')
            .select('tenant_id, role')
            .eq('id', user.id)
            .single();

        if (!userData) return apiError('Usuário não encontrado', 404);
        if (userData.role !== 'admin') return apiError('Apenas administradores podem desativar membros', 403);

        const adminSupabase = createAdminClient();

        const { data: targetMember } = await adminSupabase
            .from('users')
            .select('id')
            .eq('id', params.id)
            .eq('tenant_id', userData.tenant_id)
            .single();

        if (!targetMember) return apiError('Membro não encontrado', 404);

        const { error: deactivateError } = await adminSupabase
            .from('users')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', params.id);

        if (deactivateError) {
            console.error('Member deactivate error:', deactivateError);
            return apiError('Erro ao desativar membro', 500);
        }

        return apiSuccess({ message: 'Membro desativado com sucesso' });
    } catch (error) {
        console.error('DELETE /api/team/[id] error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
