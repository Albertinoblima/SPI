// POST /api/support/upload - Upload de arquivo/imagem para um ticket
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';
import { checkRateLimitDistributed } from '@political-research/shared-utils';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/pdf',
    'text/plain',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

function createAuthClient() {
    const cookieStore = cookies();
    return createServerClient(
        process.env['NEXT_PUBLIC_SUPABASE_URL']!,
        process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value; },
                set(name: string, value: string, options: Record<string, unknown>) {
                    cookieStore.set({ name, value, ...options });
                },
                remove(name: string, options: Record<string, unknown>) {
                    cookieStore.set({ name, value: '', ...options });
                },
            },
        }
    );
}

function getClientIp(request: NextRequest): string {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')?.trim()
        || 'unknown';
}

export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    const limit = await checkRateLimitDistributed(
        `support-upload:${getClientIp(request)}`,
        { windowMs: 10 * 60 * 1000, maxRequests: 30 }
    );

    if (!limit.allowed) {
        const response = apiError('Muitas tentativas de upload. Aguarde antes de tentar novamente.', 429, correlationId);
        response.headers.set('Retry-After', String(limit.retryAfterSeconds));
        return response;
    }

    const supabase = createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiError('Não autenticado', 401, correlationId);

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const ticketId = formData.get('ticket_id') as string | null;

        if (!file) return apiError('Arquivo não informado', 400, correlationId);
        if (!ticketId) return apiError('ticket_id não informado', 400, correlationId);
        if (file.size > MAX_SIZE_BYTES) return apiError('Arquivo muito grande (máx 10MB)', 400, correlationId);
        if (!ALLOWED_TYPES.includes(file.type)) return apiError('Tipo de arquivo não permitido', 400, correlationId);

        const [{ data: userData }, { data: ticket }] = await Promise.all([
            supabase
                .from('users')
                .select('tenant_id, role, is_system_admin')
                .eq('id', user.id)
                .single(),
            supabase
                .from('support_tickets')
                .select('id, tenant_id, user_id')
                .eq('id', ticketId)
                .single(),
        ]);

        if (!ticket) {
            return apiError('Ticket não encontrado', 404, correlationId);
        }

        const isOwner = ticket.user_id === user.id;
        const isSystemAdmin = Boolean(userData?.is_system_admin);
        const isTenantManager = Boolean(
            userData?.tenant_id &&
            ticket.tenant_id === userData.tenant_id &&
            ['admin', 'manager'].includes(userData.role)
        );

        if (!isOwner && !isSystemAdmin && !isTenantManager) {
            return apiError('Sem permissão para anexar arquivo neste ticket', 403, correlationId);
        }

        // Usar service role para upload no storage
        const adminClient = createClient(
            process.env['NEXT_PUBLIC_SUPABASE_URL']!,
            process.env['SUPABASE_SERVICE_ROLE_KEY']!
        );

        const ext = file.name.split('.').pop() ?? 'bin';
        const fileName = `${ticketId}/${user.id}_${Date.now()}.${ext}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const { error: uploadError } = await adminClient.storage
            .from('support-attachments')
            .upload(fileName, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            return trackedApiError(request, 'Erro ao fazer upload', 500, {
                errorCode: 'STORAGE_UPLOAD_FAILED',
                userId: user.id,
                metadata: { route: '/api/support/upload', ticketId },
            });
        }

        const { data: signedData, error: signedError } = await adminClient.storage
            .from('support-attachments')
            .createSignedUrl(fileName, 60 * 60);

        if (signedError || !signedData?.signedUrl) {
            return trackedApiError(request, 'Erro ao gerar URL temporária do anexo', 500, {
                errorCode: 'STORAGE_UPLOAD_FAILED',
                userId: user.id,
                metadata: { route: '/api/support/upload', ticketId, stage: 'signed_url' },
            });
        }

        return apiSuccess({
            url: signedData.signedUrl,
            name: file.name,
            type: file.type,
            size: file.size,
            expires_in_seconds: 60 * 60,
        }, 201);
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/support/upload' },
        });
    }
}
