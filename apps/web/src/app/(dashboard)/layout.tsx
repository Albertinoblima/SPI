'use client';

import { ReactNode, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
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
    X,
    Globe2,
} from 'lucide-react';
import ChatWidget from '@/components/support/ChatWidget';
import TenantNotificationBell from '@/components/notifications/TenantNotificationBell';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/hooks/useTheme';

interface DashboardLayoutProps {
    children: ReactNode;
}

const navItems = [
    { label: 'Início', href: '/dashboard', icon: BarChart3 },
    { label: 'Pesquisas', href: '/surveys', icon: FileText },
    { label: 'Base Geográfica', href: '/municipios', icon: Globe2 },
    { label: 'Equipe', href: '/team', icon: Users },
    { label: 'Suporte', href: '/support', icon: LifeBuoy },
    { label: 'Ajuda', href: '/help', icon: CircleHelp },
    { label: 'Configurações', href: '/settings', icon: Settings },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const { theme, toggle } = useTheme();
    const isDark = theme === 'dark';

    // Desktop: sidebar colapsada ou expandida
    const [collapsed, setCollapsed] = useState(false);
    // Mobile: drawer aberto ou fechado
    const [mobileOpen, setMobileOpen] = useState(false);

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

    // Fechar drawer mobile ao navegar
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Fechar drawer com Escape
    useEffect(() => {
        if (!mobileOpen) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [mobileOpen]);

    // Bloquear scroll do body quando drawer mobile está aberto
    useEffect(() => {
        if (mobileOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    const isActive = useCallback((href: string) => {
        if (href === '/dashboard') return pathname === '/dashboard';
        return pathname?.startsWith(href) ?? false;
    }, [pathname]);

    const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
        <>
            {/* Logo */}
            <div className={`p-4 border-b border-slate-200 dark:border-slate-700 flex items-center ${!isMobile && collapsed ? 'justify-center' : 'gap-3'}`}>
                {!isMobile && collapsed ? (
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
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                            Sistema de Pesquisa Inteligente
                        </p>
                    </div>
                )}
                {/* Botão fechar no drawer mobile */}
                {isMobile && (
                    <button
                        onClick={() => setMobileOpen(false)}
                        aria-label="Fechar menu"
                        className="ml-auto p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}
            </div>

            {/* Navegação */}
            <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    const showLabel = isMobile || !collapsed;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            title={!showLabel ? item.label : undefined}
                            className={[
                                'flex items-center gap-3 px-3 py-2.5 rounded-lg',
                                'transition-colors duration-150 text-sm font-medium',
                                !showLabel ? 'justify-center' : '',
                                active
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700',
                            ].join(' ')}
                        >
                            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                            {showLabel && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Rodapé da sidebar */}
            <div className="p-2 border-t border-slate-200 dark:border-slate-700 space-y-0.5">
                <button
                    onClick={toggle}
                    title={isDark ? 'Tema claro' : 'Tema escuro'}
                    className={[
                        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
                        'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
                        !isMobile && collapsed ? 'justify-center' : '',
                    ].join(' ')}
                >
                    {isDark
                        ? <><Sun className="w-[18px] h-[18px] text-yellow-400 flex-shrink-0" />{(isMobile || !collapsed) && <span>Tema claro</span>}</>
                        : <><Moon className="w-[18px] h-[18px] text-slate-500 flex-shrink-0" />{(isMobile || !collapsed) && <span>Tema escuro</span>}</>
                    }
                </button>
                <button
                    onClick={async () => {
                        const supabase = createClient();
                        await supabase.auth.signOut();
                        window.location.href = '/login';
                    }}
                    title="Sair"
                    className={[
                        'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm',
                        'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors',
                        !isMobile && collapsed ? 'justify-center' : '',
                    ].join(' ')}
                >
                    <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                    {(isMobile || !collapsed) && <span>Sair</span>}
                </button>
            </div>
        </>
    );

    return (
        <div className={`flex h-[100dvh] ${isDark ? 'dark' : ''}`}>
            <div className="flex h-[100dvh] w-full bg-slate-100 dark:bg-slate-900 transition-colors duration-200">

                {/* ── Sidebar Desktop (md+) ── */}
                <aside
                    className={[
                        'hidden md:flex flex-col flex-shrink-0',
                        'bg-white dark:bg-slate-800',
                        'border-r border-slate-200 dark:border-slate-700',
                        'transition-[width] duration-200 overflow-hidden',
                        collapsed ? 'w-16' : 'w-64',
                    ].join(' ')}
                    aria-label="Navegação principal"
                >
                    <SidebarContent isMobile={false} />
                </aside>

                {/* ── Drawer Mobile (< md) ── */}
                {/* Backdrop */}
                <div
                    aria-hidden="true"
                    onClick={() => setMobileOpen(false)}
                    className={[
                        'fixed inset-0 z-40 bg-black/50 backdrop-blur-sm',
                        'md:hidden transition-opacity duration-200',
                        mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
                    ].join(' ')}
                />
                {/* Drawer panel */}
                <aside
                    role="dialog"
                    aria-modal="true"
                    aria-label="Menu de navegação"
                    className={[
                        'fixed inset-y-0 left-0 z-50 w-72 flex flex-col',
                        'bg-white dark:bg-slate-800',
                        'shadow-2xl md:hidden',
                        'transition-transform duration-300 ease-in-out',
                        mobileOpen ? 'translate-x-0' : '-translate-x-full',
                    ].join(' ')}
                >
                    <SidebarContent isMobile={true} />
                </aside>

                {/* ── Conteúdo principal ── */}
                <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                    {/* Header */}
                    <header className="h-14 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-3 sm:px-4 flex-shrink-0 gap-2 transition-colors duration-200">
                        {/* Hamburguer: mobile = abre drawer | desktop = colapsa sidebar */}
                        <button
                            onClick={() => {
                                if (window.innerWidth < 768) {
                                    setMobileOpen(o => !o);
                                } else {
                                    setCollapsed(c => !c);
                                }
                            }}
                            aria-label="Alternar menu"
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex-shrink-0"
                        >
                            <Menu className="w-5 h-5" />
                        </button>

                        {/* Empresa (logo + nome) */}
                        {(companyLogo || companyName) && (
                            <div className="flex items-center gap-2 ml-1 min-w-0">
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
                                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[120px] sm:max-w-[200px]">
                                        {companyName}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex-1" />

                        {/* Toggle tema */}
                        <button
                            onClick={toggle}
                            aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex-shrink-0"
                        >
                            {isDark ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5" />}
                        </button>

                        <TenantNotificationBell />
                    </header>

                    {/* Área de conteúdo */}
                    <main className="flex-1 overflow-y-auto">
                        {children}
                    </main>
                </div>
            </div>

            {/* Chat de Suporte - flutuante */}
            <ChatWidget />
        </div>
    );
}
