'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Loader, Send, CheckCircle2, AlertTriangle,
    User, Building2, Tag, Clock, MessageSquare,
} from 'lucide-react';
import Link from 'next/link';

interface Message {
    id: string;
    message: string;
    is_from_admin: boolean;
    created_at: string;
    users?: { full_name: string; email: string };
}

interface Ticket {
    id: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    created_at: string;
    updated_at: string;
    resolved_at?: string;
    response_count: number;
    users?: { full_name: string; email: string };
    tenants?: { name: string; slug: string };
    assigned_user?: { full_name: string; email: string };
}

const STATUS_OPTIONS = [
    { value: 'open', label: 'Aberto', color: 'bg-red-100 text-red-700' },
    { value: 'in_progress', label: 'Em andamento', color: 'bg-yellow-100 text-yellow-700' },
    { value: 'waiting_user', label: 'Aguardando cliente', color: 'bg-blue-100 text-blue-700' },
    { value: 'resolved', label: 'Resolvido', color: 'bg-green-100 text-green-700' },
    { value: 'closed', label: 'Fechado', color: 'bg-slate-100 text-slate-500' },
];

const PRIORITY_OPTIONS = [
    { value: 'low', label: '🔵 Baixa' },
    { value: 'medium', label: '🟡 Média' },
    { value: 'high', label: '🟠 Alta' },
    { value: 'urgent', label: '🔴 Urgente' },
];

const CATEGORY_LABEL: Record<string, string> = {
    general: 'Geral', technical: 'Técnico', billing: 'Financeiro',
    feature: 'Sugestão', bug: 'Bug',
};

function formatDate(d: string) {
    return new Date(d).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min atrás`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h atrás`;
    return formatDate(dateStr);
}

