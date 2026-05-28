'use client';

import { useState, useEffect, FormEvent } from 'react';
import {
    Users, UserPlus, Pencil, UserX, CheckCircle, AlertCircle,
    Loader2, Search, X, ShieldCheck, Eye, EyeOff,
} from 'lucide-react';

interface Member {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    role: string;
    is_active: boolean;
    last_login_at: string | null;
    created_at: string;
}

const ROLES: Record<string, { label: string; color: string }> = {
    admin: { label: 'Administrador', color: 'bg-purple-100 text-purple-700' },
    manager: { label: 'Gerente', color: 'bg-blue-100 text-blue-700' },
    coordinator_general: { label: 'Coordenador Geral', color: 'bg-indigo-100 text-indigo-700' },
    coordinator_field: { label: 'Coordenador de Campo', color: 'bg-cyan-100 text-cyan-700' },
    supervisor_quality: { label: 'Supervisor de Coleta e Qualidade', color: 'bg-amber-100 text-amber-700' },
    interviewer: { label: 'Entrevistador', color: 'bg-green-100 text-green-700' },
    driver: { label: 'Motorista', color: 'bg-slate-100 text-slate-700' },
    coordinator: { label: 'Coordenador Geral', color: 'bg-indigo-100 text-indigo-700' },
    fiscal: { label: 'Supervisor de Coleta e Qualidade', color: 'bg-amber-100 text-amber-700' },
};

function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function formatDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface MemberFormData {
    full_name: string;
    email: string;
    phone: string;
    role: string;
    password: string;
    is_active: boolean;
}

const emptyForm: MemberFormData = {
    full_name: '', email: '', phone: '', role: 'interviewer', password: '', is_active: true,
};

