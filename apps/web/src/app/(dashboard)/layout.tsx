'use client';

import { ReactNode, useState, useEffect } from 'react';
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
    Menu,
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
    const [collapsed, setCollapsed] = useState(false);
    const [companyName, setCompanyName] = useState<string>('');
    const [companyLogo, setCompanyLogo] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/settings/company')
            .then(r => r.ok ? r.json() : null)
            .then(json => {
                if (json?.data?.tenant) {
                    setCompanyName(json.data.tenant.name ?? '');
                    setCompanyLogo(json.data.tenant.logo_url ?? null);
                }
            })
            .catch(() => { });
    }, []);

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
                <div className={`${collapsed ? 'w-16' : 'w-64'} bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col flex-shrink-0 transition-all duration-200 overflow-hidden`}>
                    <div className={`p-4 border-b border-slate-200 dark:border-slate-700 flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
                        {collapsed ? (
                            /* Logo SPI reduzida quando colapsado */
                            <div className="w-8 h-8 rounded-md overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                                <Image
                                    src="/branding/idialog-logo.png"
                                    alt="Logo SPI"
                                    width={32}
                                    height={32}
                                    className="object-contain w-8 h-8"
                                />
                            </div>
                        ) : (
                            <div className="flex-1 min-w-0">
                                <Image
                                    src="/branding/idialog-logo.png"
                                    alt="Logo iDialog"
                                    width={120}
                                    height={36}
                                    className="h-8 w-auto"
                                />
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">Sistema de Pesquisa Inteligente</p>
                            </div>
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
                                        flex items-center gap-3 px-3 py-2.5 rounded-lg
                                        transition-colors duration-200 text-sm font-medium
                                        ${collapsed ? 'justify-center' : ''}
                                        ${active
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }
                                    `}
                                >
                                    <Icon className="w-4 h-4 flex-shrink-0" />
                                    {!collapsed && item.label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="p-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                        <button
                            onClick={toggle}
                            title={isDark ? 'Tema claro' : 'Tema escuro'}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${collapsed ? 'justify-center' : ''}`}
                        >
                            {isDark
                                ? <><Sun className="w-4 h-4 text-yellow-400 flex-shrink-0" />{!collapsed && 'Tema claro'}</>
                                : <><Moon className="w-4 h-4 text-slate-500 flex-shrink-0" />{!collapsed && 'Tema escuro'}</>
                            }
                        </button>
                        <button
                            onClick={async () => {
                                const supabase = createClient();
                                await supabase.auth.signOut();
                                window.location.href = '/login';
                            }}
                            title="Sair"
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${collapsed ? 'justify-center' : ''}`}
                        >
                            <LogOut className="w-4 h-4 flex-shrink-0" />
                            {!collapsed && 'Sair'}
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 flex-shrink-0 gap-2 transition-colors duration-200">
                        {/* Botão hamburguer */}
                        <button
                            onClick={() => setCollapsed(c => !c)}
                            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                        {/* Logo e nome da empresa no header */}
                        {(companyLogo || companyName) && (
                            <div className="flex items-center gap-2 ml-2">
                                {companyLogo && (
                                    <div className="w-7 h-7 rounded overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-700 flex-shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={companyLogo}
                                            alt={companyName || 'Logo'}
                                            className="object-contain w-7 h-7"
                                        />
                                    </div>
                                )}
                                {companyName && (
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">{companyName}</span>
                                )}
                            </div>
                        )}
                        <div className="flex-1" />
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
