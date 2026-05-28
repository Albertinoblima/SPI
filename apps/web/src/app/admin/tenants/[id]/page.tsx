'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    Users,
    FileText,
    AlertTriangle,
    Loader,
    ArrowLeft,
    Lock,
    Trash2,
    LogIn,
} from 'lucide-react';
import Link from 'next/link';

interface TenantDetails {
    tenant: {
        id: string;
        name: string;
        slug: string;
        status: 'active' | 'suspended' | 'trial';
        max_users: number;
        max_surveys: number;
        storage_limit_mb: number;
        created_at: string;
    };
    stats: {
        total_users: number;
        active_users: number;
        total_surveys: number;
        active_surveys: number;
        total_responses: number;
        recent_errors_7d: number;
    };
    users: Array<{
        id: string;
        full_name: string;
        email: string;
        role: string;
        is_active: boolean;
        created_at: string;
    }>;
    surveys: Array<{
        id: string;
        title: string;
        status: string;
        created_at: string;
        response_count: number;
    }>;
    recentErrors: Array<{
        id: string;
        error_code: string;
        error_message: string;
        severity: string;
        created_at: string;
    }>;
    health?: {
        critical_24h: number;
        high_24h: number;
        medium_24h: number;
        has_recent_issues: boolean;
    };
}

