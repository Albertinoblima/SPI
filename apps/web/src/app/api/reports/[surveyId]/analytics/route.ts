import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { reportAggregationService } from '@/lib/reports/ReportAggregationService';

export async function GET(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  try {
    const ctx = await getSurveyAuthContext(request, params.surveyId);
    if (!ctx) return apiError('Não autorizado', 401);

    const { searchParams } = new URL(request.url);
    const questionId = searchParams.get('questionId');
    const cross1 = searchParams.get('cross1');
    const cross2 = searchParams.get('cross2');

    if (questionId) {
      const distribution = await reportAggregationService.getQuestionDistribution(params.surveyId, questionId);
      return apiSuccess({ type: 'distribution', data: distribution });
    }

    if (cross1 && cross2) {
      const crossTab = await reportAggregationService.getCrossTab(params.surveyId, cross1, cross2);
      return apiSuccess({ type: 'crossTab', data: crossTab });
    }

    // Default: retorna totais + perguntas disponíveis para cruzamento
    const totals = await reportAggregationService.getBasicTotals(params.surveyId);
    const crossableQuestions = await reportAggregationService.getCrossableQuestions(params.surveyId);

    return apiSuccess({
      type: 'overview',
      data: {
        ...totals,
        availableCrossings: crossableQuestions,
      },
    });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_ANALYTICS_ERROR',
    });
  }
}