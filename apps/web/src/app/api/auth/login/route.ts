import { NextRequest } from 'next/server';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import {
    getSafeRedirectPath,
    loginRequestSchema,
    normalizeAuthErrorMessage,
} from '@/lib/auth/login';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { getUserAuditContextByEmail, logAuthAuditEvent } from '@/lib/auth/audit';
import { createRouteHandlerClient } from '@/lib/supabase/route';
import { getPostLoginRedirectUrl } from '@/lib/post-login-redirect.server';

function getRateLimitKey(request: NextRequest, email: string) {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip')?.trim();
    const ip = forwardedFor || realIp || 'unknown';

    return `${ip}:${email.trim().toLowerCase()}`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsedBody = loginRequestSchema.safeParse(body);

        if (!parsedBody.success) {
            return apiError(parsedBody.error.issues[0]?.message ?? 'Credenciais inválidas.', 400);
        }

        const normalizedEmail = parsedBody.data.email.trim().toLowerCase();
        const rateLimit = consumeRateLimit({
            namespace: 'web-login',
            key: getRateLimitKey(request, normalizedEmail),
            limit: 5,
            windowMs: 10 * 60 * 1000,
        });

        if (!rateLimit.allowed) {
            const context = await getUserAuditContextByEmail(normalizedEmail);

            await logAuthAuditEvent({
                action: 'auth_login_rate_limited',
                email: normalizedEmail,
                request,
                userId: context.userId,
                tenantId: context.tenantId,
                isCritical: true,
                description: 'Tentativas de login bloqueadas por rate limiting.',
                metadata: {
                    provider: 'password',
                    retryAfterSeconds: rateLimit.retryAfterSeconds,
                },
            });

            const response = apiError(
                'Muitas tentativas de login em sequência. Aguarde alguns minutos antes de tentar novamente.',
                429
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }

        const { supabase, applyCookies } = createRouteHandlerClient();

        const { data, error } = await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password: parsedBody.data.password,
        });

        if (error || !data.user) {
            const context = await getUserAuditContextByEmail(normalizedEmail);

            await logAuthAuditEvent({
                action: 'auth_login_failed',
                email: normalizedEmail,
                request,
                userId: context.userId,
                tenantId: context.tenantId,
                isCritical: false,
                description: 'Falha de autenticação por senha.',
                metadata: {
                    provider: 'password',
                    reason: error?.message ?? 'unknown',
                },
            });

            return applyCookies(apiError(normalizeAuthErrorMessage(error?.message), 401));
        }

        const redirectTo = getSafeRedirectPath(
            parsedBody.data.redirect,
            await getPostLoginRedirectUrl()
        );

        await logAuthAuditEvent({
            action: 'auth_login_succeeded',
            email: normalizedEmail,
            request,
            userId: data.user.id,
            description: 'Login concluído com sucesso.',
            metadata: {
                provider: 'password',
                redirectTo,
            },
        });

        return applyCookies(apiSuccess({ redirectTo }));
    } catch (error) {
        await trackedApiError(request, 'Falha inesperada no login', 500, {
            errorCode: 'AUTH_FORBIDDEN',
            metadata: { route: '/api/auth/login' },
        });

        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/auth/login' },
        });
    }
}