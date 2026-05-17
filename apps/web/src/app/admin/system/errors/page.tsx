'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    AlertTriangle,
    Search,
    CheckCircle,
    Loader,
    ChevronDown,
    Siren,
} from 'lucide-react';
import { getErrorCodeDefinition } from '@/lib/monitoring/error-codes';

interface ErrorLog {
    id: string;
    tenant_id: string | null;
    error_code: string;
    error_message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    http_path: string | null;
    http_status_code: number | null;
    resolved: boolean;
    created_at: string;
    resolved_at: string | null;
    correlation_id?: string | null;
    error_stack?: string | null;
}

interface ErrorApiResponse {
    data: {
        errors: ErrorLog[];
        summary: {
            openCount: number;
            criticalOpenCount: number;
        };
    };
}

export default function ErrorsPage() {
    const [errors, setErrors] = useState<ErrorLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [severityFilter, setSeverityFilter] = useState('all');
    const [resolvedFilter, setResolvedFilter] = useState('unresolved');
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [openCount, setOpenCount] = useState(0);
    const [criticalOpenCount, setCriticalOpenCount] = useState(0);

    const fetchErrors = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(page),
                search: searchTerm,
            });

            if (severityFilter !== 'all') {
                params.append('severity', severityFilter);
            }

            if (resolvedFilter !== 'all') {
                params.append('resolved', resolvedFilter === 'resolved' ? 'true' : 'false');
            }

            const response = await fetch(`/api/admin/system/errors?${params}`);

            if (!response.ok) {
                throw new Error('Erro ao buscar logs de erro');
            }

            const { data } = (await response.json()) as ErrorApiResponse;
            setErrors(data.errors);
            setOpenCount(data.summary?.openCount ?? 0);
            setCriticalOpenCount(data.summary?.criticalOpenCount ?? 0);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [page, severityFilter, resolvedFilter, searchTerm]);

    useEffect(() => {
        fetchErrors();
    }, [fetchErrors]);

    useEffect(() => {
        const interval = setInterval(fetchErrors, 10000);
        return () => clearInterval(interval);
    }, [fetchErrors]);

    const handleResolveError = async (errorId: string, currentResolved: boolean) => {
        try {
            const response = await fetch(`/api/admin/system/errors`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: errorId,
                    resolved: !currentResolved,
                }),
            });

            if (!response.ok) {
                throw new Error('Erro ao atualizar erro');
            }

            // Atualizar estado local
            setErrors((prev) =>
                prev.map((err) =>
                    err.id === errorId
                        ? {
                            ...err,
                            resolved: !currentResolved,
                            resolved_at: !currentResolved
                                ? new Date().toISOString()
                                : null,
                        }
                        : err
                )
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao atualizar');
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'critical':
                return 'bg-red-500/20 text-red-300 border-red-500/30';
            case 'high':
                return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
            case 'medium':
                return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
            case 'low':
                return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
            default:
                return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                    Monitoramento de Erros
                </h1>
                <p className="text-slate-400">
                    Visualize, priorize e resolva incidentes com rastreabilidade
                </p>
            </div>

            {criticalOpenCount > 0 && (
                <div className="p-4 rounded-lg bg-red-900/30 border border-red-700/50 text-red-100 flex items-start gap-3">
                    <Siren className="w-5 h-5 mt-0.5" />
                    <div>
                        <p className="font-semibold">Alerta imediato ativo</p>
                        <p className="text-sm text-red-200">
                            Existem {criticalOpenCount} incidentes críticos em aberto no sistema.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                    <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Incidentes em aberto</p>
                    <p className="text-2xl font-bold text-white">{openCount}</p>
                </div>
                <div className="rounded-lg border border-red-800/60 bg-red-950/30 p-4">
                    <p className="text-xs text-red-300 uppercase tracking-wide mb-1">Críticos em aberto</p>
                    <p className="text-2xl font-bold text-red-200">{criticalOpenCount}</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por código ou mensagem..."
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                setPage(1);
                            }}
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <select
                    title="Filtrar erros por severidade"
                    aria-label="Filtrar erros por severidade"
                    value={severityFilter}
                    onChange={(e) => {
                        setSeverityFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="all">Todas as severidades</option>
                    <option value="critical">Crítico</option>
                    <option value="high">Alto</option>
                    <option value="medium">Médio</option>
                    <option value="low">Baixo</option>
                </select>

                <select
                    title="Filtrar erros por resolução"
                    aria-label="Filtrar erros por resolução"
                    value={resolvedFilter}
                    onChange={(e) => {
                        setResolvedFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="all">Todos</option>
                    <option value="unresolved">Não resolvidos</option>
                    <option value="resolved">Resolvidos</option>
                </select>
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 rounded-lg bg-red-900/20 border border-red-700/30 text-red-200">
                    <AlertTriangle className="w-5 h-5 inline mr-2" />
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
            ) : (
                <>
                    {/* Errors List */}
                    <div className="space-y-3">
                        {errors.length === 0 ? (
                            <div className="p-12 rounded-lg bg-slate-800 border border-slate-700 text-center">
                                <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                                <p className="text-slate-300">Nenhum erro encontrado</p>
                            </div>
                        ) : (
                            errors.map((err) => {
                                const codeDefinition = getErrorCodeDefinition(err.error_code);

                                return (
                                    <div
                                        key={err.id}
                                        className={`rounded-lg border transition ${err.resolved
                                            ? 'bg-slate-800/50 border-slate-700'
                                            : 'bg-slate-800 border-slate-700'
                                            }`}
                                    >
                                        <button
                                            onClick={() =>
                                                setExpandedId(
                                                    expandedId === err.id ? null : err.id
                                                )
                                            }
                                            className="w-full text-left p-4 flex items-start justify-between hover:bg-slate-700/30 transition"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <span
                                                        className={`text-xs px-3 py-1 rounded-full border font-medium ${getSeverityColor(err.severity)}`}
                                                    >
                                                        {err.severity.toUpperCase()}
                                                    </span>
                                                    <code className="text-sm font-mono text-white">
                                                        {err.error_code}
                                                    </code>
                                                    {err.resolved && (
                                                        <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-300">
                                                            Resolvido
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-slate-300 text-sm">
                                                    {err.error_message}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    {codeDefinition.title}
                                                </p>
                                                <p className="text-xs text-slate-500 mt-2">
                                                    {formatDate(err.created_at)}
                                                </p>
                                            </div>

                                            <ChevronDown
                                                className={`w-4 h-4 text-slate-400 transition ${expandedId === err.id ? 'rotate-180' : ''
                                                    }`}
                                            />
                                        </button>

                                        {expandedId === err.id && (
                                            <div className="border-t border-slate-700 p-4 bg-slate-700/20">
                                                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                                    {err.http_path && (
                                                        <div>
                                                            <p className="text-slate-500 text-xs">
                                                                Caminho HTTP
                                                            </p>
                                                            <p className="text-slate-200 font-mono">
                                                                {err.http_path}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {err.http_status_code && (
                                                        <div>
                                                            <p className="text-slate-500 text-xs">
                                                                Status HTTP
                                                            </p>
                                                            <p className="text-slate-200 font-mono">
                                                                {err.http_status_code}
                                                            </p>
                                                        </div>
                                                    )}
                                                    {err.correlation_id && (
                                                        <div className="col-span-2">
                                                            <p className="text-slate-500 text-xs">
                                                                Correlation ID
                                                            </p>
                                                            <p className="text-slate-200 font-mono break-all">
                                                                {err.correlation_id}
                                                            </p>
                                                        </div>
                                                    )}
                                                    <div className="col-span-2">
                                                        <p className="text-slate-500 text-xs">Ação recomendada</p>
                                                        <ul className="text-slate-200 text-xs mt-1 space-y-1 list-disc list-inside">
                                                            {codeDefinition.resolutionSteps.map((step) => (
                                                                <li key={step}>{step}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() =>
                                                        handleResolveError(err.id, err.resolved)
                                                    }
                                                    className={`w-full px-4 py-2 rounded-lg font-medium transition ${err.resolved
                                                        ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                                                        : 'bg-green-600 hover:bg-green-700 text-white'
                                                        }`}
                                                >
                                                    {err.resolved
                                                        ? 'Marcar como Não Resolvido'
                                                        : 'Marcar como Resolvido'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