export default function AdminTicketDetailPage() {
    const params = useParams();
    const ticketId = params.id as string;

    const [ticket, setTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [replyMsg, setReplyMsg] = useState('');
    const [replyStatus, setReplyStatus] = useState('waiting_user');
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState('');

    const [editStatus, setEditStatus] = useState('');
    const [editPriority, setEditPriority] = useState('');
    const [updating, setUpdating] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/support/tickets/${ticketId}`);
            if (!res.ok) throw new Error('Ticket não encontrado');
            const { data } = await res.json();
            setTicket(data.ticket);
            setMessages(data.messages ?? []);
            setEditStatus(data.ticket.status);
            setEditPriority(data.ticket.priority);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar');
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Poll a cada 8s para novas mensagens
    useEffect(() => {
        const interval = setInterval(fetchData, 8000);
        return () => clearInterval(interval);
    }, [fetchData]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendReply = async () => {
        setSendError('');
        if (!replyMsg.trim()) return;
        setSending(true);
        try {
            const res = await fetch(`/api/admin/support/tickets/${ticketId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: replyMsg.trim(), status: replyStatus }),
            });
            if (!res.ok) {
                const err = await res.json();
                setSendError(err.error ?? 'Erro ao enviar');
                return;
            }
            setReplyMsg('');
            fetchData();
        } finally {
            setSending(false);
        }
    };

    const updateTicket = async () => {
        setUpdating(true);
        try {
            await fetch(`/api/admin/support/tickets/${ticketId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: editStatus, priority: editPriority }),
            });
            fetchData();
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-96">
            <Loader className="w-7 h-7 text-blue-400 animate-spin" />
        </div>
    );

    if (error || !ticket) return (
        <div className="space-y-4 p-6">
            <Link href="/admin/support" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
                <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
            <div className="p-4 rounded-xl bg-red-900/20 border border-red-700/30 text-red-300">
                <AlertTriangle className="w-4 h-4 inline mr-2" />
                {error ?? 'Ticket não encontrado'}
            </div>
        </div>
    );

    const statusInfo = STATUS_OPTIONS.find((s) => s.value === ticket.status);
    const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

    return (
        <div className="flex flex-col h-[calc(100vh-80px)]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-700/50 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    <Link href="/admin/support" className="text-slate-400 hover:text-white mt-1 shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div className="min-w-0">
                        <h1 className="text-xl font-bold text-white truncate">{ticket.title}</h1>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${statusInfo?.color ?? 'bg-slate-700 text-slate-300'}`}>
                                {statusInfo?.label ?? ticket.status}
                            </span>
                            <span className="text-xs text-slate-400">
                                {PRIORITY_OPTIONS.find((p) => p.value === ticket.priority)?.label}
                            </span>
                            <span className="text-xs text-slate-500">· {CATEGORY_LABEL[ticket.category] ?? ticket.category}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Chat */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Mensagens */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.is_from_admin ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${msg.is_from_admin
                                    ? 'bg-blue-600 text-white rounded-tr-sm'
                                    : 'bg-slate-700 text-slate-100 rounded-tl-sm'
                                    }`}>
                                    {!msg.is_from_admin && (
                                        <p className="text-xs font-semibold text-slate-400 mb-1">
                                            👤 {msg.users?.full_name ?? 'Cliente'}
                                        </p>
                                    )}
                                    {msg.is_from_admin && (
                                        <p className="text-xs font-semibold text-blue-200 mb-1">⚡ Suporte (você)</p>
                                    )}
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                    <p className={`text-xs mt-1.5 ${msg.is_from_admin ? 'text-blue-200' : 'text-slate-500'}`}>
                                        {formatTime(msg.created_at)}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {messages.length === 0 && (
                            <div className="flex items-center justify-center h-32 text-slate-500">
                                <MessageSquare className="w-6 h-6 mr-2" />
                                <span className="text-sm">Nenhuma mensagem</span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Reply box */}
                    <div className="border-t border-slate-700/50 p-4 space-y-3">
                        {sendError && (
                            <p className="text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2">{sendError}</p>
                        )}
                        <textarea
                            value={replyMsg}
                            onChange={(e) => setReplyMsg(e.target.value)}
                            placeholder="Escreva sua resposta ao cliente..."
                            rows={3}
                            disabled={isClosed}
                            className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500 resize-none disabled:opacity-50 placeholder:text-slate-500"
                            onKeyDown={(e) => { if (e.key === 'Enter' && e.ctrlKey) sendReply(); }}
                        />
                        <div className="flex items-center gap-3">
                            <select
                                value={replyStatus}
                                onChange={(e) => setReplyStatus(e.target.value)}
                                disabled={isClosed}
                                className="px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500 disabled:opacity-50"
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                            <button
                                onClick={sendReply}
                                disabled={sending || !replyMsg.trim() || isClosed}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-5 py-2 rounded-xl text-sm font-semibold transition"
                            >
                                {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {sending ? 'Enviando...' : 'Responder'}
                            </button>
                            <span className="text-xs text-slate-500">Ctrl+Enter para enviar</span>
                        </div>
                    </div>
                </div>

                {/* Sidebar de detalhes */}
                <div className="w-72 shrink-0 border-l border-slate-700/50 overflow-y-auto p-5 space-y-5">
                    {/* Informações do cliente */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Cliente</h3>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <User className="w-4 h-4 text-slate-500 shrink-0" />
                                <span className="truncate">{ticket.users?.full_name ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                                <span className="w-4 shrink-0" />
                                <span className="truncate text-xs">{ticket.users?.email ?? '—'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-300">
                                <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
                                <span className="truncate">{ticket.tenants?.name ?? '—'}</span>
                            </div>
                        </div>
                    </div>

                    {/* Detalhes */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Detalhes</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-slate-400">
                                <Tag className="w-4 h-4 shrink-0" />
                                <span>{CATEGORY_LABEL[ticket.category] ?? ticket.category}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <MessageSquare className="w-4 h-4 shrink-0" />
                                <span>{ticket.response_count ?? 0} mensagens</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400">
                                <Clock className="w-4 h-4 shrink-0" />
                                <span className="text-xs">{formatDate(ticket.created_at)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Atribuído a */}
                    {ticket.assigned_user && (
                        <div>
                            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Atribuído a</h3>
                            <p className="text-sm text-slate-300">{ticket.assigned_user.full_name}</p>
                            <p className="text-xs text-slate-500">{ticket.assigned_user.email}</p>
                        </div>
                    )}

                    {/* Controles */}
                    <div>
                        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Atualizar ticket</h3>
                        <div className="space-y-2">
                            <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                            >
                                {STATUS_OPTIONS.map((s) => (
                                    <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                            </select>
                            <select
                                value={editPriority}
                                onChange={(e) => setEditPriority(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                            >
                                {PRIORITY_OPTIONS.map((p) => (
                                    <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                            </select>
                            <button
                                onClick={updateTicket}
                                disabled={updating}
                                className="w-full flex items-center justify-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 py-2 rounded-lg text-xs font-semibold transition"
                            >
                                {updating ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Atualizar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
