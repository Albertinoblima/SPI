import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import {
  publicReportAccessService,
  PUBLIC_REPORT_SESSION_COOKIE,
} from '@/lib/reports/PublicReportAccessService';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';
import { checkRateLimitDistributed } from '@political-research/shared-utils';

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

export async function POST(
  request: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
  try {
    const clientIp = getClientIp(request);
    const limit = await checkRateLimitDistributed(
      `public-report-auth:${params.shareToken}:${clientIp}`,
      { windowMs: 10 * 60 * 1000, maxRequests: 8 }
    );

    if (!limit.allowed) {
      const response = apiError(
        'Muitas tentativas de autenticação. Aguarde antes de tentar novamente.',
        429,
        correlationId
      );
      response.headers.set('Retry-After', String(limit.retryAfterSeconds));
      return response;
    }

    const { email, password } = await request.json();

    const result = await publicReportAccessService.validateAccess(
      params.shareToken,
      email,
      password
    );

    if (!result.valid) {
      const status = result.reason === 'Link expirado' ? 410 : 401;
      return apiError(result.reason || 'Acesso negado', status, correlationId);
    }

    const sessionToken = publicReportAccessService.createPublicSessionToken(params.shareToken);

    const response = apiSuccess({
      message: 'Autenticado com sucesso',
      share: {
        id: result.share.id,
        access_type: result.share.access_type,
        contractor_email: result.share.contractor_email || null,
        expires_at: result.share.expires_at || null,
      },
    }, 200, correlationId);

    response.cookies.set({
      name: PUBLIC_REPORT_SESSION_COOKIE,
      value: sessionToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env['NODE_ENV'] === 'production',
      path: '/',
      maxAge: 15 * 60,
    });

    return response;
  } catch (error) {
    return apiError('Erro ao autenticar', 500, correlationId);
  }
}