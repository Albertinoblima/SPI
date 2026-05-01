// POST /api/settings/logo - Upload da logomarca da empresa
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/lib/api-middleware';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

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
            return apiError('Sem permissão para alterar logomarca', 403);
        }

        const formData = await request.formData();
        const file = formData.get('logo') as File | null;

        if (!file) return apiError('Nenhum arquivo enviado', 400);
        if (!ALLOWED_TYPES.includes(file.type)) {
            return apiError('Formato inválido. Use JPEG, PNG, WebP ou SVG.', 400);
        }
        if (file.size > MAX_SIZE_BYTES) {
            return apiError('Arquivo muito grande. Máximo 2MB.', 400);
        }

        const adminSupabase = createAdminClient();
        const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png';
        const filePath = `logos/${userData.tenant_id}/logo.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await adminSupabase.storage
            .from('company-assets')
            .upload(filePath, buffer, {
                contentType: file.type,
                upsert: true,
            });

        if (uploadError) {
            console.error('Logo upload error:', uploadError);
            return apiError('Erro ao fazer upload da logomarca', 500);
        }

        const { data: publicUrlData } = adminSupabase.storage
            .from('company-assets')
            .getPublicUrl(filePath);

        const logoUrl = publicUrlData.publicUrl;

        // Atualizar logo_url no tenant
        const { error: updateError } = await adminSupabase
            .from('tenants')
            .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
            .eq('id', userData.tenant_id);

        if (updateError) {
            console.error('Tenant logo update error:', updateError);
            return apiError('Erro ao salvar URL da logomarca', 500);
        }

        return apiSuccess({ logo_url: logoUrl, message: 'Logomarca atualizada com sucesso' });
    } catch (error) {
        console.error('POST /api/settings/logo error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
