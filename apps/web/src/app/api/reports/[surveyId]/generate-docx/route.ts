import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { docxReportGenerator } from '@/lib/reports/DocxReportGenerator';
import { reportAggregationService } from '@/lib/reports/ReportAggregationService';
import type { ReportConfiguration } from '@/lib/reports/types';

export async function POST(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  try {
    const ctx = await getSurveyAuthContext(request, params.surveyId);
    if (!ctx) return apiError('Não autorizado', 401);

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

    // Fetch rich survey + planning data
    const { data: survey } = await ctx.supabase
      .from('surveys')
      .select(`
        id, title, description, status, created_at,
        survey_premises(*),
        planning_data(*)
      `)
      .eq('id', params.surveyId)
      .single();

    if (!survey) return apiError('Pesquisa não encontrada', 404);

    // Get basic analytics
    const totals = await reportAggregationService.getBasicTotals(params.surveyId);

    // Prepare data for the generator
    const reportData = {
      title: survey.title,
      planning: survey.planning_data?.[0] || null,
      premises: survey.survey_premises || [],
      totals,
    };

    const buffer = await docxReportGenerator.generate(config as ReportConfiguration, reportData);

    // Return as downloadable file
    return new Response(buffer, {
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