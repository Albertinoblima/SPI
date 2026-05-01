'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    FileText,
    Users,
    MapPin,
    Settings,
    LogOut,
} from 'lucide-react';
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
        { label: 'Respostas', href: '/responses', icon: MapPin },
        { label: 'Equipe', href: '/team', icon: Users },
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
                    <h1 className="text-xl font-bold text-slate-900">SPI</h1>
                    <p className="text-xs text-slate-500 mt-1">Sistema de Pesquisa</p>
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
                            router.push('/login');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Sair
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
                {children}
            </div>
        </div>
    );
}
