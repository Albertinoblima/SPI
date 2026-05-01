'use client';

import { useState, useEffect } from 'react';
import {
    Shield,
    Search,
    AlertTriangle,
    Loader,
    ChevronDown,
} from 'lucide-react';

interface AuditLog {
    id: string;
    user_id: string | null;
    tenant_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    changes_description: string | null;
    is_critical: boolean;
    created_at: string;
    user?: {
        full_name: string;
        email: string;
    };
}

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionFilter, setActionFilter] = useState('all');
    const [criticalOnly, setCriticalOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        fetchLogs();
    }, [actionFilter, criticalOnly, page]);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(page),
            });

            if (actionFilter !== 'all') {
                params.append('action', actionFilter);
            }

            if (criticalOnly) {
                params.append('critical', 'true');
            }

            const response = await fetch(`/api/admin/audit-log?${params}`);

            if (!response.ok) {
                throw new Error('Erro ao buscar logs de auditoria');
            }

            const { data } = await response.json();
            setLogs(data.logs);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(
        (log) =>
            log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.user?.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.changes_description?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    };

    const getActionLabel = (action: string) => {
        const labels: Record<string, string> = {
            survey_created: 'Pesquisa Criada',
            survey_updated: 'Pesquisa Atualizada',
            survey_deleted: 'Pesquisa Deletada',
            user_created: 'Usuário Criado',
            user_updated: 'Usuário Atualizado',
            user_deleted: 'Usuário Deletado',
            tenant_updated: 'Tenant Atualizado',
            tenant_suspended: 'Tenant Suspenso',
            error_resolved: 'Erro Resolvido',
        };
        return labels[action] || action;
    };

    const getActionColor = (action: string) => {
        if (action.includes('deleted')) return 'text-red-400';
        if (action.includes('created')) return 'text-green-400';
        if (action.includes('suspended')) return 'text-red-400';
        return 'text-blue-400';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                    Log de Auditoria
                </h1>
                <p className="text-slate-400">
                    Histórico de todas as ações críticas do sistema
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por ação ou usuário..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <select
                    title="Filtrar logs por ação"
                    aria-label="Filtrar logs por ação"
                    value={actionFilter}
                    onChange={(e) => {
                        setActionFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="all">Todas as ações</option>
                    <option value="survey_created">Pesquisa Criada</option>
                    <option value="survey_updated">Pesquisa Atualizada</option>
                    <option value="user_created">Usuário Criado</option>
                    <option value="tenant_updated">Tenant Atualizado</option>
                </select>

                <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 cursor-pointer hover:border-blue-500/50 transition">
                    <input
                        type="checkbox"
                        checked={criticalOnly}
                        onChange={(e) => {
                            setCriticalOnly(e.target.checked);
                            setPage(1);
                        }}
                        className="rounded"
                    />
                    <span className="text-white text-sm">Críticas apenas</span>
                </label>
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
                    {/* Logs List */}
                    <div className="space-y-2">
                        {filteredLogs.length === 0 ? (
                            <div className="p-12 rounded-lg bg-slate-800 border border-slate-700 text-center">
                                <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-300">
                                    Nenhum log de auditoria encontrado
                                </p>
                            </div>
                        ) : (
                            filteredLogs.map((log) => (
                                <button
                                    key={log.id}
                                    onClick={() =>
                                        setExpandedId(
                                            expandedId === log.id ? null : log.id
                                        )
                                    }
                                    className={`w-full text-left p-4 rounded-lg border transition ${log.is_critical
                                            ? 'bg-red-900/10 border-red-700/30'
                                            : 'bg-slate-800 border-slate-700'
                                        } hover:border-blue-500/30`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span
                                                    className={`text-sm font-mono font-semibold ${getActionColor(log.action)}`}
                                                >
                                                    {getActionLabel(log.action)}
                                                </span>
                                                {log.is_critical && (
                                                    <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">
                                                        CRÍTICO
                                                    </span>
                                                )}
                                                <span className="text-xs px-2 py-1 rounded bg-slate-700/50 text-slate-300">
                                                    {log.entity_type}
                                                </span>
                                            </div>

                                            <p className="text-slate-300 text-sm mb-2">
                                                {log.changes_description}
                                            </p>

                                            <div className="flex items-center gap-4 text-xs text-slate-500">
                                                {log.user && (
                                                    <>
                                                        <span>{log.user.email}</span>
                                                        <span>•</span>
                                                    </>
                                                )}
                                                <span>{formatDate(log.created_at)}</span>
                                            </div>
                                        </div>

                                        <ChevronDown
                                            className={`w-4 h-4 text-slate-400 transition flex-shrink-0 ${expandedId === log.id ? 'rotate-180' : ''
                                                }`}
                                        />
                                    </div>

                                    {expandedId === log.id && (
                                        <div className="mt-4 pt-4 border-t border-slate-700">
                                            <div className="grid grid-cols-2 gap-4">
                                                {log.old_values && (
                                                    <div>
                                                        <p className="text-xs text-slate-400 mb-2">
                                                            Valores Anteriores
                                                        </p>
                                                        <pre className="text-xs bg-slate-900 p-2 rounded overflow-x-auto text-slate-300">
                                                            {JSON.stringify(
                                                                log.old_values,
                                                                null,
                                                                2
                                                            ).slice(0, 200)}
                                                            ...
                                                        </pre>
                                                    </div>
                                                )}
                                                {log.new_values && (
                                                    <div>
                                                        <p className="text-xs text-slate-400 mb-2">
                                                            Novos Valores
                                                        </p>
                                                        <pre className="text-xs bg-slate-900 p-2 rounded overflow-x-auto text-slate-300">
                                                            {JSON.stringify(
                                                                log.new_values,
                                                                null,
                                                                2
                                                            ).slice(0, 200)}
                                                            ...
                                                        </pre>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>

                    {/* Summary */}
                    <div className="text-sm text-slate-400">
                        Mostrando {filteredLogs.length} de {logs.length} eventos
                    </div>
                </>
            )}
        </div>
    );
}
