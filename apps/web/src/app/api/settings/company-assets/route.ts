import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 768;
const ALLOWED_ASSET_TYPES = ['logo_sem_slogan', 'logo_com_slogan', 'logo_alternativa'] as const;

type AssetType = typeof ALLOWED_ASSET_TYPES[number];

function isAssetType(value: string): value is AssetType {
    return ALLOWED_ASSET_TYPES.includes(value as AssetType);
}

async function getUserContext() {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!user || authError) return null;

    const { data: userData } = await supabase
        .from('users')
        .select('tenant_id, role')
        .eq('id', user.id)
        .single();

    if (!userData?.tenant_id) return null;

    return {
        userId: user.id,
        tenantId: userData.tenant_id,
        role: userData.role,
    };
}

export async function GET(request: NextRequest) {
    try {
        const ctx = await getUserContext();
        if (!ctx) return apiError('Não autenticado', 401);

        const admin = createAdminClient();
        const { data, error } = await admin
            .from('company_assets')
            .select('id, tenant_id, asset_type, file_url, storage_path, is_active, created_at, updated_at')
            .eq('tenant_id', ctx.tenantId)
            .order('created_at', { ascending: false });

        if (error) return apiError(`Falha ao carregar assets: ${error.message}`, 500);

        return apiSuccess({ assets: data ?? [] });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/settings/company-assets', operation: 'GET' },
        });
    }
}

export async function POST(request: NextRequest) {
    try {
        const ctx = await getUserContext();
        if (!ctx) return apiError('Não autenticado', 401);
        if (!['admin', 'manager'].includes(ctx.role)) {
            return apiError('Sem permissão para alterar assets da empresa', 403);
        }

        const formData = await request.formData();
        const file = formData.get('file');
        const assetTypeRaw = String(formData.get('asset_type') ?? '').trim();

        if (!(file instanceof File)) return apiError('Nenhum arquivo enviado', 400);
        if (!isAssetType(assetTypeRaw)) return apiError('asset_type inválido', 400);
        if (!ALLOWED_TYPES.includes(file.type)) {
            return apiError('Formato inválido. Use JPEG, PNG, WebP ou SVG.', 400);
        }
        if (file.size > MAX_SIZE_BYTES) {
            return apiError('Arquivo muito grande. Máximo 10MB.', 400);
        }

        const inputBuffer = Buffer.from(await file.arrayBuffer());

        let outputBuffer: Buffer;
        let ext: string;
        let contentType: string;

        if (file.type === 'image/svg+xml') {
            outputBuffer = inputBuffer;
            ext = 'svg';
            contentType = 'image/svg+xml';
        } else {
            outputBuffer = await sharp(inputBuffer)
                .resize(MAX_DIMENSION, MAX_DIMENSION, {
                    fit: 'inside',
                    withoutEnlargement: true,
                })
                .webp({ quality: 88 })
                .toBuffer();
            ext = 'webp';
            contentType = 'image/webp';
        }

        const admin = createAdminClient();
        const storagePath = `logos/${ctx.tenantId}/${assetTypeRaw}/${Date.now()}.${ext}`;

        const { error: uploadError } = await admin.storage
            .from('company-assets')
            .upload(storagePath, outputBuffer, {
                upsert: false,
                contentType,
            });

        if (uploadError) {
            if (uploadError.message?.toLowerCase().includes('bucket')) {
                const { error: bucketError } = await admin.storage.createBucket('company-assets', { public: true });
                if (bucketError && !bucketError.message?.toLowerCase().includes('already exists')) {
                    return apiError(`Erro ao preparar bucket: ${bucketError.message}`, 500);
                }

                const { error: retryError } = await admin.storage
                    .from('company-assets')
                    .upload(storagePath, outputBuffer, { upsert: false, contentType });

                if (retryError) {
                    return apiError(`Falha no upload do asset: ${retryError.message}`, 500);
                }
            } else {
                return apiError(`Falha no upload do asset: ${uploadError.message}`, 500);
            }
        }

        const { data: publicData } = admin.storage.from('company-assets').getPublicUrl(storagePath);
        const fileUrl = publicData.publicUrl;

        await admin
            .from('company_assets')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('tenant_id', ctx.tenantId)
            .eq('asset_type', assetTypeRaw)
            .eq('is_active', true);

        const { data: created, error: insertError } = await admin
            .from('company_assets')
            .insert({
                tenant_id: ctx.tenantId,
                asset_type: assetTypeRaw,
                file_url: fileUrl,
                storage_path: storagePath,
                is_active: true,
                created_by: ctx.userId,
            })
            .select('id, asset_type, file_url, storage_path, is_active, created_at, updated_at')
            .single();

        if (insertError || !created) {
            return apiError(`Falha ao registrar asset: ${insertError?.message ?? 'desconhecido'}`, 500);
        }

        return apiSuccess({ asset: created, message: 'Asset enviado com sucesso' });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/settings/company-assets', operation: 'POST' },
        });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const ctx = await getUserContext();
        if (!ctx) return apiError('Não autenticado', 401);
        if (!['admin', 'manager'].includes(ctx.role)) {
            return apiError('Sem permissão para excluir assets da empresa', 403);
        }

        const assetId = request.nextUrl.searchParams.get('id');
        if (!assetId) return apiError('Informe o id do asset', 400);

        const admin = createAdminClient();
        const { data: existing, error: existingError } = await admin
            .from('company_assets')
            .select('id, tenant_id, storage_path')
            .eq('id', assetId)
            .eq('tenant_id', ctx.tenantId)
            .single();

        if (existingError || !existing) return apiError('Asset não encontrado', 404);

        await admin.storage.from('company-assets').remove([existing.storage_path]);

        const { error: deleteError } = await admin
            .from('company_assets')
            .delete()
            .eq('id', assetId)
            .eq('tenant_id', ctx.tenantId);

        if (deleteError) return apiError(`Falha ao remover asset: ${deleteError.message}`, 500);

        return apiSuccess({ id: assetId, message: 'Asset removido com sucesso' });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/settings/company-assets', operation: 'DELETE' },
        });
    }
}
