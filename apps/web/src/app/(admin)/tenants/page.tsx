'use client';

import { useState, useEffect } from 'react';
import {
    Building2,
    Search,
    Filter,
    MoreVertical,
    Loader,
    AlertTriangle,
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

    useEffect(() => {
        fetchTenants();
    }, [statusFilter, page]);

    const fetchTenants = async () => {
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
    };

    const filteredTenants = tenants.filter((tenant) =>
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                                        Empresa
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                                        Status
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                                        Usuários
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                                        Pesquisas
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-slate-300">
                                        Respostas
                                    </th>
                                    <th className="px-6 py-4 text-right text-sm font-semibold text-slate-300">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTenants.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
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
                                            <td className="px-6 py-4">
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
                                                <Link
                                                    href={`/admin/tenants/${tenant.id}`}
                                                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Summary */}
                    <div className="text-sm text-slate-400">
                        Mostrando {filteredTenants.length} de {tenants.length} empresas
                    </div>
                </>
            )}
        </div>
    );
}
