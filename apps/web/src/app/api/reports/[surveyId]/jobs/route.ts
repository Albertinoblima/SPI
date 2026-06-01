import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { reportJobService } from '@/lib/reports/ReportJobService';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

/**
 * GET /api/reports/[surveyId]/jobs
 * Lista os jobs de relatórios gerados para o tenant da pesquisa.
 * Usado pela página de Histórico de Relatórios Físicos.
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
    const limit = parseInt(searchParams.get('limit') || '15', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Busca jobs do tenant (pode filtrar por survey depois se necessário)
    const jobs = await reportJobService.getUserJobs(ctx.tenantId, { limit, offset });

    // Filtra apenas os jobs desta survey para manter o contexto da página
    const filtered = jobs.filter((j: { survey_id?: string }) => j.survey_id === params.surveyId);

    return apiSuccess({
      jobs: filtered,
      total: filtered.length,
    });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_JOBS_LIST_ERROR',
    });
  }
}

/**
 * POST /api/reports/[surveyId]/jobs/[jobId]/revoke
 * Permite revogar um job específico (segurança).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
  try {
    const ctx = await getSurveyAuthContext();
    if (!ctx) return apiError('Não autorizado', 401, correlationId);

    const body = await request.json();
    const { action, jobId } = body;

    if (action === 'revoke' && jobId) {
      await reportJobService.revokeDownloadAccess(jobId, ctx.tenantId);
      return apiSuccess({ success: true, message: 'Link revogado com sucesso.' });
    }

    return apiError('Ação inválida', 400, correlationId);
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_JOB_ACTION_ERROR',
    });
  }
}
