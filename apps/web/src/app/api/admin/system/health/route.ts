// GET /api/admin/system/health - Saúde do sistema: Vercel + Supabase
import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin, apiError, apiSuccess } from '@/lib/api-middleware';

interface VercelDeployment {
    uid: string;
    name: string;
    state: string;
    createdAt: number;
    buildingAt?: number;
    ready?: number;
    source?: string;
    meta?: { githubCommitMessage?: string; githubCommitSha?: string };
    errorMessage?: string | null;
}

async function fetchVercelDeployments(): Promise<{
    deployments: VercelDeployment[];
    error?: string;
}> {
    const token = process.env.VERCEL_TOKEN;
    const projectId = process.env.VERCEL_PROJECT_ID;

    if (!token || !projectId) {
        return { deployments: [], error: 'VERCEL_TOKEN ou VERCEL_PROJECT_ID não configurados' };
    }

    try {
        const params = new URLSearchParams({ projectId, limit: '10', target: 'production' });
        const teamId = process.env.VERCEL_TEAM_ID;
        if (teamId) params.append('teamId', teamId);

        const res = await fetch(`https://api.vercel.com/v6/deployments?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
            next: { revalidate: 60 },
        });

        if (!res.ok) {
            return { deployments: [], error: `API Vercel retornou ${res.status}` };
        }

        const json = await res.json();
        return { deployments: json.deployments ?? [] };
    } catch {
        return { deployments: [], error: 'Falha ao conectar à API da Vercel' };
    }
}

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Nao autorizado', auth.status ?? 401);
    }

    // Buscar dados em paralelo
    const [
        vercelResult,
        { data: errorSummary },
        { data: recentErrors },
        { data: analytics },
        { data: systemStats },
    ] = await Promise.all([
        fetchVercelDeployments(),
        auth.supabase.rpc('get_error_summary').maybeSingle().catch(() => ({ data: null })) as Promise<{ data: null }>,
        auth.supabase
            .from('error_logs')
            .select('id, error_code, error_message, severity, http_path, created_at, resolved, tenant_id')
            .order('created_at', { ascending: false })
            .limit(10),
        auth.supabase
            .from('system_analytics')
            .select('*')
            .order('date_recorded', { ascending: false })
            .limit(7),
        auth.supabase.from('vw_system_stats').select('*').single(),
    ]);

    // Contagem de erros por severidade (últimas 24h)
    const { data: errorCounts } = await auth.supabase
        .from('error_logs')
        .select('severity')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .eq('resolved', false);

    const severityCount = (errorCounts ?? []).reduce<Record<string, number>>((acc, row) => {
        acc[row.severity] = (acc[row.severity] ?? 0) + 1;
        return acc;
    }, {});

    return apiSuccess({
        vercel: {
            deployments: vercelResult.deployments.map((d) => ({
                id: d.uid,
                state: d.state,
                createdAt: d.createdAt,
                buildingAt: d.buildingAt,
                readyAt: d.ready,
                commitMessage: d.meta?.githubCommitMessage ?? null,
                commitSha: d.meta?.githubCommitSha?.slice(0, 7) ?? null,
                errorMessage: d.errorMessage ?? null,
                durationMs:
                    d.ready && d.buildingAt ? d.ready - d.buildingAt : null,
            })),
            apiError: vercelResult.error ?? null,
        },
        supabase: {
            systemStats,
            errorCounts24h: severityCount,
            recentErrors: recentErrors ?? [],
            analytics: analytics ?? [],
        },
    });
}
