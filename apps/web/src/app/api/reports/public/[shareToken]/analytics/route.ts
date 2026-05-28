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

    // Valida acesso (token + credenciais quando o share é protected)
    const access = await publicReportAccessService.validateAccess(
      params.shareToken,
      email,
      password
    );

    if (!access.valid) {
      return apiError(access.reason || 'Acesso negado', 401);
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
      availableCrossings: crossable.map((q: any) => ({
        id: q.id,
        text: q.question_text,
        type: q.question_type,
      })),
      shareInfo: {
        accessType: access.share.access_type,
        contractorEmail: access.share.contractor_email || null,
      },
      message: 'Dados do relatório dinâmico carregados com sucesso.',
    });
  } catch (error) {
    return apiError('Erro ao carregar dados do relatório', 500);
  }
}