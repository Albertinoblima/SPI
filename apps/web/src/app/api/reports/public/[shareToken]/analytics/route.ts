import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { publicReportAccessService } from '@/lib/reports/PublicReportAccessService';
import { reportAggregationService } from '@/lib/reports/ReportAggregationService';

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
  try {
    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email') || undefined;
    const password = searchParams.get('password') || undefined;

    // Valida acesso (token + credenciais quando necessário)
    const access = await publicReportAccessService.validateAccess(
      params.shareToken,
      email,
      password
    );

    if (!access.valid) {
      return apiError(access.reason || 'Acesso negado', 401);
    }

    const surveyId = access.share.survey_id;

    // Busca dados reais de analytics
    const totals = await reportAggregationService.getBasicTotals(surveyId);
    const availableCrossings = await reportAggregationService.getCrossableQuestions(surveyId);

    return apiSuccess({
      surveyId,
      totalResponses: totals.totalResponses,
      availableCrossings: availableCrossings.map(q => [q.id, q.question_text]), // simplificado para o frontend
      message: 'Dados do relatório dinâmico carregados com sucesso.',
    });
  } catch (error) {
    return apiError('Erro ao carregar dados do relatório', 500);
  }
}