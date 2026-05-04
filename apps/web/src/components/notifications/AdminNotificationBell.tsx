'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageSquare, Loader, X, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface TicketNotif {
    id: string;
    title: string;
    status: string;
    priority: string;
    updated_at: string;
    tenants?: { name: string };
    user?: { full_name: string; email: string };
}

const PRIORITY_COLOR: Record<string, string> = {
    urgent: 'bg-red-500/20 text-red-300',
    high: 'bg-orange-500/20 text-orange-300',
    medium: 'bg-yellow-500/20 text-yellow-300',
    low: 'bg-blue-500/20 text-blue-300',
};

function formatTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Agora';
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
}

export default function AdminNotificationBell() {
    const [open, setOpen] = useState(false);
    const [tickets, setTickets] = useState<TicketNotif[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    const fetchUnread = useCallback(async () => {
        try {
            const res = await fetch('/api/admin/notifications');
            if (!res.ok) return;
            const { data } = await res.json();
            setUnread(data.unread ?? 0);
        } catch { /* silent */ }
    }, []);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/admin/support/tickets?status=open&page=1');
            if (!res.ok) return;
            const { data } = await res.json();
            setTickets((data.tickets ?? []).slice(0, 8));
            setUnread(data.tickets?.length ?? 0);
        } catch { /* silent */ } finally {
            setLoading(false);
        }
    }, []);

    // Polling a cada 30s para atualizar badge
    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, [fetchUnread]);

    // Fechar ao clicar fora
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    function handleOpen() {
        if (!open) fetchTickets();
        setOpen((v) => !v);
    }

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={handleOpen}
                className="relative p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition"
                title="Tickets abertos"
            >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                        {unread > 9 ? '9+' : unread}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-10 w-96 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-blue-400" />
                            <span className="font-semibold text-white text-sm">Tickets abertos</span>
                            {unread > 0 && (
                                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                                    {unread}
                                </span>
                            )}
                        </div>
                        <button onClick={() => setOpen(false)} title="Fechar" className="text-slate-500 hover:text-white">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                            </div>
                        ) : tickets.length === 0 ? (
                            <div className="py-8 text-center text-slate-500 text-sm">
                                Nenhum ticket aberto 🎉
                            </div>
                        ) : (
                            tickets.map((ticket) => (
                                <Link
                                    key={ticket.id}
                                    href={`/admin/support/${ticket.id}`}
                                    onClick={() => setOpen(false)}
                                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-700/50 transition border-b border-slate-700/50 last:border-0"
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">
                                            {ticket.title}
                                        </p>
                                        <p className="text-xs text-slate-400 truncate">
                                            {ticket.user?.email} — {ticket.tenants?.name ?? ''}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLOR[ticket.priority] ?? 'bg-slate-700 text-slate-300'}`}>
                                                {ticket.priority}
                                            </span>
                                            <span className="text-xs text-slate-500">{formatTime(ticket.updated_at)}</span>
                                        </div>
                                    </div>
                                    <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 mt-1" />
                                </Link>
                            ))
                        )}
                    </div>

                    <div className="px-4 py-2 border-t border-slate-700">
                        <Link
                            href="/admin/support"
                            onClick={() => setOpen(false)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition"
                        >
                            Ver todos os tickets →
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
