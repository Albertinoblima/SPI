import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import { issueMobileTokenPair } from '@/lib/mobile/token';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

const bodySchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) {
            return apiError(parsed.error.issues[0]?.message ?? 'Credenciais inválidas', 400, correlationId);
        }

        const admin = createAuditedSupabaseAdminClient('mobile-auth-login');
        const normalizedEmail = parsed.data.email.toLowerCase();

        const { data: signInData, error: signInError } = await admin.auth.signInWithPassword({
            email: normalizedEmail,
            password: parsed.data.password,
        });

        if (signInError || !signInData.user) {
            return apiError('Email ou senha inválidos', 401, correlationId);
        }

        const { data: profile, error: profileError } = await admin
            .from('users')
            .select('id, tenant_id, role, full_name, email, is_active')
            .eq('id', signInData.user.id)
            .single();

        if (profileError || !profile?.tenant_id) {
            return apiError('Perfil de usuário não encontrado', 403, correlationId);
        }

        if (profile.is_active === false) {
            return apiError('Usuário inativo. Fale com o administrador da pesquisa.', 403, correlationId);
        }

        if (profile.role !== 'interviewer') {
            return apiError('O aplicativo móvel é restrito a entrevistadores de campo.', 403, correlationId);
        }

        const tokens = issueMobileTokenPair({
            userId: profile.id,
            tenantId: profile.tenant_id,
            role: profile.role,
        });

        return apiSuccess({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
            access_expires_at: tokens.accessExpiresAt,
            refresh_expires_at: tokens.refreshExpiresAt,
            token_type: 'Bearer',
            user: {
                id: profile.id,
                tenant_id: profile.tenant_id,
                role: profile.role,
                full_name: profile.full_name,
                email: profile.email,
            },
            correlationId,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/auth/login', operation: 'POST', correlationId },
        });
    }
}
