'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, CheckCircle2, PauseCircle, RefreshCw, AlertCircle, ChevronRight, Plus } from 'lucide-react';

type SurveyStatus = 'draft' | 'active' | 'paused' | 'closed';

interface Survey {
    id: string;
    title: string;
    status: SurveyStatus;
    survey_type: string | null;
    total_interviews: number | null;
    margin_of_error: number | null;
    confidence_interval: number | null;
    started_at: string | null;
    ended_at: string | null;
    created_at: string;
    updated_at: string;
}

const STATUS_CONFIG: Record<SurveyStatus, { label: string; color: string; bg: string }> = {
    draft: { label: 'Rascunho', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    active: { label: 'Em andamento', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    paused: { label: 'Pausada', color: 'text-slate-600', bg: 'bg-slate-50 border-slate-200' },
    closed: { label: 'Encerrada', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
};

const STATUS_ICONS: Record<SurveyStatus, React.ReactNode> = {
    draft: <Clock size={13} />,
    active: <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />,
    paused: <PauseCircle size={13} />,
    closed: <CheckCircle2 size={13} />,
};

const SURVEY_TYPE_LABELS: Record<string, string> = {
    eleitoral: 'Eleitoral',
    opiniao_publica: 'Opinião Pública',
    satisfacao: 'Satisfação',
    avaliacao_servicos: 'Avaliação de Serviços',
    mercado_quantitativa: 'Mercado',
    censo: 'Censo',
    qualitativa_grupo_focal: 'Grupo Focal',
    qualitativa_profundidade: 'Qualitativa',
    quali_quanti: 'Mista',
    outros: 'Outros',
};

function formatDate(d: string | null) {
    if (!d) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
}

export default function SurveysPage() {
    const [surveys, setSurveys] = useState<Survey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState<SurveyStatus | 'all'>('all');

    useEffect(() => { load(); }, []);

    async function load() {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/surveys');
            const json = await res.json();
            if (res.ok) setSurveys(json.data?.surveys ?? []);
            else setError('Não foi possível carregar as pesquisas.');
        } catch {
            setError('Erro de conexão.');
        } finally {
            setLoading(false);
        }
    }

    const filtered = filter === 'all' ? surveys : surveys.filter(s => s.status === filter);

    const counts: Record<string, number> = {
        all: surveys.length,
        draft: surveys.filter(s => s.status === 'draft').length,
        active: surveys.filter(s => s.status === 'active').length,
        paused: surveys.filter(s => s.status === 'paused').length,
        closed: surveys.filter(s => s.status === 'closed').length,
    };

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Pesquisas</h1>
                    <p className="text-sm text-slate-500 mt-0.5">Gerencie todas as pesquisas do seu tenant.</p>
                </div>
                <Link
                    href="/surveys/new"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition text-sm"
                >
                    <Plus size={16} />
                    Nova Pesquisa
                </Link>
            </div>

            {/* Filtros de status */}
            <div className="flex gap-2 mb-5 flex-wrap">
                {([
                    { key: 'all', label: 'Todas' },
                    { key: 'draft', label: 'Rascunho' },
                    { key: 'active', label: 'Em andamento' },
                    { key: 'paused', label: 'Pausada' },
                    { key: 'closed', label: 'Encerrada' },
                ] as { key: SurveyStatus | 'all'; label: string }[]).map(({ key, label }) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter === key
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400 hover:text-blue-700'
                            }`}
                    >
                        {label}
                        {counts[key] > 0 && (
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${filter === key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}>
                                {counts[key]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading && (
                <div className="flex items-center justify-center h-48 gap-3 text-slate-400">
                    <RefreshCw size={20} className="animate-spin" />
                    <span className="text-sm">Carregando pesquisas...</span>
                </div>
            )}

            {!loading && error && (
                <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-500">
                    <AlertCircle size={24} className="text-red-400" />
                    <p className="text-sm">{error}</p>
                    <button onClick={load} className="text-blue-600 text-sm hover:underline">Tentar novamente</button>
                </div>
            )}

            {!loading && !error && (
                <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
                    {filtered.length === 0 ? (
                        <div className="px-6 py-16 text-center text-slate-400">
                            <p className="text-base font-medium mb-1">
                                {filter === 'all' ? 'Nenhuma pesquisa criada ainda' : `Nenhuma pesquisa com status "${STATUS_CONFIG[filter as SurveyStatus]?.label ?? filter}"`}
                            </p>
                            {filter === 'all' && (
                                <p className="text-sm">
                                    <Link href="/surveys/new" className="text-blue-600 hover:underline">Criar a primeira pesquisa</Link>
                                </p>
                            )}
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-500">Título</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-500">Status</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-500 hidden sm:table-cell">Tipo</th>
                                    <th className="text-right px-5 py-3 font-semibold text-slate-500 hidden md:table-cell">Entrevistas</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-500 hidden lg:table-cell">Período</th>
                                    <th className="text-left px-5 py-3 font-semibold text-slate-500 hidden lg:table-cell">Criada em</th>
                                    <th className="px-5 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.map(s => {
                                    const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft;
                                    const href = s.status === 'draft'
                                        ? `/surveys/new?draft=${s.id}`
                                        : `/surveys/${s.id}/monitor`;
                                    return (
                                        <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3.5 font-medium text-slate-800 max-w-xs truncate">
                                                <Link href={href} className="hover:text-blue-600 transition-colors">
                                                    {s.title}
                                                </Link>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>
                                                    {STATUS_ICONS[s.status]}
                                                    {cfg.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500 hidden sm:table-cell">
                                                {s.survey_type ? (SURVEY_TYPE_LABELS[s.survey_type] ?? s.survey_type) : '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-slate-700 hidden md:table-cell">
                                                {s.total_interviews?.toLocaleString('pt-BR') ?? '—'}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500 hidden lg:table-cell text-xs">
                                                {formatDate(s.started_at)} → {formatDate(s.ended_at)}
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-400 hidden lg:table-cell text-xs">
                                                {formatDate(s.created_at)}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <Link href={href} className="text-slate-300 hover:text-blue-500 transition-colors">
                                                    <ChevronRight size={16} />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
}

