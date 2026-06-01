import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';

/**
 * GET /api/surveys/[id]/premises
 * Retorna as premissas da pesquisa com informação se estão mapeadas.
 * Usado pelo ReportGeneratorPanel.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
  try {
    const ctx = await getSurveyAuthContext();
    if (!ctx) return apiError('Não autorizado', 401, correlationId);

    const admin = createAuditedSupabaseAdminClient('survey-premises-list');
    const { data: premises, error } = await admin
      .from('survey_premises')
      .select('id, category, label, options, mapped_question_id')
      .eq('survey_id', params.id)
      .eq('tenant_id', ctx.tenantId)
      .order('order_index');

    if (error) return apiError(error.message, 500, correlationId);

    return apiSuccess({
      premises: premises?.map(p => ({
        ...p,
        isMappableForCross: !!p.mapped_question_id,
      })) || [],
    });
  } catch (error) {
    return apiError('Erro interno', 500, correlationId);
  }
}