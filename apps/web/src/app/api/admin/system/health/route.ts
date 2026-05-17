// GET /api/admin/system/health - Saúde do sistema: Vercel + Supabase + GitHub
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
    handleApiUnhandledError,
} from '@/lib/api-middleware';

interface GitHubCommit {
    sha: string;
    message: string;
    author: string;
    date: string;
    url: string;
}

interface GitHubWorkflowRun {
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    branch: string;
    event: string;
    createdAt: string;
    updatedAt: string;
    url: string;
    durationMs: number | null;
}

async function fetchGitHubData(): Promise<{
    commits: GitHubCommit[];
    workflowRuns: GitHubWorkflowRun[];
    error?: string;
}> {
    const token = process.env.GITHUB_TOKEN;
    const repo = process.env.GITHUB_REPO; // e.g. "Albertinoblima/SPI"

    if (!token || !repo) {
        return { commits: [], workflowRuns: [], error: 'GITHUB_TOKEN ou GITHUB_REPO não configurados' };
    }

    const headers: HeadersInit = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
    };

    try {
        const [commitsRes, runsRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${repo}/commits?per_page=5`, {
                headers,
                next: { revalidate: 60 },
            }),
            fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=5`, {
                headers,
                next: { revalidate: 60 },
            }),
        ]);

        if (!commitsRes.ok && !runsRes.ok) {
            return { commits: [], workflowRuns: [], error: `GitHub API retornou ${commitsRes.status}` };
        }

        const [commitsJson, runsJson] = await Promise.all([
            commitsRes.ok ? commitsRes.json() : [],
            runsRes.ok ? runsRes.json() : { workflow_runs: [] },
        ]);

        const commits: GitHubCommit[] = (Array.isArray(commitsJson) ? commitsJson : []).map((c: any) => ({
            sha: c.sha?.slice(0, 7) ?? '',
            message: c.commit?.message?.split('\n')[0] ?? '',
            author: c.commit?.author?.name ?? '',
            date: c.commit?.author?.date ?? '',
            url: c.html_url ?? '',
        }));

        const runs: GitHubWorkflowRun[] = (runsJson.workflow_runs ?? []).map((r: any) => ({
            id: r.id,
            name: r.name ?? '',
            status: r.status ?? '',
            conclusion: r.conclusion ?? null,
            branch: r.head_branch ?? '',
            event: r.event ?? '',
            createdAt: r.created_at ?? '',
            updatedAt: r.updated_at ?? '',
            url: r.html_url ?? '',
            durationMs:
                r.created_at && r.updated_at
                    ? new Date(r.updated_at).getTime() - new Date(r.created_at).getTime()
                    : null,
        }));

        return { commits, workflowRuns: runs };
    } catch {
        return { commits: [], workflowRuns: [], error: 'Falha ao conectar à API do GitHub' };
    }
}

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

    try {
        // Buscar dados em paralelo
        const [
            vercelResult,
            githubResult,
            { data: recentErrors },
            { data: analytics },
            { data: systemStats },
        ] = await Promise.all([
            fetchVercelDeployments(),
            fetchGitHubData(),
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
            github: {
                commits: githubResult.commits,
                workflowRuns: githubResult.workflowRuns,
                apiError: githubResult.error ?? null,
                repo: process.env.GITHUB_REPO ?? null,
            },
            supabase: {
                systemStats,
                errorCounts24h: severityCount,
                recentErrors: recentErrors ?? [],
                analytics: analytics ?? [],
            },
        });
    } catch (error) {
        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            userId: auth.user.id,
            metadata: { route: '/api/admin/system/health' },
        });
    }
}
