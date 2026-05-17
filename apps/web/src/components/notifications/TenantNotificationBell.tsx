'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, MessageSquare, Megaphone, Loader, X, ChevronRight, CheckCheck } from 'lucide-react';
import Link from 'next/link';

interface Notification {
    id: string;
    type: 'ticket_reply' | 'broadcast' | 'system';
    title: string;
    message: string;
    ticket_id?: string;
    created_at: string;
    is_read: boolean;
}

function formatTime(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Agora';
    if (m < 60) return `${m}min atrás`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h atrás`;
    return `${Math.floor(h / 24)}d atrás`;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
    ticket_reply: <MessageSquare className="w-4 h-4 text-blue-400" />,
    broadcast: <Megaphone className="w-4 h-4 text-purple-400" />,
    system: <Bell className="w-4 h-4 text-yellow-400" />,
};

export default function TenantNotificationBell() {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const [modalNotif, setModalNotif] = useState<Notification | null>(null);
    const ref = useRef<HTMLDivElement>(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await fetch('/api/notifications');
            if (!res.ok) return;
            const { data } = await res.json();
            setNotifications(data.notifications ?? []);
            setUnread(data.unread ?? 0);
        } catch { /* silent */ }
    }, []);

    // Polling a cada 20s
    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 20000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    // Fechar ao clicar fora (mas não fechar modal)
    useEffect(() => {
        function handler(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    async function handleOpen() {
        if (!open) {
            setLoading(true);
            await fetchNotifications();
            setLoading(false);
        }
        setOpen((v) => !v);
    }

    async function markAllRead() {
        const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
        if (unreadIds.length === 0) return;
        await fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: unreadIds }),
        });
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnread(0);
    }

    async function markRead(id: string) {
        await fetch('/api/notifications/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [id] }),
        });
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnread((c) => Math.max(0, c - 1));
    }

    function openModal(notif: Notification) {
        setModalNotif(notif);
        setOpen(false);
        if (!notif.is_read) markRead(notif.id);
    }

    return (
        <>
            <div className="relative" ref={ref}>
                <button
                    onClick={handleOpen}
                    className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                    title="Notificações"
                >
                    <Bell className="w-5 h-5" />
                    {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold">
                            {unread > 9 ? '9+' : unread}
                        </span>
                    )}
                </button>

                {open && (
                    <div className="absolute right-0 top-10 w-[calc(100vw-2rem)] sm:w-96 max-w-sm sm:max-w-none bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                <Bell className="w-4 h-4 text-blue-500" />
                                <span className="font-semibold text-slate-800 text-sm">Notificações</span>
                                {unread > 0 && (
                                    <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                                        {unread}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                {unread > 0 && (
                                    <button
                                        onClick={markAllRead}
                                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50 transition"
                                        title="Marcar todas como lidas"
                                    >
                                        <CheckCheck className="w-3 h-3" />
                                        Lidas
                                    </button>
                                )}
                                <button onClick={() => setOpen(false)} title="Fechar" className="text-slate-400 hover:text-slate-700 p-1">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="max-h-96 overflow-y-auto">
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader className="w-5 h-5 text-blue-500 animate-spin" />
                                </div>
                            ) : notifications.length === 0 ? (
                                <div className="py-8 text-center text-slate-400 text-sm">
                                    Nenhuma notificação
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`flex items-start gap-3 px-4 py-3 border-b border-slate-100 last:border-0 transition
                                            ${notif.is_read ? 'opacity-60' : 'bg-blue-50/40'}`}
                                    >
                                        <div className="mt-0.5 flex-shrink-0">
                                            {TYPE_ICON[notif.type] ?? <Bell className="w-4 h-4 text-slate-400" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className={`text-sm font-medium truncate ${notif.is_read ? 'text-slate-600' : 'text-slate-800'}`}>
                                                {notif.title}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                                                {notif.message}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-xs text-slate-400">{formatTime(notif.created_at)}</span>
                                                <button
                                                    onClick={() => openModal(notif)}
                                                    className="text-xs text-blue-500 hover:text-blue-700 underline"
                                                >
                                                    Ver completo
                                                </button>
                                                {notif.ticket_id && (
                                                    <Link
                                                        href="/support"
                                                        onClick={() => {
                                                            markRead(notif.id);
                                                            setOpen(false);
                                                        }}
                                                        className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-0.5"
                                                    >
                                                        Ir ao ticket <ChevronRight className="w-3 h-3" />
                                                    </Link>
                                                )}
                                            </div>
                                        </div>
                                        {!notif.is_read && (
                                            <button
                                                onClick={() => markRead(notif.id)}
                                                className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-2"
                                                title="Marcar como lida"
                                            />
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal mensagem completa */}
            {modalNotif && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                {TYPE_ICON[modalNotif.type] ?? <Bell className="w-4 h-4" />}
                                <span className="font-semibold text-slate-800">{modalNotif.title}</span>
                            </div>
                            <button
                                onClick={() => setModalNotif(null)}
                                title="Fechar"
                                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                                {modalNotif.message}
                            </p>
                            <p className="text-xs text-slate-400 mt-4">{formatTime(modalNotif.created_at)}</p>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3">
                            {modalNotif.ticket_id && (
                                <Link
                                    href="/support"
                                    onClick={() => setModalNotif(null)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
                                >
                                    <MessageSquare className="w-4 h-4" />
                                    Ir ao ticket
                                </Link>
                            )}
                            <button
                                onClick={() => setModalNotif(null)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
