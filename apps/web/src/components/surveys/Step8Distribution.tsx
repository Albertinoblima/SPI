'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

interface DistributionRow {
    interviewer_id: string;
    locality_id: string;
    zone: string;
    gender: string;
    age_group: string;
    quota_total: number;
    users?: { full_name?: string };
    survey_localities?: { name?: string };
}

interface Props {
    surveyId?: string;
}

export function Step8Distribution({ surveyId }: Props) {
    const [rows, setRows] = useState<DistributionRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');
    const [publishing, setPublishing] = useState(false);

    const load = async () => {
        if (!surveyId) return;
        setLoading(true);
        try {
            const res = await fetch(`/api/surveys/${surveyId}/distribution`);
            const json = await res.json();
            setRows(json.data?.distribution ?? []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, [surveyId]);

    const grouped = useMemo(() => {
        const map = new Map<string, DistributionRow[]>();
        rows.forEach((row) => {
            const key = row.interviewer_id;
            const list = map.get(key) ?? [];
            list.push(row);
            map.set(key, list);
        });
        return map;
    }, [rows]);

    const redistribute = async () => {
        if (!surveyId) return;
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/surveys/${surveyId}/distribution`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({}),
            });
            const json = await res.json();
            if (!res.ok) {
                setMessage(json.error ?? 'Falha ao redistribuir cotas.');
                return;
            }
            setMessage('Distribuicao recalculada com sucesso.');
            await load();
        } catch {
            setMessage('Falha de conexao ao redistribuir cotas.');
        } finally {
            setLoading(false);
        }
    };

    const publish = async () => {
        if (!surveyId) return;
        setPublishing(true);
        setMessage(null);
        try {
            const res = await fetch(`/api/surveys/${surveyId}/publish`, { method: 'POST' });
            const json = await res.json();
            if (!res.ok) {
                setMessage(json.error ?? 'Falha ao publicar pesquisa.');
                return;
            }
            setMessage('Pesquisa publicada e equipe notificada.');
        } catch {
            setMessage('Falha de conexao ao publicar.');
        } finally {
            setPublishing(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-900">Etapa 8 — Distribuicao da Pesquisa</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Visualize a distribuicao proporcional de cotas por entrevistador, gere os controles de campo e publique a pesquisa.
                </p>
            </div>

            {!surveyId && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Salve o rascunho para habilitar distribuicao e publicacao.
                </div>
            )}

            {surveyId && (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="distribution-period-start" className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Periodo inicio</label>
                            <input
                                id="distribution-period-start"
                                type="date"
                                value={periodStart}
                                onChange={(event) => setPeriodStart(event.target.value)}
                                aria-label="Periodo inicio"
                                title="Periodo inicio"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label htmlFor="distribution-period-end" className="block text-xs uppercase tracking-wide text-slate-500 mb-1">Periodo fim</label>
                            <input
                                id="distribution-period-end"
                                type="date"
                                value={periodEnd}
                                onChange={(event) => setPeriodEnd(event.target.value)}
                                aria-label="Periodo fim"
                                title="Periodo fim"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={redistribute}
                            disabled={loading}
                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-70"
                        >
                            {loading ? 'Calculando...' : 'Redistribuir'}
                        </button>

                        <a
                            href={`/api/surveys/${surveyId}/distribution/download?format=pdf`}
                            className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Download PDF
                        </a>

                        <a
                            href={`/api/surveys/${surveyId}/distribution/download?format=docx`}
                            className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                        >
                            Download DOCX
                        </a>

                        <button
                            type="button"
                            onClick={publish}
                            disabled={publishing}
                            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-70"
                        >
                            {publishing ? 'Publicando...' : 'Finalizar e Publicar Pesquisa'}
                        </button>
                    </div>

                    {loading && (
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                            <RefreshCw size={16} className="animate-spin" />
                            Carregando distribuicao...
                        </div>
                    )}

                    <div className="space-y-4">
                        {Array.from(grouped.entries()).map(([interviewerId, records], idx) => {
                            const interviewerName = records[0]?.users?.full_name || `Entrevistador ${idx + 1}`;
                            const total = records.reduce((sum, row) => sum + Number(row.quota_total || 0), 0);

                            return (
                                <div key={interviewerId} className="rounded-xl border border-slate-200 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="font-semibold text-slate-800">{interviewerName}</h3>
                                        <span className="text-sm text-slate-500">Total: {total}</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-slate-500 border-b border-slate-200">
                                                    <th className="py-2 pr-3">Localidade</th>
                                                    <th className="py-2 pr-3">Zona</th>
                                                    <th className="py-2 pr-3">Genero</th>
                                                    <th className="py-2 pr-3">Faixa</th>
                                                    <th className="py-2 pr-3 text-right">Cota</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {records.map((row, index) => (
                                                    <tr key={`${row.locality_id}-${row.gender}-${row.age_group}-${index}`} className="border-b border-slate-100">
                                                        <td className="py-2 pr-3">{row.survey_localities?.name || '-'}</td>
                                                        <td className="py-2 pr-3">{row.zone}</td>
                                                        <td className="py-2 pr-3">{row.gender}</td>
                                                        <td className="py-2 pr-3">{row.age_group}</td>
                                                        <td className="py-2 pr-3 text-right">{row.quota_total}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            );
                        })}

                        {!loading && rows.length === 0 && (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                Nenhuma distribuicao gerada ainda. Clique em Redistribuir.
                            </div>
                        )}
                    </div>

                    {message && <div className="text-sm text-slate-600">{message}</div>}
                </>
            )}
        </div>
    );
}
