import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { forgotPasswordSchema } from '@/lib/auth/login';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { getUserAuditContextByEmail, logAuthAuditEvent } from '@/lib/auth/audit';

function buildRecoveryRedirect(request: NextRequest) {
    const callbackUrl = new URL('/auth/callback', request.url);
    callbackUrl.searchParams.set('next', '/reset-password');
    return callbackUrl.toString();
}

function getRateLimitKey(request: NextRequest, email: string) {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip')?.trim();
    const ip = forwardedFor || realIp || 'unknown';

    return `${ip}:${email.trim().toLowerCase()}`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsedBody = forgotPasswordSchema.safeParse(body);

        if (!parsedBody.success) {
            return apiError(parsedBody.error.issues[0]?.message ?? 'Email inválido.', 400);
        }

        const normalizedEmail = parsedBody.data.email.trim().toLowerCase();
        const rateLimit = consumeRateLimit({
            namespace: 'web-forgot-password',
            key: getRateLimitKey(request, normalizedEmail),
            limit: 3,
            windowMs: 15 * 60 * 1000,
        });

        if (!rateLimit.allowed) {
            const context = await getUserAuditContextByEmail(normalizedEmail);

            await logAuthAuditEvent({
                action: 'auth_password_reset_rate_limited',
                email: normalizedEmail,
                request,
                userId: context.userId,
                tenantId: context.tenantId,
                isCritical: true,
                description: 'Solicitações de redefinição de senha bloqueadas por rate limiting.',
                metadata: {
                    retryAfterSeconds: rateLimit.retryAfterSeconds,
                },
            });

            const response = apiError(
                'Muitas solicitações de redefinição em sequência. Aguarde alguns minutos antes de tentar novamente.',
                429
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            }
        );

        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
            redirectTo: buildRecoveryRedirect(request),
        });

        const context = await getUserAuditContextByEmail(normalizedEmail);

        await logAuthAuditEvent({
            action: error ? 'auth_password_reset_failed' : 'auth_password_reset_requested',
            email: normalizedEmail,
            request,
            userId: context.userId,
            tenantId: context.tenantId,
            description: error
                ? 'Falha ao solicitar redefinição de senha.'
                : 'Solicitação de redefinição de senha registrada.',
            metadata: {
                reason: error?.message ?? null,
            },
        });

        if (error) {
            return apiError('Não foi possível iniciar a redefinição de senha agora. Tente novamente.', 500);
        }

        return apiSuccess({
            message: 'Se o email existir, enviamos um link seguro para redefinição de senha.',
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}