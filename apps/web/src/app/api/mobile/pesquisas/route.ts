import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils/src/supabase/admin-client';
import { getMobileAuthContext } from '@/lib/mobile/auth';
import { buildCorrelationId } from '@/lib/monitoring/error-monitor';

export async function GET(request: NextRequest) {
    const correlationId = buildCorrelationId(request.headers.get('x-correlation-id') ?? undefined);
    try {
        const ctx = await getMobileAuthContext(request);
        if (!ctx) return apiError('Nao autenticado', 401, correlationId);

        const admin = createAuditedSupabaseAdminClient('mobile-pesquisas');
        const { data: rows, error } = await admin
            .from('survey_team_members')
            .select('survey_id, role, surveys!inner(id, title, description, status, published_at, started_at, ended_at, updated_at)')
            .eq('tenant_id', ctx.tenantId)
            .eq('user_id', ctx.userId)
            .eq('is_active', true)
            .eq('surveys.status', 'published')
            .order('created_at', { ascending: false });

        if (error) return apiError(`Falha ao carregar pesquisas: ${error.message}`, 500, correlationId);

        const surveys = (rows ?? []).map((row) => {
            const surveyRaw = Array.isArray(row.surveys) ? row.surveys[0] : row.surveys;
            const survey = surveyRaw && typeof surveyRaw === 'object'
                ? (surveyRaw as Record<string, unknown>)
                : {};

            return {
                ...survey,
                team_role: row.role,
            };
        });

        return apiSuccess({ surveys });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/mobile/pesquisas', operation: 'GET' },
        });
    }
}

