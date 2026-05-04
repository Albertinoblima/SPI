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
} from 'lucide-react';
import ChatWidget from '@/components/support/ChatWidget';
import TenantNotificationBell from '@/components/notifications/TenantNotificationBell';
import { createClient } from '@/lib/supabase/client';

interface DashboardLayoutProps {
    children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();

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
        <div className="flex h-screen bg-slate-100">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 flex flex-col">
                <div className="p-6 border-b border-slate-200">
                    <Image
                        src="/branding/idialog-logo.png"
                        alt="Logo iDialog"
                        width={140}
                        height={42}
                        className="h-10 w-auto"
                    />
                    <p className="text-xs text-slate-500 mt-2">Sistema de Pesquisa Inteligente</p>
                </div>

                <nav className="flex-1 p-4 space-y-1">
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
                                        : 'text-slate-600 hover:bg-slate-100'
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                {item.label}
                            </Link>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-200">
                    <button
                        onClick={async () => {
                            const supabase = createClient();
                            await supabase.auth.signOut();
                            window.location.href = '/login';
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-end px-6 flex-shrink-0">
                    <TenantNotificationBell />
                </div>
                <div className="flex-1 overflow-y-auto">
                    {children}
                </div>
            </div>

            {/* Chat de Suporte - flutuante */}
            <ChatWidget />
        </div>
    );
}
