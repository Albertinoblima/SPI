import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { publicReportAccessService } from '@/lib/reports/PublicReportAccessService';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';

/**
 * POST /api/reports/[surveyId]/shares
 * Cria um novo link de compartilhamento protegido para contratante.
 * Requer autenticação do tenant (pesquisador/admin).
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

    const share = await publicReportAccessService.createShare({
      surveyId: params.surveyId,
      tenantId: ctx.tenantId,
      reportConfigurationId: body.reportConfigurationId,
      accessType: body.accessType || 'protected',
      expiresAt: body.expiresAt,
    });

    // Se o caller já enviou credenciais do contratante, configure imediatamente
    if (body.contractorEmail && body.contractorPassword) {
      await publicReportAccessService.setContractorCredentials(
        share.id,
        body.contractorEmail,
        body.contractorPassword,
        body.contractorName
      );
    }

    return apiSuccess({
      share,
      shareUrl: `${process.env['NEXT_PUBLIC_APP_URL'] || ''}/reports/public/${share.share_token}`,
      message: 'Link de relatório gerado com sucesso. Envie o link + credenciais ao contratante.',
    });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_SHARE_CREATION_FAILED',
    });
  }
}

/**
 * GET /api/reports/[surveyId]/shares
 * Lista shares existentes da pesquisa (para o pesquisador gerenciar).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
  try {
    const ctx = await getSurveyAuthContext();
    if (!ctx) return apiError('Não autorizado', 401, correlationId);

    const admin = createAuditedSupabaseAdminClient('report-shares-list');
    const { data: shares, error } = await admin
      .from('report_shares')
      .select('id, share_token, access_type, contractor_email, contractor_name, expires_at, is_active, created_at, current_access_count')
      .eq('survey_id', params.surveyId)
      .eq('tenant_id', ctx.tenantId)
      .order('created_at', { ascending: false });

    if (error) return apiError(error.message, 500, correlationId);

    return apiSuccess({ shares });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_SHARES_LIST_FAILED',
    });
  }
}