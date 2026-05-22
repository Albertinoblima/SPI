import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { getMobileAuthContext } from '@/lib/mobile/auth';

interface RouteParams {
    params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const ctx = await getMobileAuthContext(request);
        if (!ctx) return apiError('Nao autenticado', 401);

        const admin = createAdminClient();
        const formData = await request.formData();
        const file = formData.get('foto');

        if (!(file instanceof File)) {
            return apiError('Arquivo de foto nao informado', 400);
        }

        const extension = file.name.split('.').pop() || 'jpg';
        const storagePath = `${ctx.tenantId}/${params.id}/${Date.now()}.${extension}`;

        const arrayBuffer = await file.arrayBuffer();
        const { error: uploadError } = await admin.storage
            .from('response-media')
            .upload(storagePath, Buffer.from(arrayBuffer), {
                upsert: true,
                contentType: file.type || 'image/jpeg',
            });

        if (uploadError) {
            return apiError(`Falha no upload da foto: ${uploadError.message}`, 500);
        }

        const { error: updateError } = await admin
            .from('interviews')
            .update({ photo_path: storagePath })
            .eq('id', params.id)
            .eq('tenant_id', ctx.tenantId)
            .eq('interviewer_id', ctx.userId);

        if (updateError) {
            return apiError(`Falha ao vincular foto: ${updateError.message}`, 500);
        }

        return apiSuccess({ interview_id: params.id, photo_path: storagePath });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/entrevistas/[id]/foto', operation: 'POST', interviewId: params.id },
        });
    }
}
