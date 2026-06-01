import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { reportJobService } from '@/lib/reports/ReportJobService';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

/**
 * POST /api/reports/[surveyId]/generate
 * 
 * Nova rota profissional para geração de relatórios.
 * Usa o sistema de Jobs (Fase 0.5) para suportar documentos grandes com segurança.
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

    // Cria o job de geração (agora com suporte a premissas selecionadas para cruzamentos)
    const job = await reportJobService.createJob({
      surveyId: params.surveyId,
      tenantId: ctx.tenantId,
      reportType: body.reportType || 'synthetic',
      configuration: {
        ...body,
        selectedPremises: body.selectedPremises || [],
        includeLocalityCross: body.includeLocalityCross ?? true,
        format: body.format || 'docx', // 'docx' | 'pdf'
        useAIInsights: body.useAIInsights ?? false, // Futuro: ativar análises por IA no Consolidado
      },
      requestedBy: ctx.userId,
      filters: body.filters,
      correlationId, // Fase 6 observability
    });

    // Processa imediatamente (para Fase 1).
    // Em Fase 2+ podemos decidir fazer assíncrono para relatórios muito grandes.
    const result = await reportJobService.processJob(job.id);

    if (!result.success) {
      return apiError(result.error || 'Falha ao gerar relatório', 500, correlationId);
    }

    // Gera link seguro de download
    const download = await reportJobService.generateSecureDownloadUrl(job.id, ctx.tenantId);

    return apiSuccess({
      jobId: job.id,
      correlationId,
      status: 'ready',
      downloadUrl: download.url,
      expiresInMinutes: download.expiresInMinutes,
      remainingDownloads: download.remainingDownloads,
      message: 'Relatório gerado com sucesso. Use o link abaixo para baixar (válido por tempo limitado).',
    });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_GENERATION_FAILED',
      metadata: { correlationId },
    });
  }
}