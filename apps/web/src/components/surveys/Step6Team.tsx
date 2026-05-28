'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface TeamMember {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
}

type SelectedMember = {
    userId: string;
    role: 'coordinator' | 'supervisor' | 'interviewer';
};

interface Props {
    surveyId?: string;
}

const ROLE_OPTIONS: Array<{ value: SelectedMember['role']; label: string }> = [
    { value: 'coordinator', label: 'Coordenador' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'interviewer', label: 'Entrevistador' },
];

function mapRole(raw: string): SelectedMember['role'] {
    if (raw.includes('supervisor')) return 'supervisor';
    if (raw.includes('coordinator')) return 'coordinator';
    return 'interviewer';
}

export function Step6Team({ surveyId, initialTeamUserIds }: Props & { initialTeamUserIds?: string[] }) {
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [selected, setSelected] = useState<Record<string, SelectedMember['role']>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!surveyId) {
            // Stronger handoff from planning: show preview of suggested team even before first save
            if (initialTeamUserIds && initialTeamUserIds.length > 0) {
                // We can't know full member objects without /api/team, but we can show a hint banner below
            }
            return;
        }

        const load = async () => {
            setLoading(true);
            setMessage(null);
            try {
                const [allMembersRes, selectedRes] = await Promise.all([
                    fetch('/api/team'),
                    fetch(`/api/surveys/${surveyId}/team`),
                ]);

                const allMembersJson = await allMembersRes.json();
                const selectedJson = await selectedRes.json();

                setMembers(allMembersJson.data?.members ?? []);

                const fromApi = (selectedJson.data?.members ?? []) as Array<{
                    user_id: string;
                    role: SelectedMember['role'];
                }>;

                const selectedMap: Record<string, SelectedMember['role']> = {};
                fromApi.forEach((member) => {
                    selectedMap[member.user_id] = member.role;
                });
                setSelected(selectedMap);
            } catch {
                setMessage('Nao foi possivel carregar a equipe.');
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [surveyId, initialTeamUserIds]);

    const selectedCount = useMemo(() => Object.keys(selected).length, [selected]);
    const interviewerCount = useMemo(
        () => Object.values(selected).filter((role) => role === 'interviewer').length,
        [selected],
    );

    const toggleMember = (member: TeamMember) => {
        setSelected((prev) => {
            const next = { ...prev };
            if (next[member.id]) {
                delete next[member.id];
            } else {
                next[member.id] = mapRole(member.role);
            }
            return next;
        });
    };

    const updateRole = (userId: string, role: SelectedMember['role']) => {
        setSelected((prev) => ({ ...prev, [userId]: role }));
    };

    const save = async () => {
        if (!surveyId) return;
        if (interviewerCount < 1) {
            setMessage('Selecione ao menos um entrevistador para avancar.');
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const membros = Object.entries(selected).map(([userId, role]) => ({
                usuario_id: userId,
                papel: role,
            }));

            const res = await fetch(`/api/surveys/${surveyId}/team`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ membros }),
            });

            const json = await res.json();
            if (!res.ok) {
                setMessage(json.error ?? 'Falha ao salvar equipe.');
                return;
            }

            setMessage('Equipe salva com sucesso.');
        } catch {
            setMessage('Falha de conexao ao salvar equipe.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-900">Etapa 6 — Composicao da Equipe</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Selecione os membros pre-cadastrados da organizacao e defina o papel de cada um nesta pesquisa.
                </p>
            </div>

            {!surveyId && initialTeamUserIds && initialTeamUserIds.length > 0 && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    <strong>Equipe sugerida pelo Planejamento 5 passos:</strong> {initialTeamUserIds.length} entrevistador(es) serão adicionados automaticamente ao salvar ou publicar esta pesquisa (cotas por entrevistador também serão aplicadas).
                </div>
            )}
            {!surveyId && (!initialTeamUserIds || initialTeamUserIds.length === 0) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Salve o rascunho para vincular equipe a esta pesquisa.
                </div>
            )}

            {surveyId && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            Membros selecionados: <strong>{selectedCount}</strong>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                            Entrevistadores: <strong>{interviewerCount}</strong>
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 text-slate-500 text-sm">
                            <RefreshCw size={16} className="animate-spin" />
                            Carregando membros...
                        </div>
                    ) : (
                        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                            {members.map((member) => {
                                const checked = Boolean(selected[member.id]);
                                const selectedRole = selected[member.id] ?? mapRole(member.role);

                                return (
                                    <div key={member.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                        <label className="flex items-center gap-3 flex-1 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={checked}
                                                onChange={() => toggleMember(member)}
                                                className="accent-blue-600"
                                            />
                                            <span>
                                                <span className="block text-sm font-medium text-slate-800">{member.full_name}</span>
                                                <span className="block text-xs text-slate-500">{member.email}</span>
                                            </span>
                                        </label>

                                        <select
                                            value={selectedRole}
                                            onChange={(event) => updateRole(member.id, event.target.value as SelectedMember['role'])}
                                            disabled={!checked}
                                            aria-label={`Papel de ${member.full_name}`}
                                            title={`Papel de ${member.full_name}`}
                                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
                                        >
                                            {ROLE_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={save}
                            disabled={saving}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-70"
                        >
                            {saving ? 'Salvando...' : 'Salvar Equipe'}
                        </button>
                        {message && <span className="text-sm text-slate-600">{message}</span>}
                    </div>
                </>
            )}
        </div>
    );
}
