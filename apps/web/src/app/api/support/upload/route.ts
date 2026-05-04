// POST /api/support/upload - Upload de arquivo/imagem para um ticket
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { apiError, apiSuccess } from '@/lib/api-middleware';

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
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

export async function POST(request: NextRequest) {
    const supabase = createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiError('Não autenticado', 401);

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const ticketId = formData.get('ticket_id') as string | null;

        if (!file) return apiError('Arquivo não informado', 400);
        if (!ticketId) return apiError('ticket_id não informado', 400);
        if (file.size > MAX_SIZE_BYTES) return apiError('Arquivo muito grande (máx 10MB)', 400);
        if (!ALLOWED_TYPES.includes(file.type)) return apiError('Tipo de arquivo não permitido', 400);

        // Usar service role para upload no storage
        const adminClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
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
            console.error('Upload error:', uploadError);
            return apiError('Erro ao fazer upload', 500);
        }

        // Gerar URL pública (bucket público) ou signed URL (bucket privado)
        const { data: urlData } = adminClient.storage
            .from('support-attachments')
            .getPublicUrl(fileName);

        return apiSuccess({
            url: urlData.publicUrl,
            name: file.name,
            type: file.type,
            size: file.size,
        }, 201);
    } catch (err) {
        console.error('Upload exception:', err);
        return apiError('Erro interno', 500);
    }
}
