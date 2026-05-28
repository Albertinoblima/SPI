'use client';

import { ReactNode, useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    AlertTriangle,
    Building2,
    MessageSquare,
    Shield,
    LogOut,
    LogIn,
    Menu,
    Activity,
    Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AdminNotificationBell from '@/components/notifications/AdminNotificationBell';
import ImpersonationBanner from '@/components/admin/ImpersonationBanner';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [collapsed, setCollapsed] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null); // null = checking

    // Proteção client-side para Fase 0 do Update do Painel Administrativo
    useEffect(() => {
        const checkAdminAccess = async () => {
            try {
                const res = await fetch('/api/admin/me');
                if (!res.ok) {
                    // Não é admin → redireciona para área segura
                    router.replace('/dashboard?error=admin_access_denied');
                    return;
                }
                setIsAuthorized(true);
            } catch {
                router.replace('/dashboard?error=admin_access_denied');
            }
        };

        checkAdminAccess();
    }, [router]);

    const navItems = [
        {
            label: 'Dashboard',
            href: '/admin',
            icon: BarChart3,
        },
        {
            label: 'Empresas',
            href: '/admin/tenants',
            icon: Building2,
        },
        {
            label: 'Erros do Sistema',
            href: '/admin/system/errors',
            icon: AlertTriangle,
        },
        {
            label: 'Saúde do Sistema',
            href: '/admin/system/health',
            icon: Activity,
        },
        {
            label: 'System Admins',
            href: '/admin/system/admins',
            icon: Shield,
        },
        {
            label: 'Suporte',
            href: '/admin/support',
            icon: MessageSquare,
        },
        {
            label: 'Auditoria',
            href: '/admin/audit-log',
            icon: Shield,
        },
    ];

    const isActive = (href: string) => {
        if (href === '/admin') {
            return pathname === '/admin';
        }
        return pathname?.startsWith(href);
    };

    // Enquanto verifica permissão, mostra loader (proteção contra flash de conteúdo)
    if (isAuthorized === null) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-900">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                    <p className="text-sm text-slate-400">Verificando acesso administrativo...</p>
                </div>
            </div>
        );
    }

    if (!isAuthorized) {
        return null; // Já redirecionou
    }

    return (
        <div className="flex h-screen bg-slate-900">
            {/* Sidebar */}
            <div className={`${collapsed ? 'w-16' : 'w-64'} bg-slate-800 border-r border-slate-700 flex flex-col flex-shrink-0 overflow-hidden transition-all duration-200`}>
                <div className={`p-4 border-b border-slate-700 flex items-center ${collapsed ? 'justify-center' : ''}`}>
                    {!collapsed && (
                        <Image
                            src="/branding/idialog-logo.png"
                            alt="Logo iDialog"
                            width={120}
                            height={36}
                            className="h-8 w-auto"
                        />
                    )}
                </div>

                <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
                    {navItems.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={collapsed ? item.label : undefined}
                                className={`
                                    flex items-center gap-3 px-3 py-3 rounded-lg
                                    transition-colors duration-200
                                    ${collapsed ? 'justify-center' : ''}
                                    ${active
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-300 hover:bg-slate-700'
                                    }
                                `}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span className="font-medium">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer */}
                <div className="border-t border-slate-700 p-2">
                    <button
                        onClick={async () => {
                            const supabase = createClient();
                            await supabase.auth.signOut();
                            router.push('/login');
                        }}
                        title="Sair"
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors ${collapsed ? 'justify-center' : ''}`}
                    >
                        <LogOut className="w-4 h-4 flex-shrink-0" />
                        {!collapsed && <span>Sair</span>}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-4 gap-3">
                    {/* Botão hamburguer */}
                    <button
                        onClick={() => setCollapsed(c => !c)}
                        title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-semibold text-white flex-1">
                        Painel Administrativo iDialog
                    </h2>
                    <div className="flex items-center gap-3">
                        <AdminNotificationBell />
                        <div className="flex items-center gap-2 text-slate-300">
                            <LogIn className="w-4 h-4" />
                            <span className="text-sm">Sistema Admin</span>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto bg-slate-900">
                    <ImpersonationBanner />
                    <div className="p-8">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
