'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle,
    XCircle,
    Clock,
    AlertTriangle,
    RefreshCw,
    ExternalLink,
    Activity,
    Server,
    Zap,
    GitCommit,
    Database,
    TrendingUp,
    Github,
    GitBranch,
    GitPullRequest,
    ShieldAlert,
    Building2,
    MessageSquare,
    BookOpen,
} from 'lucide-react';

interface VercelDeployment {
    id: string;
    state: string;
    createdAt: number;
    buildingAt?: number;
    readyAt?: number;
    commitMessage: string | null;
    commitSha: string | null;
    errorMessage: string | null;
    durationMs: number | null;
}

interface ErrorLog {
    id: string;
    error_code: string;
    error_message: string;
    severity: string;
    http_path: string | null;
    created_at: string;
    resolved: boolean;
}

interface SystemStats {
    total_tenants: number;
    active_tenants: number;
    total_users: number;
    active_users: number;
    total_surveys: number;
    total_responses: number;
    errors_24h: number;
}

interface AnalyticsRow {
    date_recorded: string;
    total_surveys: number;
    total_responses: number;
    active_users: number;
}

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

interface HealthData {
    vercel: {
        deployments: VercelDeployment[];
        apiError: string | null;
    };
    github: {
        commits: GitHubCommit[];
        workflowRuns: GitHubWorkflowRun[];
        apiError: string | null;
        repo: string | null;
    };
    supabase: {
        systemStats: SystemStats | null;
        errorCounts24h: Record<string, number>;
        recentErrors: ErrorLog[];
        analytics: AnalyticsRow[];
        activeImpersonations?: any[];
    };
    integrationStatus?: {
        github: { configured: boolean; label: string; description: string; impact?: string | null };
        vercel: { configured: boolean; label: string; description: string; impact?: string | null };
        supabase: { configured: boolean; label: string; description: string; impact?: string | null };
    };
}

const SUPABASE_PROJECT_REF = 'icnclqtwtcbrmuxpujwb';

const WORKFLOW_CONCLUSION_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    success: { label: 'Sucesso', color: 'text-green-400', icon: <CheckCircle className="w-4 h-4" /> },
    failure: { label: 'Falha', color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
    cancelled: { label: 'Cancelado', color: 'text-gray-400', icon: <XCircle className="w-4 h-4" /> },
    skipped: { label: 'Ignorado', color: 'text-gray-500', icon: <Clock className="w-4 h-4" /> },
    timed_out: { label: 'Timeout', color: 'text-orange-400', icon: <AlertTriangle className="w-4 h-4" /> },
    action_required: { label: 'Ação Req.', color: 'text-yellow-400', icon: <AlertTriangle className="w-4 h-4" /> },
};

const WORKFLOW_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    completed: { label: 'Concluído', color: 'text-gray-400' },
    in_progress: { label: 'Em andamento', color: 'text-yellow-400' },
    queued: { label: 'Na fila', color: 'text-blue-400' },
    waiting: { label: 'Aguardando', color: 'text-blue-300' },
};

const STATE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    READY: { label: 'Publicado', color: 'text-green-400', icon: <CheckCircle className="w-4 h-4" /> },
    ERROR: { label: 'Erro', color: 'text-red-400', icon: <XCircle className="w-4 h-4" /> },
    BUILDING: { label: 'Compilando', color: 'text-yellow-400', icon: <Clock className="w-4 h-4 animate-spin" /> },
    INITIALIZING: { label: 'Iniciando', color: 'text-blue-400', icon: <Clock className="w-4 h-4" /> },
    CANCELED: { label: 'Cancelado', color: 'text-gray-400', icon: <XCircle className="w-4 h-4" /> },
};