export default function TenantDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const tenantId = params.id as string;

    const [data, setData] = useState<TenantDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [newStatus, setNewStatus] = useState<string | null>(null);

    const fetchTenant = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/admin/tenants/${tenantId}`);

            if (!response.ok) {
                throw new Error('Erro ao buscar tenant');
            }

            const { data: tenantData } = await response.json();
            // Garantir arrays mesmo que a API retorne null
            tenantData.users = tenantData.users ?? [];
            tenantData.surveys = tenantData.surveys ?? [];
            tenantData.recentErrors = tenantData.recentErrors ?? [];
            setData(tenantData);
            setNewStatus(tenantData.tenant.status);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [tenantId]);

    useEffect(() => {
        fetchTenant();
    }, [fetchTenant]);

    const handleStatusChange = async () => {
        if (!newStatus || newStatus === data?.tenant.status) return;

        try {
            setUpdating(true);
            const response = await fetch(`/api/admin/tenants/${tenantId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || 'Erro ao atualizar tenant');
            }

            setData((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    tenant: { ...prev.tenant, status: newStatus as any },
                };
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao atualizar');
        } finally {
            setUpdating(false);
        }
    };

    const handleDeleteTenant = async () => {
        if (!data || deleting) return;

        const confirmation = window.prompt(
            `Para confirmar, digite o slug da empresa: ${data.tenant.slug}`
        );

        if (confirmation === null) return;

        if (confirmation.trim() !== data.tenant.slug) {
            setError('Confirmação inválida. Digite exatamente o slug da empresa para excluir.');
            return;
        }

        try {
            setDeleting(true);
            setError(null);

            const response = await fetch(`/api/admin/tenants/${tenantId}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                const body = await response.json().catch(() => ({}));
                throw new Error(body.error || 'Erro ao excluir empresa');
            }

            router.push('/admin/tenants');
            router.refresh();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao excluir empresa');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-4">
                <Link
                    href="/admin/tenants"
                    className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar
                </Link>
                <div className="p-4 rounded-lg bg-red-900/20 border border-red-700/30 text-red-200">
                    <AlertTriangle className="w-5 h-5 inline mr-2" />
                    {error || 'Erro ao carregar dados'}
                </div>
            </div>
        );
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'text-green-400 bg-green-900/30';
            case 'suspended':
                return 'text-red-400 bg-red-900/30';
            case 'trial':
                return 'text-blue-400 bg-blue-900/30';
            default:
                return 'text-slate-400 bg-slate-800';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <Link
                        href="/admin/tenants"
                        className="inline-flex items-center gap-2 text-slate-400 hover:text-white mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar
                    </Link>
                    <h1 className="text-3xl font-bold text-white">
                        {data.tenant.name}
                    </h1>
                    <p className="text-slate-400 mt-1">{data.tenant.slug}</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className={`px-4 py-2 rounded-lg font-semibold ${getStatusColor(data.tenant.status)}`}>
                        {data.tenant.status === 'active' ? 'Ativo' : data.tenant.status === 'suspended' ? 'Suspenso' : 'Trial'}
                    </div>

                    {/* Fase 1 - Impersonation Button */}
                    <button
                        onClick={async () => {
                            if (!confirm(`Deseja realmente entrar como "${data.tenant.name}"?`)) return;
                            try {
                                const res = await fetch('/api/admin/impersonate', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action: 'start', tenantId: data.tenant.id }),
                                });
                                if (res.ok) {
                                    window.location.href = '/dashboard';
                                } else {
                                    alert('Falha ao iniciar impersonation');
                                }
                            } catch (err) {
                                console.error('Impersonate failed', err);
                                alert('Erro ao conectar com o servidor');
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg font-medium transition text-sm"
                        title="Assumir identidade desta empresa para suporte"
                    >
                        <LogIn className="w-4 h-4" />
                        Entrar como esta empresa
                    </button>
                </div>
            </div>

            {/* Saúde & Incidentes - Destaque (Fase 2 + fechamento de loop) */}
            {data.health && (data.health.critical_24h > 0 || data.health.high_24h > 0 || data.health.medium_24h > 0) && (
                <div className="p-5 rounded-xl border border-red-700/50 bg-red-950/30">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                            <span className="font-semibold text-red-300">Saúde & Incidentes (últimas 24h)</span>
                        </div>
                        <Link
                            href={`/admin/system/errors?tenant_id=${data.tenant.id}`}
                            className="text-xs px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-medium transition"
                        >
                            Ver todos os erros →
                        </Link>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {data.health.critical_24h > 0 && (
                            <div className="px-4 py-2 rounded-lg bg-red-500/20 text-red-200 text-sm font-medium border border-red-500/30">
                                {data.health.critical_24h} crítico{data.health.critical_24h > 1 ? 's' : ''}
                            </div>
                        )}
                        {data.health.high_24h > 0 && (
                            <div className="px-4 py-2 rounded-lg bg-orange-500/20 text-orange-200 text-sm font-medium border border-orange-500/30">
                                {data.health.high_24h} alto{data.health.high_24h > 1 ? 's' : ''}
                            </div>
                        )}
                        {data.health.medium_24h > 0 && (
                            <div className="px-4 py-2 rounded-lg bg-yellow-500/20 text-yellow-200 text-sm font-medium border border-yellow-500/30">
                                {data.health.medium_24h} médio{data.health.medium_24h > 1 ? 's' : ''}
                            </div>
                        )}
                    </div>

                    <p className="text-xs text-red-300/80 mt-2">
                        Esta empresa tem incidentes recentes. Use o botão "Entrar como" acima ou resolva em massa na página de erros.
                    </p>
                </div>
            )}

            {/* Quick Actions Bar */}
            <div className="flex flex-wrap gap-2">
                <Link
                    href={`/admin/system/errors?tenant_id=${data.tenant.id}`}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-medium transition"
                >
                    <AlertTriangle className="w-4 h-4" /> Ver todos os erros desta empresa
                </Link>
                <button
                    onClick={() => {
                        // Reutiliza a lógica de impersonation já existente no header
                        document.querySelector<HTMLButtonElement>('button[title*="Assumir identidade"]')?.click();
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition"
                >
                    <LogIn className="w-4 h-4" /> Entrar como esta empresa
                </button>
            </div>

            {/* Status Control */}
            <div className="p-6 rounded-lg bg-slate-800 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    Controle de Status
                </h2>

                <div className="flex items-end gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-slate-300 mb-2">
                            Status da Empresa
                        </label>
                        <select
                            title="Selecionar status da empresa"
                            aria-label="Selecionar status da empresa"
                            value={newStatus || ''}
                            onChange={(e) => setNewStatus(e.target.value)}
                            disabled={updating}
                            className="w-full px-4 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-blue-500 disabled:opacity-50"
                        >
                            <option value="active">Ativo</option>
                            <option value="suspended">Suspenso</option>
                            <option value="trial">Trial</option>
                        </select>
                    </div>

                    <button
                        onClick={handleStatusChange}
                        disabled={updating || newStatus === data.tenant.status}
                        className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        {updating ? 'Atualizando...' : 'Atualizar'}
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 rounded-lg bg-slate-800 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Usuários Ativos</p>
                            <p className="text-3xl font-bold text-white mt-2">
                                {data.stats.active_users}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Limite: {data.tenant.max_users}
                            </p>
                        </div>
                        <Users className="w-8 h-8 text-blue-500 opacity-50" />
                    </div>
                </div>

                <div className="p-6 rounded-lg bg-slate-800 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Pesquisas Ativas</p>
                            <p className="text-3xl font-bold text-white mt-2">
                                {data.stats.active_surveys}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Limite: {data.tenant.max_surveys}
                            </p>
                        </div>
                        <FileText className="w-8 h-8 text-purple-500 opacity-50" />
                    </div>
                </div>

                <div className="p-6 rounded-lg bg-slate-800 border border-slate-700">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-slate-400 text-sm">Total de Respostas</p>
                            <p className="text-3xl font-bold text-white mt-2">
                                {data.stats.total_responses}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                Coletadas
                            </p>
                        </div>
                        <FileText className="w-8 h-8 text-green-500 opacity-50" />
                    </div>
                </div>
            </div>

            {/* Users Section */}
            <div className="p-6 rounded-lg bg-slate-800 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">
                    Usuários ({data.users.length})
                </h2>

                <div className="space-y-2">
                    {data.users.slice(0, 5).map((user) => (
                        <div
                            key={user.id}
                            className="flex items-center justify-between p-3 rounded bg-slate-700/30 border border-slate-600/30"
                        >
                            <div>
                                <p className="font-medium text-white">
                                    {user.full_name}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {user.email}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs px-2 py-1 rounded bg-blue-500/20 text-blue-300">
                                    {user.role}
                                </span>
                                {!user.is_active && (
                                    <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300">
                                        Inativo
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {data.users.length > 5 && (
                    <p className="text-sm text-slate-400 mt-4">
                        +{data.users.length - 5} usuários adicionais
                    </p>
                )}
            </div>

            {/* Recent Surveys */}
            <div className="p-6 rounded-lg bg-slate-800 border border-slate-700">
                <h2 className="text-lg font-semibold text-white mb-4">
                    Pesquisas Recentes ({data.surveys.length})
                </h2>

                <div className="space-y-2">
                    {data.surveys.slice(0, 5).map((survey) => (
                        <div
                            key={survey.id}
                            className="flex items-center justify-between p-3 rounded bg-slate-700/30 border border-slate-600/30"
                        >
                            <div>
                                <p className="font-medium text-white">
                                    {survey.title}
                                </p>
                                <p className="text-xs text-slate-400">
                                    {survey.response_count} respostas
                                </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded ${survey.status === 'active' ? 'bg-green-500/20 text-green-300' : 'bg-slate-500/20 text-slate-300'}`}>
                                {survey.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Módulos em Uso (Fase 2 - Visibilidade de Adoção) */}
            <div className="p-5 rounded-xl border border-emerald-700/40 bg-emerald-950/20">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-emerald-300 text-sm">Módulos em Uso por esta empresa</h3>
                    <Link href="/admin/system/stats" className="text-xs text-emerald-400 hover:underline">Ver visão geral →</Link>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Planejamento de Pesquisa</span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Coleta de Campo</span>
                    <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">Relatórios e Exportação</span>
                    {data.health?.has_recent_issues && (
                        <span className="px-3 py-1 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">Com incidentes recentes</span>
                    )}
                </div>
            </div>

            {/* Recent Errors - Fortalecido (Fase 2) */}
            {data.recentErrors.length > 0 && (
                <div className="p-6 rounded-xl border border-red-700/50 bg-red-950/20">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold text-red-300 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Erros Recentes ({data.recentErrors.length})
                        </h2>
                        <div className="flex gap-2">
                            <Link
                                href={`/admin/system/errors?tenant_id=${data.tenant.id}`}
                                className="text-xs px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium transition"
                            >
                                Ver todos →
                            </Link>
                            <button
                                onClick={async () => {
                                    if (!confirm(`Marcar todos os ${data.recentErrors.length} erros recentes como resolvidos?`)) return;
                                    try {
                                        const res = await fetch('/api/admin/system/errors', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                action: 'mark_resolved',
                                                errorIds: data.recentErrors.map(e => e.id),
                                                resolved: true,
                                            }),
                                        });
                                        if (res.ok) {
                                            alert('Erros marcados como resolvidos!');
                                            fetchTenant();
                                        } else {
                                            console.error('Failed to bulk resolve errors');
                                            alert('Falha ao resolver erros em massa');
                                        }
                                    } catch (err) {
                                        console.error('Failed to mark errors as resolved', err);
                                    }
                                        alert('Erro de conexão');
                                    }
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition"
                            >
                                Marcar todos como resolvidos
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {data.recentErrors.slice(0, 5).map((error) => {
                            const sevColor = error.severity === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : error.severity === 'high' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                                : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';

                            return (
                                <div key={error.id} className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${sevColor}`}>
                                                {error.severity.toUpperCase()}
                                            </span>
                                            <span className="font-mono text-sm text-white">{error.error_code}</span>
                                        </div>
                                        <p className="text-sm text-red-200/90 mt-1 line-clamp-2">{error.error_message}</p>
                                    </div>
                                    <span className="text-[10px] text-slate-500 whitespace-nowrap ml-4">
                                        {new Date(error.created_at).toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Danger Zone */}
            <div className="p-6 rounded-lg bg-red-950/20 border border-red-800/40">
                <h2 className="text-lg font-semibold text-red-300 mb-2 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    Zona de Perigo
                </h2>
                <p className="text-sm text-red-200/90 mb-4">
                    A exclusão remove a empresa das listagens (soft delete) e não pode ser desfeita pela interface.
                </p>
                <button
                    onClick={handleDeleteTenant}
                    disabled={deleting || updating}
                    className="px-6 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {deleting ? 'Excluindo...' : 'Excluir Empresa'}
                </button>
            </div>
        </div>
    );
}
