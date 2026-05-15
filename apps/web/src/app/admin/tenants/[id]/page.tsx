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

                <div className={`px-4 py-2 rounded-lg font-semibold ${getStatusColor(data.tenant.status)}`}>
                    {data.tenant.status === 'active' ? 'Ativo' : data.tenant.status === 'suspended' ? 'Suspenso' : 'Trial'}
                </div>
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

            {/* Recent Errors */}
            {data.recentErrors.length > 0 && (
                <div className="p-6 rounded-lg bg-red-900/20 border border-red-700/30">
                    <h2 className="text-lg font-semibold text-red-300 mb-4 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        Erros Recentes (7 dias)
                    </h2>

                    <div className="space-y-2">
                        {data.recentErrors.slice(0, 3).map((error) => (
                            <div
                                key={error.id}
                                className="p-3 rounded bg-red-500/10 border border-red-500/20"
                            >
                                <p className="text-sm font-medium text-red-200">
                                    {error.error_code}
                                </p>
                                <p className="text-xs text-red-300 mt-1">
                                    {error.error_message}
                                </p>
                            </div>
                        ))}
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
