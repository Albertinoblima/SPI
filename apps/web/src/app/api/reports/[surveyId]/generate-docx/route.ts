import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { docxReportGenerator } from '@/lib/reports/DocxReportGenerator';
import { reportAggregationService } from '@/lib/reports/ReportAggregationService';
import type { ReportConfiguration, ReportSurveyData } from '@/lib/reports/types';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';

export async function POST(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
  try {
    const ctx = await getSurveyAuthContext();
    if (!ctx) return apiError('Não autorizado', 401, correlationId);

    const body = await request.json();

    // Basic validation
    const config: Partial<ReportConfiguration> = {
      surveyId: params.surveyId,
      tenantId: ctx.tenantId,
      name: body.name || 'Relatório de Pesquisa',
      reportType: body.reportType || 'synthetic',
      pageSize: body.pageSize || 'A4',
      pageOrientation: body.pageOrientation || 'portrait',
      paperType: body.paperType || 'standard',
      margins: body.margins || { top: 2.5, bottom: 2.5, left: 2, right: 2 },
      includeTableOfContents: body.includeTableOfContents ?? true,
      includeMethodology: body.includeMethodology ?? true,
      includePlanningMetadata: body.includePlanningMetadata ?? true,
      selectedCrossings: body.selectedCrossings || [],
      headingStyle: body.headingStyle || 'microsoft_word',
      colorScheme: body.colorScheme || 'professional',
    };

    // Fetch rich survey + planning data (using audited client for consistency - F6)
    const admin = createAuditedSupabaseAdminClient('generate-docx');
    const { data: survey } = await admin
      .from('surveys')
      .select(`
        id, title, description, status, created_at,
        survey_premises(*),
        planning_data(*)
      `)
      .eq('id', params.surveyId)
      .single();

    if (!survey) return apiError('Pesquisa não encontrada', 404, correlationId);

    // Get basic analytics
    const totals = await reportAggregationService.getBasicTotals(params.surveyId);

    // Prepare data for the generator (F6: closer to ReportSurveyData contract)
    const reportData = {
      title: survey.title,
      tenantId: ctx.tenantId,
      planning: survey.planning_data?.[0] || null,
      premises: survey.survey_premises || [],
      totals,
    } as unknown as ReportSurveyData;

    const buffer = await docxReportGenerator.generate(config as ReportConfiguration, reportData);

    // Return as downloadable file (proper Buffer handling)
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${config.name}.docx"`,
      },
    });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_DOCX_GENERATION_FAILED',
    });
  }
}