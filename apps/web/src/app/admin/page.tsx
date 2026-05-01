'use client';

import { useState, useEffect } from 'react';
import {
    Building2,
    Users,
    FileText,
    TrendingUp,
    AlertTriangle,
    MessageSquare,
    Activity,
    Loader,
} from 'lucide-react';
import Link from 'next/link';

interface SystemStats {
    total_tenants: number;
    active_tenants: number;
    total_users: number;
    active_users: number;
    total_surveys: number;
    active_surveys: number;
    total_responses: number;
    errors_24h: number;
}

interface StatCard {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    color: string;
    link?: string;
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/admin/system/stats');

            if (!response.ok) {
                throw new Error('Erro ao buscar estatísticas');
            }

            const { data } = await response.json();
            setStats(data.stats);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="w-8 h-8 text-blue-500 animate-spin" />
                <span className="ml-2 text-slate-400">Carregando dados...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4 text-red-200">
                <AlertTriangle className="w-5 h-5 inline mr-2" />
                {error}
            </div>
        );
    }

    const statCards: StatCard[] = [
        {
            title: 'Empresas Ativas',
            value: stats?.active_tenants || 0,
            icon: <Building2 className="w-6 h-6" />,
            color: 'bg-blue-500/10 border-blue-500/30',
            link: '/admin/tenants',
        },
        {
            title: 'Usuários Ativos',
            value: stats?.active_users || 0,
            icon: <Users className="w-6 h-6" />,
            color: 'bg-green-500/10 border-green-500/30',
        },
        {
            title: 'Pesquisas Ativas',
            value: stats?.active_surveys || 0,
            icon: <FileText className="w-6 h-6" />,
            color: 'bg-purple-500/10 border-purple-500/30',
        },
        {
            title: 'Total de Respostas',
            value: (stats?.total_responses || 0).toLocaleString('pt-BR'),
            icon: <TrendingUp className="w-6 h-6" />,
            color: 'bg-orange-500/10 border-orange-500/30',
        },
        {
            title: 'Erros (24h)',
            value: stats?.errors_24h || 0,
            icon: <AlertTriangle className="w-6 h-6" />,
            color: 'bg-red-500/10 border-red-500/30',
            link: '/admin/system/errors',
        },
        {
            title: 'Total de Usuários',
            value: stats?.total_users || 0,
            icon: <Users className="w-6 h-6" />,
            color: 'bg-cyan-500/10 border-cyan-500/30',
        },
    ];

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                    Visão Geral do Sistema
                </h1>
                <p className="text-slate-400">
                    Monitoramento centralizado de todas as operações da plataforma
                </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {statCards.map((card, index) => (
                    <Link
                        key={index}
                        href={card.link || '#'}
                        className={`block p-6 rounded-lg border transition-all hover:shadow-lg ${card.link ? 'cursor-pointer' : ''
                            } ${card.color
                            } bg-slate-800/50 border-slate-700 hover:border-slate-600`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm text-slate-400 mb-1">
                                    {card.title}
                                </p>
                                <p className="text-3xl font-bold text-white">
                                    {card.value}
                                </p>
                            </div>
                            <div className="text-slate-500">{card.icon}</div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* Quick Actions */}
            <div>
                <h2 className="text-xl font-bold text-white mb-4">
                    Ações Rápidas
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/admin/tenants"
                        className="p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-blue-500/50 transition"
                    >
                        <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-blue-400" />
                            <div>
                                <p className="font-semibold text-white">
                                    Gerenciar Empresas
                                </p>
                                <p className="text-xs text-slate-400">
                                    Listar e configurar tenants
                                </p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/admin/system/errors"
                        className="p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-red-500/50 transition"
                    >
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-400" />
                            <div>
                                <p className="font-semibold text-white">
                                    Monitorar Erros
                                </p>
                                <p className="text-xs text-slate-400">
                                    Ver e resolver problemas
                                </p>
                            </div>
                        </div>
                    </Link>

                    <Link
                        href="/admin/support"
                        className="p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-green-500/50 transition"
                    >
                        <div className="flex items-center gap-3">
                            <MessageSquare className="w-5 h-5 text-green-400" />
                            <div>
                                <p className="font-semibold text-white">
                                    Suporte
                                </p>
                                <p className="text-xs text-slate-400">
                                    Atender tickets de suporte
                                </p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>

            {/* Info Alert */}
            <div className="p-4 rounded-lg bg-blue-900/20 border border-blue-700/30 text-blue-200">
                <div className="flex items-start gap-3">
                    <Activity className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold">Sistema Operacional</p>
                        <p className="text-sm mt-1">
                            Todos os serviços estão funcionando normalmente. Última sincronização: há
                            alguns minutos.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