export default function TeamPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Modal de criação/edição
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState<Member | null>(null);
    const [form, setForm] = useState<MemberFormData>(emptyForm);
    const [submitting, setSubmitting] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // Modal de confirmação de desativação
    const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null);
    const [deactivating, setDeactivating] = useState(false);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { fetchMembers(); }, []);

    async function fetchMembers() {
        setLoading(true);
        try {
            const res = await fetch('/api/team');
            const json = await res.json();
            if (res.ok) setMembers(json.data?.members ?? []);
        } catch {
            showAlert('error', 'Erro ao carregar equipe');
        } finally {
            setLoading(false);
        }
    }

    function showAlert(type: 'success' | 'error', message: string) {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 4000);
    }

    function openCreate() {
        setEditingMember(null);
        setForm(emptyForm);
        setShowPassword(false);
        setModalOpen(true);
    }

    function openEdit(member: Member) {
        setEditingMember(member);
        setForm({
            full_name: member.full_name,
            email: member.email,
            phone: member.phone ?? '',
            role: member.role,
            password: '',
            is_active: member.is_active,
        });
        setShowPassword(false);
        setModalOpen(true);
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (editingMember) {
                // Edição
                const body: Record<string, unknown> = {
                    full_name: form.full_name,
                    phone: form.phone,
                    role: form.role,
                    is_active: form.is_active,
                };
                if (form.password) body.password = form.password;

                const res = await fetch(`/api/team/${editingMember.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const json = await res.json();
                if (res.ok) {
                    showAlert('success', 'Membro atualizado com sucesso!');
                    setModalOpen(false);
                    fetchMembers();
                } else {
                    showAlert('error', json.error || 'Erro ao atualizar membro');
                }
            } else {
                // Criação
                const res = await fetch('/api/team', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form),
                });
                const json = await res.json();
                if (res.ok) {
                    showAlert('success', 'Membro cadastrado com sucesso!');
                    setModalOpen(false);
                    fetchMembers();
                } else {
                    showAlert('error', json.error || 'Erro ao cadastrar membro');
                }
            }
        } catch {
            showAlert('error', 'Erro de conexão');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleDeactivate() {
        if (!deactivateTarget) return;
        setDeactivating(true);
        try {
            const res = await fetch(`/api/team/${deactivateTarget.id}`, { method: 'DELETE' });
            const json = await res.json();
            if (res.ok) {
                showAlert('success', 'Membro desativado com sucesso');
                setDeactivateTarget(null);
                fetchMembers();
            } else {
                showAlert('error', json.error || 'Erro ao desativar membro');
            }
        } catch {
            showAlert('error', 'Erro de conexão');
        } finally {
            setDeactivating(false);
        }
    }

    const filtered = members.filter(m => {
        const matchSearch = !search ||
            m.full_name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase());
        const matchRole = !filterRole || m.role === filterRole;
        return matchSearch && matchRole;
    });

    const activeCount = members.filter(m => m.is_active).length;
    const interviewerCount = members.filter(m => m.role === 'interviewer').length;

    return (
        <div className="p-4 sm:p-6">
            {/* Cabeçalho */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Equipe</h1>
                        <p className="text-sm text-slate-500">Gerencie os profissionais da sua empresa</p>
                    </div>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-medium text-sm transition-colors"
                >
                    <UserPlus className="w-4 h-4" />
                    Novo Membro
                </button>
            </div>

            {/* Alerta */}
            {alert && (
                <div className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${alert.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    {alert.type === 'success'
                        ? <CheckCircle className="w-4 h-4 shrink-0" />
                        : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {alert.message}
                </div>
            )}

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                    { label: 'Total', value: members.length, color: 'text-slate-800' },
                    { label: 'Ativos', value: activeCount, color: 'text-green-600' },
                    { label: 'Entrevistadores', value: interviewerCount, color: 'text-blue-600' },
                    { label: 'Inativos', value: members.length - activeCount, color: 'text-slate-400' },
                ].map(card => (
                    <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-4">
                        <p className="text-xs text-slate-500 mb-1">{card.label}</p>
                        <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                    </div>
                ))}
            </div>

            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou e-mail..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <select
                    aria-label="Filtrar por cargo"
                    value={filterRole}
                    onChange={e => setFilterRole(e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                    <option value="">Todos os cargos</option>
                    {Object.entries(ROLES).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>

            {/* Tabela */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Nome</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Cargo</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Telefone</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Último acesso</th>
                            <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                            <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                                </td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                                    {members.length === 0 ? 'Nenhum membro cadastrado ainda' : 'Nenhum resultado encontrado'}
                                </td>
                            </tr>
                        ) : filtered.map(member => (
                            <tr key={member.id} className={`hover:bg-slate-50 transition-colors ${!member.is_active ? 'opacity-50' : ''}`}>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs shrink-0">
                                            {member.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-900">{member.full_name}</p>
                                            <p className="text-xs text-slate-500">{member.email}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLES[member.role]?.color ?? 'bg-slate-100 text-slate-700'}`}>
                                        {ROLES[member.role]?.label ?? member.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 hidden md:table-cell">
                                    {member.phone ?? '—'}
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-500 hidden lg:table-cell">
                                    {formatDate(member.last_login_at)}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${member.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                                        }`}>
                                        <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                                        {member.is_active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => openEdit(member)}
                                            title="Editar"
                                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        {member.is_active && (
                                            <button
                                                onClick={() => setDeactivateTarget(member)}
                                                title="Desativar"
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <UserX className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ===== MODAL Criar/Editar ===== */}
            {modalOpen && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
                        <div className="flex items-center justify-between p-6 border-b border-slate-200">
                            <div className="flex items-center gap-2">
                                {editingMember ? <Pencil className="w-5 h-5 text-blue-600" /> : <UserPlus className="w-5 h-5 text-blue-600" />}
                                <h2 className="font-semibold text-slate-900">
                                    {editingMember ? 'Editar Membro' : 'Novo Membro da Equipe'}
                                </h2>
                            </div>
                            <button onClick={() => setModalOpen(false)} aria-label="Fechar modal" className="text-slate-400 hover:text-slate-600 p-1">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Nome completo <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.full_name}
                                    onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Nome completo do profissional"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        E-mail <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        disabled={!!editingMember}
                                        value={form.email}
                                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                                        placeholder="email@empresa.com"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                    <input
                                        type="text"
                                        value={form.phone}
                                        onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                                        maxLength={16}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="(00) 90000-0000"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Cargo <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        aria-label="Cargo"
                                        required
                                        value={form.role}
                                        onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        {Object.entries(ROLES).map(([key, { label }]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                {editingMember && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                                        <select
                                            aria-label="Status do membro"
                                            value={form.is_active ? 'true' : 'false'}
                                            onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'true' }))}
                                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                        >
                                            <option value="true">Ativo</option>
                                            <option value="false">Inativo</option>
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    {editingMember ? 'Nova Senha (deixe em branco para manter)' : <>Senha de acesso <span className="text-red-500">*</span></>}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        required={!editingMember}
                                        value={form.password}
                                        onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Mínimo 8 caracteres"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(v => !v)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                {form.role === 'interviewer' && (
                                    <p className="mt-1 text-xs text-blue-600 flex items-center gap-1">
                                        <ShieldCheck className="w-3.5 h-3.5" />
                                        Entrevistadores usarão este login no aplicativo móvel
                                    </p>
                                )}
                            </div>

                            <div className="flex justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2 rounded-lg font-medium text-sm transition-colors"
                                >
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingMember ? 'Salvar alterações' : 'Cadastrar membro'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ===== MODAL Confirmação de Desativação ===== */}
            {deactivateTarget && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                                <UserX className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                                <h2 className="font-semibold text-slate-900">Desativar membro?</h2>
                                <p className="text-sm text-slate-500">Esta ação pode ser revertida</p>
                            </div>
                        </div>
                        <p className="text-sm text-slate-600 mb-6">
                            O membro <strong>{deactivateTarget.full_name}</strong> perderá acesso ao sistema imediatamente.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeactivateTarget(null)}
                                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDeactivate}
                                disabled={deactivating}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                            >
                                {deactivating && <Loader2 className="w-4 h-4 animate-spin" />}
                                Desativar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
