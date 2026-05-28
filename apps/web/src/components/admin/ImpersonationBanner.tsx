'use client';

import { useEffect, useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ImpersonationBanner() {
    const [impersonation, setImpersonation] = useState<{
        tenantName: string;
        tenantId: string;
    } | null>(null);
    const router = useRouter();

    useEffect(() => {
        const checkImpersonation = async () => {
            try {
                // Usamos o endpoint de stats ou criamos um leve. Por enquanto usamos uma chamada simples.
                const res = await fetch('/api/dashboard'); // ou um endpoint leve
                // Alternativa mais direta: podemos expor via /api/admin/me também, mas para o tenant normal
                // vamos fazer uma chamada dedicada simples.

                // Solução mais limpa: chamar um endpoint que retorna o contexto atual
                const meRes = await fetch('/api/auth/me'); // se existir, ou criamos um simples
                // Por enquanto, vamos assumir que o backend injeta isso. Vamos fazer uma chamada simples ao tenants.

                // Abordagem prática: buscar o tenant atual via dashboard stats ou um endpoint leve.
                // Para simplicidade, vamos chamar o endpoint de impersonate status (vamos criar um GET simples depois).

                // Solução temporária boa: o backend pode setar um header ou cookie. 
                // Por enquanto, vamos buscar via um endpoint simples que criamos.

                // Melhor abordagem atual: adicionar um campo no /api/auth/me ou criar /api/impersonation/status
                // Vamos fazer uma chamada rápida ao /api/admin/impersonate com GET (vamos adicionar suporte)

                // Decisão prática: vamos adicionar um GET no /api/admin/impersonate para checar status
                const statusRes = await fetch('/api/admin/impersonate/status');
                if (statusRes.ok) {
                    const data = await statusRes.json();
                    if (data.isImpersonating) {
                        setImpersonation({
                            tenantName: data.tenantName,
                            tenantId: data.tenantId,
                        });
                    }
                }
            } catch {
                // silencioso
            }
        };

        checkImpersonation();
    }, []);

    const exitImpersonation = async () => {
        try {
            await fetch('/api/admin/impersonate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'exit' }),
            });
            window.location.reload(); // Força reload para limpar contexto
        } catch {
            window.location.reload();
        }
    };

    if (!impersonation) return null;

    return (
        <div className="sticky top-0 z-50 bg-amber-600 text-white px-4 py-2 text-sm flex items-center justify-between shadow-md">
            <div className="flex items-center gap-2 font-medium">
                <ShieldAlert className="w-4 h-4" />
                <span>
                    Você está atuando como <strong>{impersonation.tenantName}</strong>
                </span>
            </div>
            <button
                onClick={exitImpersonation}
                className="flex items-center gap-2 bg-amber-700 hover:bg-amber-800 px-3 py-1 rounded text-sm font-medium transition"
            >
                <LogOut className="w-4 h-4" />
                Sair da Impersonation
            </button>
        </div>
    );
}
