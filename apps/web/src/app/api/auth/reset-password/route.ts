import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { normalizeAuthErrorMessage, resetPasswordSchema } from '@/lib/auth/login';
import { consumeRateLimit } from '@/lib/auth/rate-limit';
import { logAuthAuditEvent } from '@/lib/auth/audit';
import { createRouteHandlerClient } from '@/lib/supabase/route';

function getRateLimitKey(request: NextRequest) {
    const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const realIp = request.headers.get('x-real-ip')?.trim();

    return forwardedFor || realIp || 'unknown';
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsedBody = resetPasswordSchema.safeParse(body);

        if (!parsedBody.success) {
            return apiError(parsedBody.error.issues[0]?.message ?? 'Dados inválidos.', 400);
        }

        const rateLimit = consumeRateLimit({
            namespace: 'web-reset-password',
            key: getRateLimitKey(request),
            limit: 5,
            windowMs: 15 * 60 * 1000,
        });

        if (!rateLimit.allowed) {
            const response = apiError(
                'Muitas tentativas de redefinição em sequência. Aguarde alguns minutos antes de tentar novamente.',
                429
            );
            response.headers.set('Retry-After', String(rateLimit.retryAfterSeconds));
            return response;
        }

        const { supabase, applyCookies } = createRouteHandlerClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (!user || authError) {
            await logAuthAuditEvent({
                action: 'auth_password_reset_rejected',
                request,
                description: 'Tentativa de redefinição de senha sem sessão de recuperação válida.',
                metadata: {
                    reason: authError?.message ?? 'missing_recovery_session',
                },
            });

            return applyCookies(apiError('Sessão de redefinição inválida ou expirada.', 401));
        }

        const { error } = await supabase.auth.updateUser({
            password: parsedBody.data.password,
        });

        if (error) {
            await logAuthAuditEvent({
                action: 'auth_password_reset_failed',
                email: user.email,
                request,
                userId: user.id,
                description: 'Falha ao concluir redefinição de senha.',
                metadata: {
                    reason: error.message,
                },
            });

            return applyCookies(apiError(normalizeAuthErrorMessage(error.message), 400));
        }

        await logAuthAuditEvent({
            action: 'auth_password_reset_completed',
            email: user.email,
            request,
            userId: user.id,
            description: 'Senha redefinida com sucesso.',
        });

        return applyCookies(apiSuccess({
            message: 'Senha redefinida com sucesso.',
        }));
    } catch (error) {
        console.error('Reset password error:', error);
        return apiError('Erro interno do servidor', 500);
    }
}