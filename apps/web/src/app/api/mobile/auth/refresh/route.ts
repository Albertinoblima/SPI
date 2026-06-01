import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import { issueMobileTokenPair, verifyMobileRefreshToken } from '@/lib/mobile/token';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

const bodySchema = z.object({
    refresh_token: z.string().min(1),
});

export async function POST(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) return apiError('refresh_token inválido', 400, correlationId);

        const claims = await verifyMobileRefreshToken(parsed.data.refresh_token);
        if (!claims) return apiError('Refresh token inválido ou expirado', 401, correlationId);

        const admin = createAuditedSupabaseAdminClient('mobile-auth-refresh');
        const { data: profile } = await admin
            .from('users')
            .select('id, tenant_id, role, is_active')
            .eq('id', claims.sub)
            .single();

        if (!profile?.tenant_id || profile.is_active === false) {
            return apiError('Usuário inativo ou sem tenant válido', 403, correlationId);
        }

        if (profile.role !== 'interviewer') {
            return apiError('Acesso mobile permitido apenas para entrevistadores', 403, correlationId);
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
            correlationId,
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/auth/refresh', operation: 'POST', correlationId },
        });
    }
}
