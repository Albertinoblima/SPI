import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { getSurveyAuthContext } from '@/lib/surveys/auth-context';
import { publicReportAccessService } from '@/lib/reports/PublicReportAccessService';

/**
 * POST /api/reports/[surveyId]/shares
 * Cria um novo link de compartilhamento protegido para contratante.
 * Requer autenticação do tenant (pesquisador/admin).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { surveyId: string } }
) {
  try {
    const ctx = await getSurveyAuthContext(request, params.surveyId);
    if (!ctx) return apiError('Não autorizado', 401);

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
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ''}/reports/public/${share.share_token}`,
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
  try {
    const ctx = await getSurveyAuthContext(request, params.surveyId);
    if (!ctx) return apiError('Não autorizado', 401);

    const { data: shares, error } = await ctx.supabase
      .from('report_shares')
      .select('id, share_token, access_type, contractor_email, contractor_name, expires_at, is_active, created_at, current_access_count')
      .eq('survey_id', params.surveyId)
      .order('created_at', { ascending: false });

    if (error) return apiError(error.message, 500);

    return apiSuccess({ shares });
  } catch (error) {
    return handleApiUnhandledError(request, error, {
      errorCode: 'REPORT_SHARES_LIST_FAILED',
    });
  }
}