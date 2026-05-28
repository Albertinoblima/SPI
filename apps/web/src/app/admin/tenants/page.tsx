'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Building2,
    Search,
    MoreVertical,
    Loader,
    AlertTriangle,
    CheckSquare,
    Square,
    Play,
    Pause,
    Users,
} from 'lucide-react';
import Link from 'next/link';

interface Tenant {
    id: string;
    name: string;
    slug: string;
    status: 'active' | 'suspended' | 'trial';
    max_users: number;
    max_surveys: number;
    created_at: string;
    stats?: {
        total_users: number;
        active_users: number;
        total_surveys: number;
        active_surveys: number;
        total_responses: number;
    };
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);

    const fetchTenants = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(page),
            });

            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }

            const response = await fetch(`/api/admin/tenants?${params}`);

            if (!response.ok) {
                throw new Error('Erro ao buscar tenants');
            }

            const { data } = await response.json();
            setTenants(data.tenants);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchTenants();
    }, [fetchTenants]);

    // === Ações em Massa (Fase 1 God Mode) ===
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkMessage, setBulkMessage] = useState<string | null>(null);

    const filteredTenants = tenants.filter((tenant) =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const allVisibleSelected = filteredTenants.length > 0 && filteredTenants.every((t) => selected.has(t.id));
    const someVisibleSelected = filteredTenants.some((t) => selected.has(t.id));

    const toggleSelectAllVisible = () => {
        const newSelected = new Set(selected);
        if (allVisibleSelected) {
            filteredTenants.forEach((t) => newSelected.delete(t.id));
        } else {
            filteredTenants.forEach((t) => newSelected.add(t.id));
        }
        setSelected(newSelected);
        setBulkMessage(null);
    };

    const toggleSelect = (id: string) => {
        const newSelected = new Set(selected);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelected(newSelected);
        setBulkMessage(null);
    };

    const clearSelection = () => {
        setSelected(new Set());
        setBulkMessage(null);
    };

    const executeBulkStatusUpdate = async (newStatus: 'active' | 'suspended' | 'trial') => {
        if (selected.size === 0) return;

        const confirmMsg = `Alterar status de ${selected.size} empresa(s) para "${newStatus}"?\n\nEsta ação é registrada em auditoria.`;
        if (!confirm(confirmMsg)) return;

        setBulkLoading(true);
        setBulkMessage(null);

        try {
            const res = await fetch('/api/admin/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_status',
                    tenantIds: Array.from(selected),
                    status: newStatus,
                }),
            });

            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || 'Falha na operação em massa');
            }

            setBulkMessage(`${json.data?.message || 'Operação concluída'} • ${selected.size} afetada(s)`);
            clearSelection();
            await fetchTenants(); // refresh com dados atualizados
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Erro desconhecido';
            setBulkMessage(`Erro: ${msg}`);
        } finally {
            setBulkLoading(false);
        }
    };

    const getStatusBadge = (status: string) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
            active: { bg: 'bg-green-900/30', text: 'text-green-300', label: 'Ativo' },
            suspended: {
                bg: 'bg-red-900/30',
                text: 'text-red-300',
                label: 'Suspenso',
            },
            trial: { bg: 'bg-blue-900/30', text: 'text-blue-300', label: 'Trial' },
        };

        const badge = badges[status] || badges.active;

        return (
            <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
            >
                {badge.label}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                    Gerenciar Empresas
                </h1>
                <p className="text-slate-400">
                    Visualize e gerencie todas as empresas (tenants) cadastradas
                </p>
            </div>

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou slug..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <select
                    title="Filtrar empresas por status"
                    aria-label="Filtrar empresas por status"
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="all">Todos os status</option>
                    <option value="active">Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="trial">Trial</option>
                </select>
            </div>

            {/* Bulk Actions Toolbar - Fase 1 Ações em Massa (God Mode) */}
            {selected.size > 0 && (
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-amber-950/40 border border-amber-800/60">
                    <div className="flex items-center gap-2 text-amber-300 text-sm font-medium">
                        <Users className="w-4 h-4" />
                        {selected.size} empresa(s) selecionada(s)
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            onClick={() => executeBulkStatusUpdate('active')}
                            disabled={bulkLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs font-medium transition"
                        >
                            <Play className="w-3.5 h-3.5" /> Ativar
                        </button>
                        <button
                            onClick={() => executeBulkStatusUpdate('trial')}
                            disabled={bulkLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-medium transition"
                        >
                            Trial
                        </button>
                        <button
                            onClick={() => executeBulkStatusUpdate('suspended')}
                            disabled={bulkLoading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-medium transition"
                        >
                            <Pause className="w-3.5 h-3.5" /> Suspender
                        </button>

                        <div className="w-px h-5 bg-amber-800/70 mx-1" />

                        <button
                            onClick={clearSelection}
                            disabled={bulkLoading}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs text-slate-300 transition disabled:opacity-50"
                        >
                            Limpar seleção
                        </button>
                    </div>

                    {bulkLoading && <Loader className="w-4 h-4 animate-spin text-amber-400" />}
                </div>
            )}

            {/* Feedback de bulk */}
            {bulkMessage && (
                <div className={`text-sm px-4 py-2 rounded-lg border ${bulkMessage.startsWith('Erro') ? 'bg-red-900/20 border-red-700/40 text-red-300' : 'bg-emerald-900/20 border-emerald-700/40 text-emerald-300'}`}>
                    {bulkMessage}
                </div>
            )}

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
                    {/* Table */}
                    <div className="overflow-x-auto rounded-lg border border-slate-700">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-slate-700 bg-slate-800/50">
                                    <th className="px-3 py-4 w-10">
                                        <button
                                            onClick={toggleSelectAllVisible}
                                            title={allVisibleSelected ? 'Desmarcar todos visíveis' : 'Selecionar todos visíveis'}
                                            className="text-slate-400 hover:text-white transition"
                                        >
                                            {allVisibleSelected ? (
                                                <CheckSquare className="w-4 h-4 text-amber-400" />
                                            ) : someVisibleSelected ? (
                                                <div className="w-4 h-4 border border-amber-400 rounded bg-amber-500/20" />
                                            ) : (
                                                <Square className="w-4 h-4" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">
                                        Empresa
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">
                                        Status
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">
                                        Usuários
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">
                                        Pesquisas
                                    </th>
                                    <th className="px-4 py-4 text-left text-sm font-semibold text-slate-300">
                                        Respostas
                                    </th>
                                    <th className="px-4 py-4 text-right text-sm font-semibold text-slate-300">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                                            <p className="text-slate-400">
                                                Nenhuma empresa encontrada
                                            </p>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTenants.map((tenant) => (
                                        <tr
                                            key={tenant.id}
                                            className="border-b border-slate-700 hover:bg-slate-800/30 transition"
                                        >
                                            <td className="px-3 py-4">
                                                <button
                                                    onClick={() => toggleSelect(tenant.id)}
                                                    className="text-slate-400 hover:text-amber-400 transition"
                                                    title={selected.has(tenant.id) ? 'Remover seleção' : 'Selecionar'}
                                                >
                                                    {selected.has(tenant.id) ? (
                                                        <CheckSquare className="w-4 h-4 text-amber-400" />
                                                    ) : (
                                                        <Square className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-4 py-4">
                                                <Link
                                                    href={`/admin/tenants/${tenant.id}`}
                                                    className="font-medium text-white hover:text-blue-400"
                                                >
                                                    {tenant.name}
                                                </Link>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {tenant.slug}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getStatusBadge(tenant.status)}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                {tenant.stats?.active_users} / {tenant.max_users}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                {tenant.stats?.active_surveys} / {tenant.max_surveys}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-300">
                                                {tenant.stats?.total_responses || 0}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={async () => {
                                                            if (!confirm(`Deseja realmente entrar como "${tenant.name}"?`)) return;
                                                            try {
                                                                const res = await fetch('/api/admin/impersonate', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ action: 'start', tenantId: tenant.id }),
                                                                });
                                                                if (res.ok) {
                                                                    window.location.href = '/dashboard';
                                                                } else {
                                                                    alert('Falha ao iniciar impersonation');
                                                                }
                                                            } catch {
                                                                alert('Erro ao conectar com o servidor');
                                                            }
                                                        }}
                                                        className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium transition"
                                                        title="Entrar como esta empresa (Impersonation)"
                                                    >
                                                        Entrar como
                                                    </button>

                                                    <Link
                                                        href={`/admin/tenants/${tenant.id}`}
                                                        className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="text-sm text-slate-400 flex items-center justify-between">
                        <span>
                            Mostrando {filteredTenants.length} de {tenants.length} empresas
                        </span>
                        {selected.size > 0 && (
                            <span className="text-amber-400 font-medium">
                                {selected.size} selecionada(s) • use a barra de ações acima
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
