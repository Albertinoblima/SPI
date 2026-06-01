import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import {
  publicReportAccessService,
  PUBLIC_REPORT_SESSION_COOKIE,
} from '@/lib/reports/PublicReportAccessService';
import { reportAggregationService } from '@/lib/reports/ReportAggregationService';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';
import { checkRateLimitDistributed } from '@political-research/shared-utils';

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'unknown';
}

/**
 * GET /api/reports/public/[shareToken]/analytics
 * 
 * Retorna dados analíticos para o relatório dinâmico do contratante.
 * Requer autenticação via shareToken + credenciais do contratante (quando aplicável).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
  try {
    const clientIp = getClientIp(request);
    const limit = await checkRateLimitDistributed(
      `public-report-analytics:${params.shareToken}:${clientIp}`,
      { windowMs: 60 * 1000, maxRequests: 60 }
    );

    if (!limit.allowed) {
      const response = apiError(
        'Limite de requisições excedido para este relatório público.',
        429,
        correlationId
      );
      response.headers.set('Retry-After', String(limit.retryAfterSeconds));
      return response;
    }

    const { searchParams } = new URL(request.url);

    const sessionToken = request.cookies.get(PUBLIC_REPORT_SESSION_COOKIE)?.value;
    if (!sessionToken) {
      return apiError('Sessão de acesso não encontrada. Faça autenticação novamente.', 401, correlationId);
    }

    const sessionValidation = publicReportAccessService.validatePublicSessionToken(sessionToken, params.shareToken);
    if (!sessionValidation.valid) {
      return apiError(sessionValidation.reason || 'Sessão inválida', 401, correlationId);
    }

    // Hard-block de expiração/is_active também no acesso por sessão.
    const access = await publicReportAccessService.validateAccess(params.shareToken);

    if (!access.valid) {
      const status = access.reason === 'Link expirado' ? 410 : 401;
      return apiError(access.reason || 'Acesso negado', status, correlationId);
    }

    const surveyId = access.share.survey_id;

    const cross1 = searchParams.get('cross1');
    const cross2 = searchParams.get('cross2');

    // Se pediram cruzamento explícito, entregue o cross real
    if (cross1 && cross2) {
      const crossTab = await reportAggregationService.getCrossTab(surveyId, cross1, cross2);
      return apiSuccess({
        type: 'crossTab',
        variables: [cross1, cross2],
        data: crossTab,
        message: 'Cruzamento gerado com sucesso.',
      });
    }

    // Busca dados reais de analytics (visão geral + lista de cruzáveis)
    const totals = await reportAggregationService.getBasicTotals(surveyId);
    const crossable = await reportAggregationService.getCrossableQuestions(surveyId);

    return apiSuccess({
      surveyId,
      totalResponses: totals.totalResponses,
      lastUpdated: totals.lastUpdated,
      availableCrossings: crossable.map((q: Record<string, unknown>) => ({
        id: q['id'],
        text: q['question_text'],
        type: q['question_type'],
      })),
      shareInfo: {
        accessType: access.share.access_type,
        contractorEmail: access.share.contractor_email || null,
      },
      message: 'Dados do relatório dinâmico carregados com sucesso.',
    });
  } catch (error) {
    return apiError('Erro ao carregar dados do relatório', 500, correlationId);
  }
}