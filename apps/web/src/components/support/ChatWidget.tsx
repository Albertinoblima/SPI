'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Plus, ChevronDown, Loader, CheckCircle2, Paperclip, Image as ImageIcon, FileText, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Message {
    id: string;
    message: string;
    is_from_admin: boolean;
    created_at: string;
    attachments?: Attachment[];
}

interface Attachment {
    url: string;
    name: string;
    type: string;
    size: number;
}

interface Ticket {
    id: string;
    title: string;
    status: string;
    priority: string;
    created_at: string;
    updated_at?: string;
    response_count: number;
}

type View = 'list' | 'chat' | 'new';

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
    closed: 'bg-slate-100 text-slate-600',
};

const PRIORITY_COLOR: Record<string, string> = {
    urgent: 'text-red-600',
    high: 'text-orange-500',
    medium: 'text-yellow-600',
    low: 'text-blue-500',
};

function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (diffMin < 1) return 'agora';
    if (diffMin < 60) return `${diffMin}min`;
    if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

function AttachmentPreview({ att, onRemove }: { att: Attachment & { preview?: string }; onRemove?: () => void }) {
    const isImage = att.type.startsWith('image/');
    return (
        <div className="relative inline-flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1.5 text-xs text-slate-700 max-w-[180px]">
            {isImage && att.preview ? (
                <img src={att.preview} alt={att.name} className="w-8 h-8 rounded object-cover flex-shrink-0" />
            ) : isImage ? (
                <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
            ) : (
                <FileText className="w-4 h-4 text-slate-500 flex-shrink-0" />
            )}
            <span className="truncate">{att.name}</span>
            {onRemove && (
                <button onClick={onRemove} title="Remover" className="flex-shrink-0 text-slate-400 hover:text-red-500">
                    <XCircle className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
}

function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
    return (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
            {attachments.map((att, i) => {
                const isImage = att.type.startsWith('image/');
                if (isImage) {
                    return (
                        <a key={i} href={att.url} target="_blank" rel="noreferrer">
                            <img src={att.url} alt={att.name} className="max-w-[180px] max-h-[160px] rounded-lg object-cover border border-slate-200 hover:opacity-90 transition" />
                        </a>
                    );
                }
                return (
                    <a key={i} href={att.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 rounded-lg px-2 py-1 text-xs transition">
                        <FileText className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[120px]">{att.name}</span>
                        <span className="opacity-70">({formatBytes(att.size)})</span>
                    </a>
                );
            })}
        </div>
    );
}

export default function ChatWidget() {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<View>('list');
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(false);
    const [loadingMsgs, setLoadingMsgs] = useState(false);
    const [sending, setSending] = useState(false);
    const [msgInput, setMsgInput] = useState('');
    const [unreadCount, setUnreadCount] = useState(0);

    // Anexos pendentes (antes de enviar)
    type PendingFile = Attachment & { preview?: string; file: File };
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Novo ticket
    const [newTitle, setNewTitle] = useState('');
    const [newMessage, setNewMessage] = useState('');
    const [newCategory, setNewCategory] = useState('general');
    const [newPriority, setNewPriority] = useState('medium');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const fetchTickets = useCallback(async () => {
        setLoadingTickets(true);
        try {
            const res = await fetch('/api/support/tickets');
            if (res.ok) {
                const { data } = await res.json();
                setTickets(data.tickets ?? []);
                const waiting = (data.tickets ?? []).filter(
                    (t: Ticket) => t.status === 'waiting_user'
                ).length;
                setUnreadCount(waiting);
            }
        } finally {
            setLoadingTickets(false);
        }
    }, []);

    const fetchMessages = useCallback(async (ticketId: string) => {
        setLoadingMsgs(true);
        try {
            const res = await fetch(`/api/support/tickets/${ticketId}`);
            if (res.ok) {
                const { data } = await res.json();
                setMessages(data.messages ?? []);
                setActiveTicket(data.ticket);
            }
        } finally {
            setLoadingMsgs(false);
        }
    }, []);

    useEffect(() => {
        if (open) fetchTickets();
    }, [open, fetchTickets]);

    // Poll mensagens quando em view=chat
    useEffect(() => {
        if (view === 'chat' && activeTicket) {
            pollRef.current = setInterval(() => fetchMessages(activeTicket.id), 8000);
            return () => { if (pollRef.current) clearInterval(pollRef.current); };
        }
    }, [view, activeTicket, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const openTicket = (ticket: Ticket) => {
        setActiveTicket(ticket);
        setMessages([]);
        setPendingFiles([]);
        setMsgInput('');
        setView('chat');
        fetchMessages(ticket.id);
    };

    // Adicionar arquivos à fila de pendentes
    function addFiles(files: FileList | File[]) {
        const arr = Array.from(files);
        const newPending = arr.map((file) => {
            const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
            return { url: '', name: file.name, type: file.type, size: file.size, preview, file };
        });
        setPendingFiles((prev) => [...prev, ...newPending].slice(0, 5)); // máx 5 por vez
    }

    // Lidar com paste de imagem na área de texto
    function handlePaste(e: React.ClipboardEvent) {
        const items = Array.from(e.clipboardData.items);
        const imageItems = items.filter((item) => item.type.startsWith('image/'));
        if (imageItems.length === 0) return;
        e.preventDefault();
        const files = imageItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
        addFiles(files);
    }

    // Upload de todos os arquivos pendentes
    async function uploadPendingFiles(ticketId: string): Promise<Attachment[]> {
        if (pendingFiles.length === 0) return [];
        setUploading(true);
        const uploaded: Attachment[] = [];
        for (const pf of pendingFiles) {
            const fd = new FormData();
            fd.append('file', pf.file);
            fd.append('ticket_id', ticketId);
            const res = await fetch('/api/support/upload', { method: 'POST', body: fd });
            if (res.ok) {
                const { data } = await res.json();
                uploaded.push(data);
            }
        }
        setUploading(false);
        setPendingFiles([]);
        return uploaded;
    }

    const sendMessage = async () => {
        if ((!msgInput.trim() && pendingFiles.length === 0) || !activeTicket || sending) return;
        setSending(true);
        try {
            const attachments = await uploadPendingFiles(activeTicket.id);
            const res = await fetch(`/api/support/tickets/${activeTicket.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msgInput.trim() || '📎 Arquivo anexado',
                    attachments: attachments.length > 0 ? attachments : undefined,
                }),
            });
            if (res.ok) {
                setMsgInput('');
                fetchMessages(activeTicket.id);
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
                setNewTitle('');
                setNewMessage('');
                setNewCategory('general');
                setNewPriority('medium');
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

    const isClosed = activeTicket?.status === 'closed' || activeTicket?.status === 'resolved';

    return (
        <>
            {/* Botão flutuante */}
            <button
                onClick={() => setOpen((o) => !o)}
                className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-xl flex items-center justify-center text-xl sm:text-2xl transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300"
                aria-label="Abrir suporte"
            >
                {open ? (
                    <X className="w-6 h-6" />
                ) : (
                    <span>💬</span>
                )}
                {!open && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Painel do chat */}
            {open && (
                <div className="fixed bottom-20 right-2 left-2 sm:left-auto sm:bottom-24 sm:right-6 z-50 sm:w-96 max-h-[80dvh] sm:max-h-[600px] flex flex-col rounded-2xl shadow-2xl border border-slate-200 bg-white overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
                    {/* Header */}
                    <div className="bg-blue-600 text-white px-5 py-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {(view === 'chat' || view === 'new') && (
                                <button
                                    onClick={() => { setView('list'); fetchTickets(); }}
                                    className="hover:bg-blue-500 rounded p-1 transition"
                                    aria-label="Voltar"
                                >
                                    <ChevronDown className="w-4 h-4 rotate-90" />
                                </button>
                            )}
                            <div>
                                <p className="font-semibold text-sm">
                                    {view === 'list' && '💬 Suporte iDialog'}
                                    {view === 'new' && '✏️ Novo Ticket'}
                                    {view === 'chat' && (activeTicket?.title ?? 'Chat')}
                                </p>
                                {view === 'list' && (
                                    <p className="text-blue-200 text-xs">Como podemos ajudar?</p>
                                )}
                                {view === 'chat' && activeTicket && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[activeTicket.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                        {STATUS_LABEL[activeTicket.status] ?? activeTicket.status}
                                    </span>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setOpen(false)} className="hover:bg-blue-500 rounded p-1 transition">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Conteúdo */}
                    <div className="flex-1 overflow-y-auto">

                        {/* VIEW: LISTA */}
                        {view === 'list' && (
                            <div className="flex flex-col h-full">
                                <div className="flex-1 overflow-y-auto">
                                    {loadingTickets ? (
                                        <div className="flex items-center justify-center h-32">
                                            <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                                        </div>
                                    ) : tickets.length === 0 ? (
                                        <div className="text-center py-12 px-4">
                                            <span className="text-4xl">💬</span>
                                            <p className="text-slate-600 font-medium mt-3">Nenhum ticket ainda</p>
                                            <p className="text-slate-400 text-sm mt-1">Clique abaixo para abrir seu primeiro chamado</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-slate-100">
                                            {tickets.map((ticket) => (
                                                <button
                                                    key={ticket.id}
                                                    onClick={() => openTicket(ticket)}
                                                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition flex items-start gap-3"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <p className="text-sm font-medium text-slate-800 truncate">{ticket.title}</p>
                                                            {ticket.status === 'waiting_user' && (
                                                                <span className="shrink-0 w-2 h-2 rounded-full bg-blue-500" />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[ticket.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                                                {STATUS_LABEL[ticket.status] ?? ticket.status}
                                                            </span>
                                                            <span className={`text-xs font-medium ${PRIORITY_COLOR[ticket.priority] ?? 'text-slate-500'}`}>
                                                                {ticket.priority === 'urgent' ? '🔴 Urgente' :
                                                                    ticket.priority === 'high' ? '🟠 Alto' :
                                                                        ticket.priority === 'medium' ? '🟡 Médio' : '🔵 Baixo'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="text-xs text-slate-400 shrink-0 mt-1">{formatTime(ticket.updated_at ?? ticket.created_at)}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="p-4 border-t border-slate-100">
                                    <button
                                        onClick={() => setView('new')}
                                        className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Abrir novo chamado
                                    </button>
                                    <Link
                                        href="/support"
                                        className="block text-center text-xs text-blue-500 hover:text-blue-700 mt-2"
                                    >
                                        Ver todos os tickets →
                                    </Link>
                                </div>
                            </div>
                        )}

                        {/* VIEW: NOVO TICKET */}
                        {view === 'new' && (
                            <div className="p-4 space-y-3">
                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Assunto *</label>
                                    <input
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        placeholder="Resumo do problema..."
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                        maxLength={120}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Categoria</label>
                                        <select
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="general">Geral</option>
                                            <option value="technical">Técnico</option>
                                            <option value="billing">Financeiro</option>
                                            <option value="feature">Sugestão</option>
                                            <option value="bug">Bug</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-slate-600 mb-1">Prioridade</label>
                                        <select
                                            value={newPriority}
                                            onChange={(e) => setNewPriority(e.target.value)}
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                        >
                                            <option value="low">Baixa</option>
                                            <option value="medium">Média</option>
                                            <option value="high">Alta</option>
                                            <option value="urgent">Urgente</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold text-slate-600 mb-1">Descreva o problema *</label>
                                    <textarea
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="Explique com detalhes..."
                                        rows={4}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-blue-500 resize-none"
                                    />
                                </div>

                                {createError && (
                                    <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{createError}</p>
                                )}

                                <button
                                    onClick={createTicket}
                                    disabled={creating}
                                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition"
                                >
                                    {creating ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    {creating ? 'Enviando...' : 'Enviar chamado'}
                                </button>
                            </div>
                        )}

                        {/* VIEW: CHAT */}
                        {view === 'chat' && (
                            <div className="flex flex-col h-[400px]">
                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {loadingMsgs && messages.length === 0 ? (
                                        <div className="flex items-center justify-center h-full">
                                            <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                                        </div>
                                    ) : messages.length === 0 ? (
                                        <p className="text-center text-slate-400 text-sm">Nenhuma mensagem ainda.</p>
                                    ) : (
                                        <>
                                            {messages.map((msg) => (
                                                <div key={msg.id} className={`flex ${msg.is_from_admin ? 'justify-start' : 'justify-end'}`}>
                                                    <div className={`max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${msg.is_from_admin
                                                        ? 'bg-slate-100 text-slate-800 rounded-tl-sm'
                                                        : 'bg-blue-600 text-white rounded-tr-sm'
                                                        }`}>
                                                        {msg.is_from_admin && (
                                                            <p className="text-xs font-semibold text-blue-600 mb-0.5">Suporte iDialog</p>
                                                        )}
                                                        <p className="whitespace-pre-wrap">{msg.message}</p>
                                                        {msg.attachments && msg.attachments.length > 0 && (
                                                            <MessageAttachments attachments={msg.attachments} />
                                                        )}
                                                        <p className={`text-xs mt-1 ${msg.is_from_admin ? 'text-slate-400' : 'text-blue-200'}`}>
                                                            {formatTime(msg.created_at)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                            }                                        </>)}

                                    {isClosed && (
                                        <div className="flex items-center gap-2 text-green-600 text-xs bg-green-50 rounded-lg p-2 mt-2">
                                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                                            Ticket encerrado. Abra um novo chamado se precisar de mais ajuda.
                                        </div>
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {!isClosed && (
                                    <div className="border-t border-slate-100 p-3 space-y-2">
                                        {/* Preview de arquivos pendentes */}
                                        {pendingFiles.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {pendingFiles.map((pf, i) => (
                                                    <AttachmentPreview
                                                        key={i}
                                                        att={pf}
                                                        onRemove={() => setPendingFiles((prev) => prev.filter((_, idx) => idx !== i))}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            {/* Input oculto para arquivos */}
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                multiple
                                                accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx,.zip"
                                                className="hidden"
                                                onChange={(e) => e.target.files && addFiles(e.target.files)}
                                            />
                                            <button
                                                onClick={() => fileInputRef.current?.click()}
                                                title="Anexar arquivo ou imagem"
                                                className="w-9 h-9 flex items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:text-blue-500 hover:border-blue-300 transition flex-shrink-0"
                                            >
                                                <Paperclip className="w-4 h-4" />
                                            </button>
                                            <input
                                                type="text"
                                                value={msgInput}
                                                onChange={(e) => setMsgInput(e.target.value)}
                                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                                                onPaste={handlePaste}
                                                placeholder={pendingFiles.length > 0 ? 'Legenda (opcional)…' : 'Digite ou cole uma imagem…'}
                                                className="flex-1 px-3 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:border-blue-500"
                                            />
                                            <button
                                                onClick={sendMessage}
                                                disabled={sending || uploading || (!msgInput.trim() && pendingFiles.length === 0)}
                                                className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition shrink-0"
                                            >
                                                {(sending || uploading) ? <Loader className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
