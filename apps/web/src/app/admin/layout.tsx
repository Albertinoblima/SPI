'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    BarChart3,
    AlertTriangle,
    Building2,
    MessageSquare,
    Shield,
    LogOut,
    LogIn,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AdminLayoutProps {
    children: ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const pathname = usePathname();
    const router = useRouter();

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

    return (
        <div className="flex h-screen bg-slate-900">
            {/* Sidebar */}
            <div className="w-64 bg-slate-800 border-r border-slate-700 overflow-y-auto">
                <div className="p-6">
                    <div className="flex items-center gap-2 mb-8">
                        <Shield className="w-8 h-8 text-blue-500" />
                        <h1 className="text-xl font-bold text-white">
                            SPI Admin
                        </h1>
                    </div>

                    <nav className="space-y-2">
                        {navItems.map((item) => {
                            const Icon = item.icon;
                            const active = isActive(item.href);

                            return (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    className={`
                                        flex items-center gap-3 px-4 py-3 rounded-lg
                                        transition-colors duration-200
                                        ${active
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-300 hover:bg-slate-700'
                                        }
                                    `}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{item.label}</span>
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                {/* Footer */}
                <div className="absolute bottom-0 w-64 border-t border-slate-700 p-4">
                    <button
                        onClick={async () => {
                            const supabase = createClient();
                            await supabase.auth.signOut();
                            router.push('/login');
                        }}
                        className="w-full flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Sair</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="h-16 bg-slate-800 border-b border-slate-700 flex items-center px-8">
                    <h2 className="text-xl font-semibold text-white">
                        Painel Administrativo do Sistema
                    </h2>
                    <div className="ml-auto flex items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-300">
                            <LogIn className="w-4 h-4" />
                            <span className="text-sm">Sistema Admin</span>
                        </div>
                    </div>
                </div>

                {/* Page Content */}
                <div className="flex-1 overflow-y-auto bg-slate-900 p-8">
                    {children}
                </div>
            </div>
        </div>
    );
}
