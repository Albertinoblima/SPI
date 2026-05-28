'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    Users,
    AlertTriangle,
    Loader,
    UserPlus,
    UserMinus,
    Search,
} from 'lucide-react';

interface SystemAdmin {
    id: string;
    full_name: string | null;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
}

export default function SystemAdminsPage() {
    const [admins, setAdmins] = useState<SystemAdmin[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchAdmins = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/admin/system/admins');
            if (!res.ok) throw new Error('Erro ao carregar administradores do sistema');

            const { data } = await res.json();
            setAdmins(data.admins || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro desconhecido');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAdmins();
    }, [fetchAdmins]);

    const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
        const newStatus = !currentStatus;
        const action = newStatus ? 'promover' : 'rebaixar';

        if (!confirm(`Tem certeza que deseja ${action} este usuário como System Admin?`)) {
            return;
        }

        setActionLoading(userId);
        setError(null);

        try {
            const res = await fetch('/api/admin/system/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    isSystemAdmin: newStatus,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Falha ao atualizar privilégios');
            }

            // Recarrega a lista completa (abordagem mais segura e simples)
            await fetchAdmins();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao executar ação');
        } finally {
            setActionLoading(null);
        }
    };

    const filteredAdmins = admins.filter(
        (admin) =>
            admin.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (admin.full_name && admin.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <Loader className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                    <Shield className="w-8 h-8 text-blue-400" />
                    Gestão de System Admins
                </h1>
                <p className="text-slate-400 mt-1">
                    Controle quem tem acesso total ao Painel Administrativo iDialog
                </p>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-red-900/30 border border-red-700 text-red-200 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    {error}
                </div>
            )}

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                </div>
                <div className="text-sm text-slate-400">
                    {filteredAdmins.length} administrador(es) com acesso total
                </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                {filteredAdmins.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhum system admin encontrado com os filtros atuais.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-slate-900 text-slate-400">
                            <tr>
                                <th className="text-left px-6 py-4">Usuário</th>
                                <th className="text-left px-6 py-4">Email</th>
                                <th className="text-left px-6 py-4">Criado em</th>
                                <th className="text-right px-6 py-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {filteredAdmins.map((admin) => (
                                <tr key={admin.id} className="hover:bg-slate-700/30">
                                    <td className="px-6 py-4 font-medium text-white">
                                        {admin.full_name || 'Sem nome'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-300">{admin.email}</td>
                                    <td className="px-6 py-4 text-slate-400">
                                        {new Date(admin.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => handleToggleAdmin(admin.id, true)}
                                            disabled={actionLoading === admin.id}
                                            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-red-600/90 hover:bg-red-600 text-white disabled:opacity-50 transition"
                                        >
                                            {actionLoading === admin.id ? (
                                                <Loader className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <UserMinus className="w-4 h-4" />
                                            )}
                                            Remover privilégios
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="text-xs text-slate-500 bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                <strong>Atenção:</strong> Apenas usuários com <code>is_system_admin = true</code> têm acesso total a este painel.
                Ações aqui são críticas e são registradas no log de auditoria.
            </div>
        </div>
    );
}
