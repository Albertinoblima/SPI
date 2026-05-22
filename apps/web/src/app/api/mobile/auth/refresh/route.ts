import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAdminClient } from '@/lib/supabase/admin';
import { issueMobileTokenPair, verifyMobileRefreshToken } from '@/lib/mobile/token';

const bodySchema = z.object({
    refresh_token: z.string().min(1),
});

export async function POST(request: NextRequest) {
    try {
        const parsed = bodySchema.safeParse(await request.json());
        if (!parsed.success) return apiError('refresh_token inválido', 400);

        const claims = await verifyMobileRefreshToken(parsed.data.refresh_token);
        if (!claims) return apiError('Refresh token inválido ou expirado', 401);

        const admin = createAdminClient();
        const { data: profile } = await admin
            .from('users')
            .select('id, tenant_id, role, is_active')
            .eq('id', claims.sub)
            .single();

        if (!profile?.tenant_id || profile.is_active === false) {
            return apiError('Usuário inativo ou sem tenant válido', 403);
        }

        if (profile.role !== 'interviewer') {
            return apiError('Acesso mobile permitido apenas para entrevistadores', 403);
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
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/auth/refresh', operation: 'POST' },
        });
    }
}
