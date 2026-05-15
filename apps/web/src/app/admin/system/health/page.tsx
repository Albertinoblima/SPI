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

interface HealthData {
    vercel: {
        deployments: VercelDeployment[];
        apiError: string | null;
    };
    supabase: {
        systemStats: SystemStats | null;
        errorCounts24h: Record<string, number>;
        recentErrors: ErrorLog[];
        analytics: AnalyticsRow[];
    };
}

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

    const latestDeploy = data?.vercel.deployments[0];
    const errorCounts = data?.supabase.errorCounts24h ?? {};
    const totalErrors24h = Object.values(errorCounts).reduce((a, b) => a + b, 0);

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Activity className="w-6 h-6 text-emerald-400" />
                        Saúde do Sistema
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">
                        Monitoramento em tempo real — Vercel + Supabase
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {lastRefresh && (
                        <span className="text-xs text-gray-500">
                            Atualizado às {lastRefresh.toLocaleTimeString('pt-BR')}
                        </span>
                    )}
                    <button
                        onClick={fetchHealth}
                        disabled={loading}
                        className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
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

                {/* Supabase DB */}
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
                            <p className="text-gray-500 text-xs mt-1">
                                {data?.supabase.systemStats?.total_responses?.toLocaleString('pt-BR') ?? '—'} respostas
                            </p>
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

            {/* Deployments Vercel */}
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
                    ) : data?.vercel.deployments.length === 0 ? (
                        <p className="px-5 py-6 text-gray-500 text-sm text-center">
                            Nenhum deployment encontrado
                        </p>
                    ) : (
                        data?.vercel.deployments.map((dep) => {
                            const cfg = STATE_CONFIG[dep.state] ?? { label: dep.state, color: 'text-gray-400', icon: null };
                            return (
                                <div key={dep.id} className="px-5 py-3 flex items-center gap-4">
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
                                            <p className="text-xs text-red-400 mt-0.5 truncate">{dep.errorMessage}</p>
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

            {/* Erros Recentes Supabase */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
                    <h2 className="text-white font-semibold flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        Erros Recentes — Supabase
                    </h2>
                    <a href="/admin/system/errors" className="text-xs text-gray-500 hover:text-gray-300">
                        Ver todos →
                    </a>
                </div>
                <div className="divide-y divide-gray-800">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="px-5 py-3 flex gap-4 animate-pulse">
                                <div className="w-16 h-4 bg-gray-800 rounded" />
                                <div className="flex-1 h-4 bg-gray-800 rounded" />
                            </div>
                        ))
                    ) : data?.supabase.recentErrors.length === 0 ? (
                        <p className="px-5 py-6 text-gray-500 text-sm text-center flex items-center justify-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            Nenhum erro registrado
                        </p>
                    ) : (
                        data?.supabase.recentErrors.map((err) => (
                            <div key={err.id} className="px-5 py-3 flex items-start gap-4">
                                <span className={`text-xs px-2 py-0.5 rounded border shrink-0 mt-0.5 ${SEVERITY_COLORS[err.severity] ?? ''}`}>
                                    {err.severity}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-xs text-gray-500">{err.error_code}</span>
                                        <span className="text-sm text-gray-300 truncate">{err.error_message}</span>
                                    </div>
                                    {err.http_path && (
                                        <p className="text-xs text-gray-600 mt-0.5">{err.http_path}</p>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 shrink-0">
                                    {new Date(err.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </div>
                                {err.resolved && (
                                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

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
