'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    FileText,
    Users,
    Settings,
    CircleHelp,
    LogOut,
    LifeBuoy,
    Sun,
    Moon,
} from 'lucide-react';
import ChatWidget from '@/components/support/ChatWidget';
import TenantNotificationBell from '@/components/notifications/TenantNotificationBell';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const { theme, toggle } = useTheme();
    const isDark = theme === 'dark';

    const navItems = [
        { label: 'Início', href: '/dashboard', icon: BarChart3 },
        { label: 'Pesquisas', href: '/surveys', icon: FileText },
        { label: 'Equipe', href: '/team', icon: Users },
        { label: 'Suporte', href: '/support', icon: LifeBuoy },
        { label: 'Ajuda', href: '/help', icon: CircleHelp },
        { label: 'Configurações', href: '/settings', icon: Settings },
    ];

    const isActive = (href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname?.startsWith(href);
    };

    return (
        <div className={`flex h-screen ${isDark ? 'dark' : ''}`}>
            <div className="flex h-screen w-full bg-slate-100 dark:bg-slate-900 transition-colors duration-200">
                {/* Sidebar */}
                <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0 transition-colors duration-200">
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                        <Image
                            src="/branding/idialog-logo.png"
                            alt="Logo iDialog"
                            width={140}
                            height={42}
                            className="h-10 w-auto"
                        />
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">Sistema de Pesquisa Inteligente</p>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);
                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 px-4 py-2.5 rounded-lg
                                        transition-colors duration-200 text-sm font-medium
                                        ${active
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }
                                    `}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-1">
                        {/* Toggle de tema no menu lateral */}
                        <button
                            onClick={toggle}
                            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            {isDark
                                ? <><Sun className="w-4 h-4 text-yellow-400" /> Tema claro</>
                                : <><Moon className="w-4 h-4 text-slate-500" /> Tema escuro</>
                            }
                        </button>
                        <button
                            onClick={async () => {
                                const supabase = createClient();
                                await supabase.auth.signOut();
                                window.location.href = '/login';
                            }}
                            className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Sair
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-end px-6 flex-shrink-0 gap-2 transition-colors duration-200">
                        {/* Toggle de tema no header */}
                        <button
                            onClick={toggle}
                            title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                            {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
                        </button>
                        <TenantNotificationBell />
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {children}
                    </div>
                </div>
            </div>

            {/* Chat de Suporte - flutuante */}
            <ChatWidget />
        </div>
    );
}