const SEVERITY_COLORS: Record<string, string> = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function formatDuration(ms: number | null): string {
    if (!ms) return '—';
    const s = Math.round(ms / 1000);
    return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

function timeAgo(ts: number): string {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'agora';
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
}

export default function SystemHealthPage() {
    const [data, setData] = useState<HealthData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

    const fetchHealth = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch('/api/admin/system/health');
            if (!res.ok) throw new Error('Falha ao buscar dados de saúde');
            const json = await res.json();
            setData(json.data);
            setLastRefresh(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 60000);
        return () => clearInterval(interval);
    }, [fetchHealth]);

    const vercelDeployments = Array.isArray(data?.vercel?.deployments) ? data.vercel.deployments : [];
    const latestDeploy = vercelDeployments[0] ?? null;
    const errorCounts = data?.supabase?.errorCounts24h ?? {};
    const totalErrors24h = Object.values(errorCounts).reduce((a, b) => a + b, 0);
    const githubRepo = data?.github?.repo ?? 'Albertinoblima/SPI';

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-emerald-400" />
                        Saúde do Sistema
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Monitoramento em tempo real — GitHub + Vercel + Supabase
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Quick-access links */}
                    <a
                        href={`https://github.com/${githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm transition-colors border border-gray-700"
                    >
                        <Github className="w-4 h-4" />
                        GitHub
                        <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                    <a
                        href="https://vercel.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm transition-colors border border-gray-700"
                    >
                        <Zap className="w-4 h-4 text-black bg-white rounded-full p-0.5" />
                        Vercel
                        <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>
                    <a
                        href={`https://app.supabase.com/project/${SUPABASE_PROJECT_REF}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm transition-colors border border-gray-700"
                    >
                        <Database className="w-4 h-4 text-emerald-400" />
                        Supabase
                        <ExternalLink className="w-3 h-3 opacity-50" />
                    </a>

                    <div className="w-px h-6 bg-gray-700" />

                    {lastRefresh && (
                        <span className="text-xs text-gray-500">
                            {lastRefresh.toLocaleTimeString('pt-BR')}
                        </span>
                    )}
                    <button
                        onClick={fetchHealth}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50 border border-gray-700"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* System Health Overview - Fase 2 (High Value) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-semibold text-white">Visão Geral de Saúde</h3>
                        <p className="text-xs text-gray-500">Resumo executivo do sistema</p>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-bold ${totalErrors24h > 10 ? 'text-red-400' : totalErrors24h > 0 ? 'text-yellow-400' : 'text-emerald-400'}`}>
                            {totalErrors24h > 10 ? 'Atenção' : totalErrors24h > 0 ? 'Normal' : 'Saudável'}
                        </div>
                        <div className="text-xs text-gray-500">Status atual</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <div className="text-gray-400 text-xs">Empresas Ativas</div>
                        <div className="text-xl font-semibold text-white">{data?.supabase.systemStats?.active_tenants ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Respostas Totais</div>
                        <div className="text-xl font-semibold text-white">{data?.supabase.systemStats?.total_responses?.toLocaleString('pt-BR') ?? '—'}</div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Erros Críticos 24h</div>
                        <div className={`text-xl font-semibold ${totalErrors24h > 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                            {totalErrors24h}
                        </div>
                    </div>
                    <div>
                        <div className="text-gray-400 text-xs">Impersonations Ativas</div>
                        <div className="text-xl font-semibold text-amber-400">
                            {data?.supabase.activeImpersonations?.length ?? 0}
                        </div>
                    </div>
                </div>
            </div>

            {/* Ações Rápidas - Fase 2 Operational Value */}
            <div className="flex flex-wrap gap-2">
                <a href="/admin/system/errors" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm flex items-center gap-2 transition">
                    <AlertTriangle className="w-4 h-4" /> Ver Erros Detalhados
                </a>
                <a href="/admin/tenants" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm flex items-center gap-2 transition">
                    <Building2 className="w-4 h-4" /> Gerenciar Empresas
                </a>
                <a href="/admin/support" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm flex items-center gap-2 transition">
                    <MessageSquare className="w-4 h-4" /> Atender Suporte
                </a>
                <button 
                    onClick={fetchHealth} 
                    disabled={loading}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-sm flex items-center gap-2 transition disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar Tudo
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Vercel Status */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-sm">Vercel — Último Deploy</span>
                    </div>
                    {loading ? (
                        <div className="h-8 bg-gray-800 rounded animate-pulse" />
                    ) : latestDeploy ? (
                        <div>
                            <div className={`flex items-center gap-2 font-semibold ${STATE_CONFIG[latestDeploy.state]?.color ?? 'text-gray-300'}`}>
                                {STATE_CONFIG[latestDeploy.state]?.icon}
                                {STATE_CONFIG[latestDeploy.state]?.label ?? latestDeploy.state}
                            </div>
                            <p className="text-gray-500 text-xs mt-1">{timeAgo(latestDeploy.createdAt)}</p>
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">Sem dados</p>
                    )}
                </div>

                {/* Supabase DB - Enhanced */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-sm">Supabase — Banco</span>
                    </div>
                    {loading ? (
                        <div className="h-8 bg-gray-800 rounded animate-pulse" />
                    ) : (
                        <div>
                            <div className="flex items-center gap-2 text-green-400 font-semibold">
                                <CheckCircle className="w-4 h-4" />
                                Operacional
                            </div>
                            <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                <div>{data?.supabase.systemStats?.total_responses?.toLocaleString('pt-BR') ?? '—'} respostas totais</div>
                                <div>{data?.supabase.systemStats?.active_users ?? '—'} usuários ativos</div>
                                <div className="text-emerald-400">Tendência positiva nos últimos 7 dias</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Erros 24h */}
                <div className={`border rounded-xl p-4 ${totalErrors24h > 0 ? 'bg-red-500/5 border-red-500/20' : 'bg-gray-900 border-gray-800'}`}>
                    <div className="flex items-center gap-2 mb-3">
                        <AlertTriangle className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-sm">Erros — Últimas 24h</span>
                    </div>
                    {loading ? (
                        <div className="h-8 bg-gray-800 rounded animate-pulse" />
                    ) : (
                        <div>
                            <div className={`text-2xl font-bold ${totalErrors24h > 0 ? 'text-red-400' : 'text-green-400'}`}>
                                {totalErrors24h}
                            </div>
                            <div className="flex gap-2 mt-1 flex-wrap">
                                {Object.entries(errorCounts).map(([sev, count]) => (
                                    <span key={sev} className={`text-xs px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[sev] ?? ''}`}>
                                        {sev}: {count}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Usuários ativos */}
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-400 text-sm">Usuários Ativos</span>
                    </div>
                    {loading ? (
                        <div className="h-8 bg-gray-800 rounded animate-pulse" />
                    ) : (
                        <div>
                            <div className="text-2xl font-bold text-white">
                                {data?.supabase.systemStats?.active_users ?? '—'}
                            </div>
                            <p className="text-gray-500 text-xs mt-1">
                                de {data?.supabase.systemStats?.total_users ?? '—'} total
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* System Alerts Summary - Fase 2 (Actionable) */}
            {(totalErrors24h > 5 || latestDeploy?.state === 'ERROR' || (data?.github.workflowRuns ?? []).some(r => r.conclusion === 'failure')) && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                            <span className="font-semibold text-red-400">Alertas do Sistema</span>
                        </div>
                        <a href="/admin/system/errors" className="text-xs px-3 py-1 bg-red-600 hover:bg-red-500 rounded text-white transition">
                            Ver todos os erros →
                        </a>
                    </div>
                    <div className="text-sm text-red-200 space-y-1">
                        {totalErrors24h > 5 && (
                            <div className="flex items-center justify-between">
                                <span>• Alto volume de erros nas últimas 24h ({totalErrors24h})</span>
                                <a href="/admin/system/errors?severity=critical" className="text-xs underline">Investigar</a>
                            </div>
                        )}
                        {latestDeploy?.state === 'ERROR' && (
                            <div className="flex items-center justify-between">
                                <span>• Último deploy no Vercel falhou</span>
                                <a href="https://vercel.com/dashboard" target="_blank" className="text-xs underline">Abrir Vercel</a>
                            </div>
                        )}
                        {(data?.github.workflowRuns ?? []).some(r => r.conclusion === 'failure') && (
                            <div>• Workflows GitHub com falhas recentes — ver seção abaixo</div>
                        )}
                    </div>
                </div>
            )}

            {/* Métricas de Adoção da Base de Conhecimento (Passo 2 - Evolução do Suporte) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-emerald-400" />
                            Adoção da Base de Conhecimento
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Eventos HELP_TOPIC_MARKED_HELPFUL (especialmente categoria "Fluxo Ponta a Ponta")</p>
                    </div>
                    <a 
                        href="/admin/system/errors?code=HELP_TOPIC_MARKED_HELPFUL" 
                        className="text-[11px] px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-300 rounded border border-emerald-700 flex items-center gap-1"
                    >
                        Ver eventos completos <ExternalLink className="w-3 h-3" />
                    </a>
                </div>
                <div className="text-xs text-gray-400">
                    Cada vez que um usuário clica "Isso resolveu meu problema" nos artigos (incluindo os 6 novos do fluxo ponta a ponta), um evento de baixa severidade é registrado no sistema de monitoramento central.
                    Use o filtro por <span className="font-mono text-emerald-400">HELP_TOPIC_MARKED_HELPFUL</span> + metadados (category, context, isPontaAPonta) para medir adoção real dos guias.
                </div>
            </div>

            {/* Status das Integrações Externas - Fase 2 (detecção honesta e acionável) */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Zap className="w-4 h-4 text-amber-400" />
                            Status das Integrações Externas
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">Visibilidade real de GitHub, Vercel e camada interna Supabase</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700">Fase 2</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* GitHub */}
                    {(() => {
                        const s = data?.integrationStatus?.github;
                        const hasError = !!data?.github?.apiError;
                        const isOk = s?.configured ?? !hasError;
                        return (
                            <div className={`p-3.5 rounded-lg border transition ${isOk ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-amber-950/30 border-amber-800/50'}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Github className="w-4 h-4 text-white" />
                                    <span className="font-semibold text-white">GitHub</span>
                                    <span className={`ml-auto text-[10px] px-2 py-px rounded-full border ${isOk ? 'text-emerald-400 border-emerald-700 bg-emerald-950/60' : 'text-amber-400 border-amber-700 bg-amber-950/60'}`}>
                                        {s?.label ?? (isOk ? 'Operacional' : 'Limitado')}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-300 leading-snug">
                                    {s?.description ?? (isOk ? 'Conectado — dados de CI/CD visíveis' : 'Tokens ausentes — commits e workflows ocultos')}
                                </div>
                                {s?.impact && <div className="text-[10px] text-amber-400/80 mt-1.5">{s.impact}</div>}
                            </div>
                        );
                    })()}

                    {/* Vercel */}
                    {(() => {
                        const s = data?.integrationStatus?.vercel;
                        const hasError = !!data?.vercel?.apiError;
                        const isOk = s?.configured ?? !hasError;
                        return (
                            <div className={`p-3.5 rounded-lg border transition ${isOk ? 'bg-emerald-950/40 border-emerald-800/60' : 'bg-amber-950/30 border-amber-800/50'}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Zap className="w-4 h-4 text-white" />
                                    <span className="font-semibold text-white">Vercel</span>
                                    <span className={`ml-auto text-[10px] px-2 py-px rounded-full border ${isOk ? 'text-emerald-400 border-emerald-700 bg-emerald-950/60' : 'text-amber-400 border-amber-700 bg-amber-950/60'}`}>
                                        {s?.label ?? (isOk ? 'Operacional' : 'Limitado')}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-300 leading-snug">
                                    {s?.description ?? (isOk ? 'Conectado — deploys de produção visíveis' : 'Tokens ausentes — histórico de deploys oculto')}
                                </div>
                                {s?.impact && <div className="text-[10px] text-amber-400/80 mt-1.5">{s.impact}</div>}
                            </div>
                        );
                    })()}

                    {/* Supabase Interno */}
                    {(() => {
                        const s = data?.integrationStatus?.supabase;
                        return (
                            <div className="p-3.5 rounded-lg border bg-emerald-950/40 border-emerald-800/60">
                                <div className="flex items-center gap-2 mb-1.5">
                                    <Database className="w-4 h-4 text-emerald-400" />
                                    <span className="font-semibold text-white">Supabase (Interno)</span>
                                    <span className="ml-auto text-[10px] px-2 py-px rounded-full border text-emerald-400 border-emerald-700 bg-emerald-950/60">
                                        {s?.label ?? 'Sempre ON'}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-300 leading-snug">
                                    {s?.description ?? 'RLS + views nativas — estatísticas, erros e sessões de impersonation sempre disponíveis para o God Mode'}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                <div className="mt-3 text-[10px] text-gray-500 flex items-center gap-2">
                    <span>Variáveis de ambiente controlam o nível de visibilidade.</span>
                    <a href="https://vercel.com/docs/concepts/projects/environment-variables" target="_blank" className="underline hover:text-gray-400">Docs Vercel</a>
                    <span>•</span>
                    <a href="https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token" target="_blank" className="underline hover:text-gray-400">Criar PAT GitHub</a>
                </div>
            </div>

            {/* GitHub Monitoring */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                        <Github className="w-4 h-4 text-white" />
                        GitHub — Monitoramento
                    </h2>
                    <a
                        href={`https://github.com/${githubRepo}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                    >
                        {githubRepo} <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                {data?.github.apiError && (
                    <div className="px-5 py-3 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {data.github.apiError}
                        {data.github.apiError.includes('GITHUB_TOKEN') && (
                            <span className="text-gray-500 ml-1">— Adicione GITHUB_TOKEN e GITHUB_REPO nas variáveis de ambiente e faça rebuild.</span>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">
                    {/* Commits recentes */}
                    <div>
                        <p className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800 flex items-center gap-2">
                            <GitCommit className="w-3.5 h-3.5" />
                            Commits Recentes
                        </p>
                        <div className="divide-y divide-gray-800">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="px-5 py-3 flex gap-3 animate-pulse">
                                        <div className="w-12 h-4 bg-gray-800 rounded" />
                                        <div className="flex-1 h-4 bg-gray-800 rounded" />
                                    </div>
                                ))
                            ) : (data?.github.commits ?? []).length === 0 ? (
                                <p className="px-5 py-6 text-gray-500 text-sm text-center">Nenhum commit encontrado</p>
                            ) : (
                                (data?.github.commits ?? []).map((c) => (
                                    <a
                                        key={c.sha}
                                        href={c.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-start gap-3 px-5 py-3 hover:bg-gray-800/40 transition group"
                                    >
                                        <span className="font-mono text-xs text-blue-400 shrink-0 mt-0.5 group-hover:underline">
                                            {c.sha}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-200 truncate">{c.message}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">
                                                {c.author} · {new Date(c.date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </a>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Workflow Runs - Enhanced */}
                    <div>
                        <p className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-800 flex items-center gap-2">
                            <GitPullRequest className="w-3.5 h-3.5" />
                            Workflow Runs
                        </p>
                        <div className="divide-y divide-gray-800">
                            {loading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <div key={i} className="px-5 py-3 flex gap-3 animate-pulse">
                                        <div className="w-16 h-4 bg-gray-800 rounded" />
                                        <div className="flex-1 h-4 bg-gray-800 rounded" />
                                    </div>
                                ))
                            ) : (data?.github.workflowRuns ?? []).length === 0 ? (
                                <p className="px-5 py-6 text-gray-500 text-sm text-center">Nenhum workflow encontrado</p>
                            ) : (
                                (data?.github.workflowRuns ?? []).map((run) => {
                                    const conclusionCfg = run.conclusion
                                        ? WORKFLOW_CONCLUSION_CONFIG[run.conclusion]
                                        : null;
                                    const statusCfg = WORKFLOW_STATUS_CONFIG[run.status];
                                    const isFailed = run.conclusion === 'failure' || run.conclusion === 'timed_out';
                                    
                                    return (
                                        <a
                                            key={run.id}
                                            href={run.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={`flex items-center gap-3 px-5 py-3 transition ${isFailed ? 'bg-red-950/30 hover:bg-red-950/50' : 'hover:bg-gray-800/40'}`}
                                        >
                                            <div className={`flex items-center gap-1 text-sm font-medium w-28 shrink-0 ${conclusionCfg?.color ?? statusCfg?.color ?? 'text-gray-400'}`}>
                                                {conclusionCfg?.icon ?? null}
                                                {conclusionCfg?.label ?? statusCfg?.label ?? run.status}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-gray-200 truncate">{run.name}</p>
                                                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                    <GitBranch className="w-3 h-3" />{run.branch}
                                                    {run.durationMs && (
                                                        <span className="ml-1">&bull; {formatDuration(run.durationMs)}</span>
                                                    )}
                                                </p>
                                            </div>
                                            <span className="text-xs text-gray-500 shrink-0">
                                                {new Date(run.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </a>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Deployments Vercel - Enhanced for Fase 2 */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                        <Server className="w-4 h-4 text-purple-400" />
                        Deployments Vercel
                    </h2>
                    <a
                        href="https://vercel.com/dashboard"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                    >
                        Abrir Vercel <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                {data?.vercel.apiError && (
                    <div className="px-5 py-3 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-400 text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {data.vercel.apiError}
                        {data.vercel.apiError.includes('VERCEL_TOKEN') && (
                            <span className="text-gray-500 ml-1">— Adicione VERCEL_TOKEN e VERCEL_PROJECT_ID nas variáveis de ambiente.</span>
                        )}
                    </div>
                )}

                <div className="divide-y divide-gray-800">
                    {loading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="px-5 py-3 flex gap-4 animate-pulse">
                                <div className="w-20 h-4 bg-gray-800 rounded" />
                                <div className="flex-1 h-4 bg-gray-800 rounded" />
                                <div className="w-16 h-4 bg-gray-800 rounded" />
                            </div>
                        ))
                    ) : vercelDeployments.length === 0 ? (
                        <p className="px-5 py-6 text-gray-500 text-sm text-center">
                            Nenhum deployment encontrado
                        </p>
                    ) : (
                        vercelDeployments.map((dep) => {
                            const cfg = STATE_CONFIG[dep.state] ?? { label: dep.state, color: 'text-gray-400', icon: null };
                            const isProblematic = dep.state === 'ERROR' || dep.errorMessage;
                            
                            return (
                                <div key={dep.id} className={`px-5 py-3 flex items-center gap-4 ${isProblematic ? 'bg-red-950/20' : ''}`}>
                                    <div className={`flex items-center gap-1.5 text-sm font-medium w-28 shrink-0 ${cfg.color}`}>
                                        {cfg.icon}
                                        {cfg.label}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {dep.commitSha && (
                                                <span className="font-mono text-xs text-gray-500 flex items-center gap-1">
                                                    <GitCommit className="w-3 h-3" />
                                                    {dep.commitSha}
                                                </span>
                                            )}
                                            <span className="text-sm text-gray-300 truncate">
                                                {dep.commitMessage ?? '—'}
                                            </span>
                                        </div>
                                        {dep.errorMessage && (
                                            <p className="text-xs text-red-400 mt-0.5 truncate font-medium">
                                                {dep.errorMessage}
                                            </p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <div className="text-xs text-gray-500">{timeAgo(dep.createdAt)}</div>
                                        {dep.durationMs && (
                                            <div className="text-xs text-gray-600">{formatDuration(dep.durationMs)}</div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Active Impersonations - Fase 2 Operational Value */}
            {data?.supabase?.activeImpersonations && data.supabase.activeImpersonations.length > 0 && (
                <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4">
                    <h3 className="text-amber-400 font-semibold flex items-center gap-2 mb-3">
                        <ShieldAlert className="w-5 h-5" />
                        Sessões de Impersonation Ativas ({data.supabase.activeImpersonations.length})
                    </h3>
                    <div className="space-y-2">
                        {data.supabase.activeImpersonations.map((imp: any) => (
                            <div key={imp.id} className="flex justify-between items-center bg-slate-800/60 p-3 rounded text-sm">
                                <div>
                                    <span className="font-medium text-white">{imp.users?.full_name || imp.users?.email}</span>
                                    <span className="text-slate-400"> → </span>
                                    <span className="text-amber-300 font-medium">{imp.tenants?.name}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="text-xs text-slate-500">
                                        Desde {new Date(imp.started_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <a 
                                        href={`/admin/tenants/${imp.target_tenant_id}`}
                                        className="text-xs px-2 py-1 bg-amber-600 hover:bg-amber-500 rounded text-white transition"
                                    >
                                        Ver Tenant
                                    </a>
                                </div>
                            </div>
                        ))}
                    </div>
                    <p className="text-[10px] text-amber-400/70 mt-2">Estas sessões aparecem automaticamente no banner global para o administrador.</p>
                </div>
            )}

            {/* Recent Critical Errors Preview - Fase 2 Operational Value */}
            {data?.supabase?.recentErrors && data.supabase.recentErrors.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                        <h2 className="text-white font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-400" />
                            Erros Críticos Recentes
                        </h2>
                        <a href="/admin/system/errors" className="text-xs text-gray-500 hover:text-gray-300">
                            Ver todos os erros →
                        </a>
                    </div>
                    <div className="divide-y divide-gray-800">
                        {data.supabase.recentErrors.slice(0, 5).map((err: any) => (
                            <div key={err.id} className="px-5 py-3 flex items-start gap-3 text-sm hover:bg-gray-800/40">
                                <span className={`text-xs px-2 py-0.5 rounded border shrink-0 mt-0.5 ${SEVERITY_COLORS[err.severity] ?? ''}`}>
                                    {err.severity}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="font-mono text-xs text-gray-500">{err.error_code}</div>
                                    <div className="text-gray-300 truncate">{err.error_message}</div>
                                </div>
                                <div className="text-xs text-gray-500 shrink-0 whitespace-nowrap">
                                    {new Date(err.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}



            {/* Analytics Supabase (7 dias) */}
            {!loading && (data?.supabase.analytics?.length ?? 0) > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl">
                    <div className="px-5 py-4 border-b border-gray-800">
                        <h2 className="text-white font-semibold flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-400" />
                            Analytics — Últimos 7 dias
                        </h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-gray-500 text-xs border-b border-gray-800">
                                    <th className="text-left px-5 py-3">Data</th>
                                    <th className="text-right px-5 py-3">Pesquisas</th>
                                    <th className="text-right px-5 py-3">Respostas</th>
                                    <th className="text-right px-5 py-3">Usuários Ativos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {data?.supabase.analytics.map((row) => (
                                    <tr key={row.date_recorded} className="hover:bg-gray-800/40">
                                        <td className="px-5 py-3 text-gray-400">
                                            {new Date(row.date_recorded).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-5 py-3 text-right text-white">{row.total_surveys}</td>
                                        <td className="px-5 py-3 text-right text-white">{row.total_responses}</td>
                                        <td className="px-5 py-3 text-right text-white">{row.active_users}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
