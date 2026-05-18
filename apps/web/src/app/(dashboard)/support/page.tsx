'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    MessageSquare, Plus, Send, ChevronLeft, Loader,
    CheckCircle2, AlertCircle, Clock, Inbox,
} from 'lucide-react';

interface Message {
    id: string;
    message: string;
    is_from_admin: boolean;
    created_at: string;
}

interface Ticket {
    id: string;
    title: string;
    status: string;
    priority: string;
    category: string;
    created_at: string;
    updated_at: string;
    response_count: number;
}

const STATUS_LABEL: Record<string, string> = {
    open: 'Aberto',
    in_progress: 'Em andamento',
    waiting_user: 'Aguardando você',
    resolved: 'Resolvido',
    closed: 'Fechado',
};

const STATUS_COLOR: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    waiting_user: 'bg-blue-100 text-blue-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-slate-100 text-slate-500',
};

const PRIORITY_ICON: Record<string, string> = {
    urgent: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
};

const CATEGORY_LABEL: Record<string, string> = {
    general: 'Geral',
    technical: 'Técnico',
    billing: 'Financeiro',
    feature: 'Sugestão',
    bug: 'Bug',
};

function formatDate(d: string) {
    return new Date(d).toLocaleDateString('pt-BR', {
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
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export default function SupportPage() {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterStatus, setFilterStatus] = useState('all');

    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [msgInput, setMsgInput] = useState('');
    const [sending, setSending] = useState(false);

    const [showNew, setShowNew] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [newCategory, setNewCategory] = useState('general');
    const [newPriority, setNewPriority] = useState('medium');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/support/tickets');
            if (res.ok) {
                const { data } = await res.json();
                setTickets(data.tickets ?? []);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const openTicket = useCallback(async (ticket: Ticket) => {
        setActiveTicket(ticket);
        setMessages([]);
        setLoadingMsgs(true);
        setShowNew(false);
        try {
            const res = await fetch(`/api/support/tickets/${ticket.id}`);
            if (res.ok) {
                const { data } = await res.json();
                setMessages(data.messages ?? []);
                setActiveTicket(data.ticket);
            }
        } finally {
            setLoadingMsgs(false);
        }
    }, []);

    useEffect(() => { fetchTickets(); }, [fetchTickets]);

    // Poll para chat aberto
    useEffect(() => {
        if (activeTicket) {
            pollRef.current = setInterval(async () => {
                const res = await fetch(`/api/support/tickets/${activeTicket.id}`);
                if (res.ok) {
                    const { data } = await res.json();
                    setMessages(data.messages ?? []);
                    setActiveTicket(data.ticket);
                }
            }, 8000);
            return () => { if (pollRef.current) clearInterval(pollRef.current); };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTicket?.id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!msgInput.trim() || !activeTicket || sending) return;
        setSending(true);
        try {
            const res = await fetch(`/api/support/tickets/${activeTicket.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: msgInput.trim() }),
            });
            if (res.ok) {
                setMsgInput('');
                const r2 = await fetch(`/api/support/tickets/${activeTicket.id}`);
                if (r2.ok) {
                    const { data } = await r2.json();
                    setMessages(data.messages ?? []);
                }
            }
        } finally {
            setSending(false);
        }
    };

    const createTicket = async () => {
        setCreateError('');
        if (!newTitle.trim() || !newMessage.trim()) {
            setCreateError('Preencha o título e a mensagem.');
            return;
        }
        setCreating(true);
        try {
            const res = await fetch('/api/support/tickets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: newTitle.trim(),
                    message: newMessage.trim(),
                    category: newCategory,
                    priority: newPriority,
                }),
            });
            if (res.ok) {
                const { data } = await res.json();
                setNewTitle(''); setNewMessage('');
                setNewCategory('general'); setNewPriority('medium');
                setShowNew(false);
                await fetchTickets();
                openTicket(data.ticket);
            } else {
                const err = await res.json();
                setCreateError(err.error ?? 'Erro ao criar ticket');
            }
        } finally {
            setCreating(false);
        }
    };

    const filteredTickets = filterStatus === 'all'
        ? tickets
        : tickets.filter((t) => t.status === filterStatus);

    const isClosed = activeTicket?.status === 'closed' || activeTicket?.status === 'resolved';

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">💬 Suporte</h1>
                    <p className="text-slate-500 text-sm mt-1">Abra chamados e acompanhe o atendimento</p>
                </div>
                <button
                    onClick={() => { setShowNew(true); setActiveTicket(null); }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                >
                    <Plus className="w-4 h-4" />
                    Novo chamado
                </button>
            </div>

            <div className="flex gap-6 h-[calc(100vh-220px)] min-h-[500px]">
                {/* Lista de tickets */}
                <div className="w-80 shrink-0 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {/* Filtros */}
                    <div className="p-3 border-b border-slate-100">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-blue-500 bg-slate-50"
                        >
                            <option value="all">Todos os tickets</option>
                            <option value="open">Abertos</option>
                            <option value="in_progress">Em andamento</option>
                            <option value="waiting_user">Aguardando você</option>
                            <option value="resolved">Resolvidos</option>
                            <option value="closed">Fechados</option>
                        </select>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-32">
                                <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                            </div>
                        ) : filteredTickets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
                                <Inbox className="w-8 h-8 mb-2" />
                                <p className="text-sm">Nenhum ticket encontrado</p>
                            </div>
                        ) : (
                            filteredTickets.map((ticket) => (
                                <button
                                    key={ticket.id}
                                    onClick={() => openTicket(ticket)}
                                    className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition ${activeTicket?.id === ticket.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                                >
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                        <p className="text-sm font-medium text-slate-800 leading-tight line-clamp-2">{ticket.title}</p>
                                        {ticket.status === 'waiting_user' && (
                                            <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500 mt-1" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ticket.status] ?? ''}`}>
                                            {STATUS_LABEL[ticket.status] ?? ticket.status}
                                        </span>
                                        <span className="text-xs text-slate-400">{formatTime(ticket.updated_at ?? ticket.created_at)}</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Área principal */}
                <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    {/* Novo ticket */}
                    {showNew && (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-xl">
                                <h2 className="text-lg font-semibold text-slate-800 mb-4">Abrir novo chamado</h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Assunto *</label>
                                        <input
                                            type="text"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            placeholder="Resumo do problema ou solicitação"
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                            maxLength={120}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Categoria</label>
                                            <select
                                                value={newCategory}
                                                onChange={(e) => setNewCategory(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="general">Geral</option>
                                                <option value="technical">Técnico</option>
                                                <option value="billing">Financeiro</option>
                                                <option value="feature">Sugestão</option>
                                                <option value="bug">Bug</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Prioridade</label>
                                            <select
                                                value={newPriority}
                                                onChange={(e) => setNewPriority(e.target.value)}
                                                className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                            >
                                                <option value="low">Baixa</option>
                                                <option value="medium">Média</option>
                                                <option value="high">Alta</option>
                                                <option value="urgent">Urgente</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Descrição detalhada *</label>
                                        <textarea
                                            value={newMessage}
                                            onChange={(e) => setNewMessage(e.target.value)}
                                            placeholder="Explique o problema com o máximo de detalhes possível..."
                                            rows={5}
                                            className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500 resize-none"
                                        />
                                    </div>

                                    {createError && (
                                        <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-xl p-3 text-sm">
                                            <AlertCircle className="w-4 h-4 shrink-0" />
                                            {createError}
                                        </div>
                                    )}

                                    <div className="flex gap-3">
                                        <button
                                            onClick={createTicket}
                                            disabled={creating}
                                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition"
                                        >
                                            {creating ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            {creating ? 'Enviando...' : 'Enviar chamado'}
                                        </button>
                                        <button
                                            onClick={() => setShowNew(false)}
                                            className="px-6 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-600 hover:bg-slate-50 transition"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Chat de ticket */}
                    {activeTicket && !showNew && (
                        <>
                            {/* Header do ticket */}
                            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-start gap-4">
                                <div className="flex-1 min-w-0">
                                    <h2 className="font-semibold text-slate-800 truncate">{activeTicket.title}</h2>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[activeTicket.status] ?? ''}`}>
                                            {STATUS_LABEL[activeTicket.status] ?? activeTicket.status}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            {PRIORITY_ICON[activeTicket.priority]} {activeTicket.priority === 'urgent' ? 'Urgente' : activeTicket.priority === 'high' ? 'Alta' : activeTicket.priority === 'medium' ? 'Média' : 'Baixa'}
                                        </span>
                                        <span className="text-xs text-slate-400">{CATEGORY_LABEL[activeTicket.category] ?? activeTicket.category}</span>
                                        <span className="text-xs text-slate-400">· Aberto em {formatDate(activeTicket.created_at)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Mensagens */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                                {loadingMsgs ? (
                                    <div className="flex items-center justify-center h-32">
                                        <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                                    </div>
                                ) : messages.map((msg) => (
                                    <div key={msg.id} className={`flex ${msg.is_from_admin ? 'justify-start' : 'justify-end'}`}>
                                        <div className={`max-w-[70%] rounded-2xl px-4 py-3 ${msg.is_from_admin
                                            ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                                            : 'bg-blue-600 text-white rounded-tr-sm'
                                            }`}>
                                            {msg.is_from_admin && (
                                                <p className="text-xs font-semibold text-blue-600 mb-1">⚡ Suporte iDialog</p>
                                            )}
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.message}</p>
                                            <p className={`text-xs mt-1.5 ${msg.is_from_admin ? 'text-slate-400' : 'text-blue-200'}`}>
                                                {formatTime(msg.created_at)}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {isClosed && (
                                    <div className="flex items-center gap-2 text-green-700 text-sm bg-green-50 border border-green-200 rounded-xl p-4 mt-2">
                                        <CheckCircle2 className="w-5 h-5 shrink-0" />
                                        <div>
                                            <p className="font-medium">Ticket encerrado</p>
                                            <p className="text-xs text-green-600 mt-0.5">Se precisar de mais ajuda, abra um novo chamado.</p>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input */}
                            {!isClosed && (
                                <div className="border-t border-slate-100 p-4 flex gap-3">
                                    <input
                                        type="text"
                                        value={msgInput}
                                        onChange={(e) => setMsgInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                        placeholder="Digite sua resposta..."
                                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={sending || !msgInput.trim()}
                                        className="w-10 h-10 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition"
                                    >
                                        {sending ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Estado vazio */}
                    {!activeTicket && !showNew && (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                            <MessageSquare className="w-12 h-12 mb-3 opacity-40" />
                            <p className="font-medium">Selecione um ticket</p>
                            <p className="text-sm mt-1">ou abra um novo chamado</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
