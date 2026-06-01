import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { advancedReportAggregationService } from '@/lib/reports/AdvancedReportAggregationService';
import type { ReportFilters } from '@/lib/reports/types';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

/**
 * GET /api/reports/[surveyId]/analytics
 * 
 * Motor profissional do Relatório Dinâmico.
 * Suporta filtros avançados por premissas mapeadas + localidade (usando AdvancedReportAggregationService).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
  try {
    const ctx = await getSurveyAuthContext();
    if (!ctx) return apiError('Não autorizado', 401, correlationId);

    const { searchParams } = new URL(request.url);

    // Filtros profissionais vindos da UI do Relatório Dinâmico
    const localityIds = searchParams.get('localityIds')?.split(',').filter(Boolean) ?? [];
    const zoneCandidates = searchParams.get('zones')?.split(',').filter(Boolean) ?? [];
    const zones = zoneCandidates.filter((zone): zone is 'urban' | 'rural' | 'mixed' => (
      zone === 'urban' || zone === 'rural' || zone === 'mixed'
    ));
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const filters: ReportFilters = {
      ...(localityIds.length > 0 ? { localityIds } : {}),
      ...(zones.length > 0 ? { zones } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      onlyComplete: searchParams.get('onlyComplete') !== 'false',
    };

    // Premissas selecionadas para filtro (formato: premise:sexo=masculino,feminino)
    const premiseFilters: Record<string, string[]> = {};
    searchParams.getAll('premise').forEach(p => {
      const [cat, vals] = p.split('=');
      if (cat && vals) premiseFilters[cat] = vals.split(',');
    });
    if (Object.keys(premiseFilters).length > 0) filters.premises = premiseFilters;

    const questionId = searchParams.get('questionId');
    const crossPrimary = searchParams.get('crossPrimary');
    const crossSecondary = searchParams.get('crossSecondary'); // pode ser "premise:sexo" ou questionId

    // === Distribuição simples de uma pergunta (com filtros) ===
    if (questionId) {
      const distribution = await advancedReportAggregationService.getQuestionDistributionWithFilters(
        params.surveyId,
        questionId,
        filters
      );
      return apiSuccess({ type: 'distribution', data: distribution, filters });
    }

    // === Cruzamento avançado (pergunta × pergunta ou pergunta × premissa) ===
    if (crossPrimary && crossSecondary) {
      let secondary: string | { type: 'premise'; category: string } = crossSecondary;

      if (crossSecondary.startsWith('premise:')) {
        secondary = {
          type: 'premise',
          category: crossSecondary.replace('premise:', ''),
        };
      }

      const crossTab = await advancedReportAggregationService.getCrossTabWithFilters(
        params.surveyId,
        crossPrimary,
        secondary,
        filters
      );
      return apiSuccess({ type: 'crossTab', data: crossTab, filters });
    }

    // === Visão geral + dimensões disponíveis para cruzamento ===
    const totals = await advancedReportAggregationService.getBasicTotals(params.surveyId, filters);
    const crossable = await advancedReportAggregationService.getCrossableDimensions(params.surveyId);
    const premises = await advancedReportAggregationService.getAvailablePremisesForCross(params.surveyId);
    const localities = await advancedReportAggregationService.getSurveyLocalities(params.surveyId);

    return apiSuccess({
      type: 'overview',
      data: {
        ...totals,
        availableDimensions: {
          questions: crossable.questions || crossable || [],
          mappedPremises: crossable.mappedPremises || [],
        },
        availablePremises: premises,
        availableLocalities: localities,
      },
      filters,
    });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_ANALYTICS_ERROR',
    });
  }
}