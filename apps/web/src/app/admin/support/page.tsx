'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    MessageSquare,
    Search,
    AlertTriangle,
    Loader,
    ChevronRight,
    Megaphone,
    Send,
    Building2,
    CheckCircle2,
} from 'lucide-react';
import Link from 'next/link';

interface SupportTicket {
    id: string;
    tenant_id: string;
    title: string;
    status: 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    response_count: number;
    created_at: string;
    updated_at: string;
    users?: {
        full_name: string;
        email: string;
    };
    tenants?: {
        name: string;
    };
}

export default function SupportPage() {
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('open');
    const [page, setPage] = useState(1);

    // Broadcast
    const [showBroadcast, setShowBroadcast] = useState(false);
    const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
    const [broadcastTitle, setBroadcastTitle] = useState('');
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'tenant'>('all');
    const [broadcastTenantId, setBroadcastTenantId] = useState('');
    const [broadcastSending, setBroadcastSending] = useState(false);
    const [broadcastSuccess, setBroadcastSuccess] = useState(false);
    const [broadcastError, setBroadcastError] = useState<string | null>(null);

    const fetchTickets = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(page),
                status: statusFilter,
            });

            const response = await fetch(`/api/admin/support/tickets?${params}`);

            if (!response.ok) {
                throw new Error('Erro ao buscar tickets');
            }

            const { data } = await response.json();
            setTickets(data.tickets);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    // Carregar tenants para o broadcast
    useEffect(() => {
        fetch('/api/admin/tenants/list')
            .then((r) => r.json())
            .then(({ data }) => setTenants(data?.tenants ?? []))
            .catch(() => { });
    }, []);

    async function sendBroadcast() {
        if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
            setBroadcastError('Preencha título e mensagem');
            return;
        }
        setBroadcastSending(true);
        setBroadcastError(null);
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: broadcastTitle,
                    message: broadcastMessage,
                    target_type: broadcastTarget,
                    tenant_id: broadcastTarget === 'tenant' ? broadcastTenantId : undefined,
                }),
            });
            if (!res.ok) {
                const { error: e } = await res.json();
                throw new Error(e ?? 'Erro ao enviar');
            }
            setBroadcastSuccess(true);
            setBroadcastTitle('');
            setBroadcastMessage('');
            setBroadcastTarget('all');
            setBroadcastTenantId('');
            setTimeout(() => setBroadcastSuccess(false), 4000);
        } catch (err) {
            setBroadcastError(err instanceof Error ? err.message : 'Erro ao enviar');
        } finally {
            setBroadcastSending(false);
        }
    }

    const filteredTickets = tickets.filter(
        (ticket) =>
            ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            ticket.users?.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'open':
                return 'bg-red-500/20 text-red-300';
            case 'in_progress':
                return 'bg-yellow-500/20 text-yellow-300';
            case 'waiting_user':
                return 'bg-blue-500/20 text-blue-300';
            case 'resolved':
                return 'bg-green-500/20 text-green-300';
            case 'closed':
                return 'bg-slate-500/20 text-slate-300';
            default:
                return 'bg-slate-500/20 text-slate-300';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent':
                return 'text-red-400';
            case 'high':
                return 'text-orange-400';
            case 'medium':
                return 'text-yellow-400';
            case 'low':
                return 'text-blue-400';
            default:
                return 'text-slate-400';
        }
    };

    const getStatusLabel = (status: string) => {
        const labels: Record<string, string> = {
            open: 'Aberto',
            in_progress: 'Em Andamento',
            waiting_user: 'Aguardando Usuário',
            resolved: 'Resolvido',
            closed: 'Fechado',
        };
        return labels[status] || status;
    };

    const getPriorityLabel = (priority: string) => {
        const labels: Record<string, string> = {
            urgent: 'Urgente',
            high: 'Alto',
            medium: 'Médio',
            low: 'Baixo',
        };
        return labels[priority] || priority;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins}min atrás`;
        if (diffHours < 24) return `${diffHours}h atrás`;
        if (diffDays < 7) return `${diffDays}d atrás`;

        return date.toLocaleDateString('pt-BR');
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">
                        Suporte e Tickets
                    </h1>
                    <p className="text-slate-400">
                        Gerencie tickets de suporte dos clientes
                    </p>
                </div>
                <button
                    onClick={() => setShowBroadcast((v) => !v)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition
                        ${showBroadcast
                            ? 'bg-purple-600 text-white'
                            : 'bg-slate-700 text-slate-200 hover:bg-purple-600 hover:text-white'}`}
                >
                    <Megaphone className="w-4 h-4" />
                    Enviar Mensagem às Empresas
                </button>
            </div>

            {/* Painel Broadcast */}
            {showBroadcast && (
                <div className="p-6 rounded-xl bg-slate-800 border border-purple-500/30 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="w-5 h-5 text-purple-400" />
                        <h2 className="font-semibold text-white">Enviar notificação para empresas</h2>
                    </div>

                    {broadcastSuccess && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300 text-sm">
                            <CheckCircle2 className="w-4 h-4" />
                            Notificação enviada com sucesso!
                        </div>
                    )}
                    {broadcastError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/30 border border-red-700/40 text-red-300 text-sm">
                            <AlertTriangle className="w-4 h-4" />
                            {broadcastError}
                        </div>
                    )}

                    {/* Destinatário */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setBroadcastTarget('all')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition
                                ${broadcastTarget === 'all'
                                    ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                                    : 'border-slate-600 text-slate-400 hover:border-purple-500/50'}`}
                        >
                            <Megaphone className="w-4 h-4" />
                            Todas as empresas
                        </button>
                        <button
                            onClick={() => setBroadcastTarget('tenant')}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition
                                ${broadcastTarget === 'tenant'
                                    ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                                    : 'border-slate-600 text-slate-400 hover:border-blue-500/50'}`}
                        >
                            <Building2 className="w-4 h-4" />
                            Empresa específica
                        </button>
                    </div>

                    {broadcastTarget === 'tenant' && (
                        <select
                            aria-label="Selecionar empresa"
                            value={broadcastTenantId}
                            onChange={(e) => setBroadcastTenantId(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:border-purple-500"
                        >
                            <option value="">Selecione uma empresa…</option>
                            {tenants.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    )}

                    <input
                        type="text"
                        placeholder="Título da notificação"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500"
                    />

                    <textarea
                        placeholder="Escreva a mensagem para as empresas…"
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />

                    <div className="flex justify-end">
                        <button
                            onClick={sendBroadcast}
                            disabled={broadcastSending || !broadcastTitle.trim() || !broadcastMessage.trim()}
                            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition"
                        >
                            {broadcastSending ? (
                                <Loader className="w-4 h-4 animate-spin" />
                            ) : (
                                <Send className="w-4 h-4" />
                            )}
                            {broadcastSending ? 'Enviando…' : 'Enviar Notificação'}
                        </button>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
                <div className="flex-1 min-w-64">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Buscar por título ou email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <select
                    title="Filtrar tickets por status"
                    aria-label="Filtrar tickets por status"
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-blue-500"
                >
                    <option value="all">Todos</option>
                    <option value="open">Abertos</option>
                    <option value="in_progress">Em Andamento</option>
                    <option value="waiting_user">Aguardando</option>
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
                    {/* Tickets List */}
                    <div className="space-y-3">
                        {filteredTickets.length === 0 ? (
                            <div className="p-12 rounded-lg bg-slate-800 border border-slate-700 text-center">
                                <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                                <p className="text-slate-300">Nenhum ticket encontrado</p>
                            </div>
                        ) : (
                            filteredTickets.map((ticket) => (
                                <Link
                                    key={ticket.id}
                                    href={`/admin/support/${ticket.id}`}
                                    className="block p-4 rounded-lg bg-slate-800 border border-slate-700 hover:border-blue-500/30 hover:bg-slate-800/70 transition"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <h3 className="font-semibold text-white truncate">
                                                    {ticket.title}
                                                </h3>
                                                <span
                                                    className={`text-xs px-2 py-1 rounded whitespace-nowrap ${getStatusColor(ticket.status)}`}
                                                >
                                                    {getStatusLabel(ticket.status)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4 text-sm text-slate-400">
                                                <span>{ticket.users?.email}</span>
                                                {ticket.tenants && (
                                                    <>
                                                        <span>•</span>
                                                        <span>{ticket.tenants.name}</span>
                                                    </>
                                                )}
                                                <span>•</span>
                                                <span className={getPriorityColor(ticket.priority)}>
                                                    {getPriorityLabel(ticket.priority)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                                                <span>{ticket.response_count} respostas</span>
                                                <span>•</span>
                                                <span>{formatDate(ticket.updated_at)}</span>
                                            </div>
                                        </div>

                                        <ChevronRight className="w-5 h-5 text-slate-500 flex-shrink-0" />
                                    </div>
                                </Link>
                            ))
                        )}
                    </div>

                    {/* Summary */}
                    <div className="text-sm text-slate-400">
                        Mostrando {filteredTickets.length} de {tickets.length} tickets
                    </div>
                </>
            )}
        </div>
    );
}
