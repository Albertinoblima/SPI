// POST /api/settings/logo - Upload da logomarca da empresa
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess } from '@/lib/api-middleware';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // aceita até 10MB para redimensionar
const MAX_DIMENSION = 512; // px — redimensiona para caber em 512×512

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
            return apiError('Arquivo muito grande. Máximo 10MB.', 400);
        }

        const arrayBuffer = await file.arrayBuffer();
        const inputBuffer = Buffer.from(arrayBuffer);

        // SVGs não passam por redimensionamento
        let finalBuffer: Buffer;
        let finalContentType: string;
        let finalExt: string;

        if (file.type === 'image/svg+xml') {
            finalBuffer = inputBuffer;
            finalContentType = 'image/svg+xml';
            finalExt = 'svg';
        } else {
            // Redimensiona automaticamente para máx MAX_DIMENSION×MAX_DIMENSION
            // e converte para WebP para melhor compressão
            finalBuffer = await sharp(inputBuffer)
                .resize(MAX_DIMENSION, MAX_DIMENSION, {
                    fit: 'inside',        // mantém proporção sem cortar
                    withoutEnlargement: true, // não amplia imagens pequenas
                })
                .webp({ quality: 85 })
                .toBuffer();
            finalContentType = 'image/webp';
            finalExt = 'webp';
        }

        const adminSupabase = createAdminClient();
        const filePath = `logos/${userData.tenant_id}/logo.${finalExt}`;

        const { error: uploadError } = await adminSupabase.storage
            .from('company-assets')
            .upload(filePath, finalBuffer, {
                contentType: finalContentType,
                upsert: true,
            });

        if (uploadError) {
            console.error('Logo upload error:', uploadError);
            // Tenta criar o bucket se não existir
            if (uploadError.message?.includes('Bucket not found') || uploadError.message?.includes('bucket')) {
                const { error: bucketError } = await adminSupabase.storage
                    .createBucket('company-assets', { public: true });
                if (bucketError && !bucketError.message?.includes('already exists')) {
                    console.error('Bucket creation error:', bucketError);
                    return apiError('Erro ao criar bucket de armazenamento', 500);
                }
                // Tenta o upload novamente
                const { error: retryError } = await adminSupabase.storage
                    .from('company-assets')
                    .upload(filePath, finalBuffer, { contentType: finalContentType, upsert: true });
                if (retryError) {
                    console.error('Logo upload retry error:', retryError);
                    return apiError('Erro ao fazer upload da logomarca', 500);
                }
            } else {
                return apiError('Erro ao fazer upload da logomarca', 500);
            }
        }

        const { data: publicUrlData } = adminSupabase.storage
            .from('company-assets')
            .getPublicUrl(filePath);

        const logoUrl = publicUrlData.publicUrl;

        // Atualizar logo_url no tenant — com fallback se coluna ainda não existir
        const { error: updateError } = await adminSupabase
            .from('tenants')
            .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
            .eq('id', userData.tenant_id);

        if (updateError) {
            // PGRST204 = coluna não existe (migration pendente). O upload foi feito com sucesso.
            if (updateError.code === 'PGRST204') {
                console.warn('logo_url column not found — migration pending. Upload succeeded.');
                return apiSuccess({
                    logo_url: logoUrl,
                    message: 'Logomarca enviada com sucesso (execute a migration para persistir a URL)',
                });
            }
            console.error('Tenant logo update error:', updateError);
            return apiError('Erro ao salvar URL da logomarca', 500);
        }

        return apiSuccess({ logo_url: logoUrl, message: 'Logomarca atualizada com sucesso' });
    } catch (error) {
        console.error('POST /api/settings/logo error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}
