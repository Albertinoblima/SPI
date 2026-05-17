'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ClipboardList,
    Users,
    TrendingUp,
    Clock,
    CheckCircle2,
    PauseCircle,
    AlertCircle,
    Plus,
    ArrowRight,
    BarChart3,
    ChevronRight,
    Sparkles,
    FileSearch,
    RefreshCw,
    Trash2,
} from 'lucide-react';

type SurveyStatus = 'draft' | 'active' | 'paused' | 'closed';

interface Survey {
    id: string;
    title: string;
    status: SurveyStatus;
    survey_type: string | null;
    total_interviews: number | null;
    created_at: string;
    started_at: string | null;
    ended_at: string | null;
}

interface Metrics {
    total_surveys: number;
    active_surveys: number;
    draft_surveys: number;
    closed_surveys: number;
    total_team: number;
    active_team: number;
    interviewers: number;
}

interface Tenant {
    name: string;
    logo_url: string | null;
    max_surveys: number;
    max_users: number;
    status: string;
    city: string | null;
    state: string | null;
}

interface DashboardData {
    tenant: Tenant | null;
    metrics: Metrics;
    surveys: Survey[];
    onboarding_complete: boolean;
}

const STATUS_CONFIG: Record<SurveyStatus, {
    label: string;
    color: string;
    bg: string;
    icon: React.FC<{ className?: string }>;
}> = {
    active: {
        label: 'Em andamento',
        color: 'text-emerald-700',
        bg: 'bg-emerald-50 border-emerald-200',
        icon: ({ className }) => (
            <span className={`inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse ${className ?? ''}`} />
        ),
    },
    draft: {
        label: 'Rascunho',
        color: 'text-amber-700',
        bg: 'bg-amber-50 border-amber-200',
        icon: ({ className }) => <Clock className={className} />,
    },
    paused: {
        label: 'Pausada',
        color: 'text-slate-600',
        bg: 'bg-slate-50 border-slate-200',
        icon: ({ className }) => <PauseCircle className={className} />,
    },
    closed: {
        label: 'Encerrada',
        color: 'text-blue-700',
        bg: 'bg-blue-50 border-blue-200',
        icon: ({ className }) => <CheckCircle2 className={className} />,
    },
};

const SURVEY_TYPE_LABELS: Record<string, string> = {
    eleitoral: 'Eleitoral',
    satisfacao: 'Satisfação',
    opiniao: 'Opinião Pública',
    censo: 'Censo',
    avaliacao: 'Avaliação de Serviços',
    outros: 'Outros',
};

function formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(dateStr));
}

function getSurveyHref(survey: Survey) {
    return survey.status === 'draft'
        ? `/surveys/new?draft=${survey.id}`
        : `/surveys/${survey.id}/monitor`;
}

function StatCard({ icon: Icon, label, value, sub, color }: {
    icon: React.FC<{ className?: string }>;
    label: string;
    value: number | string;
    sub?: string;
    color: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 flex items-start gap-4">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
                {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

function SurveyRow({
    survey,
    onDelete,
    isDeleting,
}: {
    survey: Survey;
    onDelete: (survey: Survey) => void;
    isDeleting: boolean;
}) {
    const cfg = STATUS_CONFIG[survey.status];
    const StatusIcon = cfg.icon;
    const href = getSurveyHref(survey);

    return (
        <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0">
            <Link href={href} className="group flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${cfg.bg}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">
                        {survey.title}
                    </p>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {survey.survey_type && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                                {SURVEY_TYPE_LABELS[survey.survey_type] ?? survey.survey_type}
                            </span>
                        )}
                        <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">Criada em {formatDate(survey.created_at)}</span>
                        {survey.ended_at && (
                            <>
                                <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">Encerra {formatDate(survey.ended_at)}</span>
                            </>
                        )}
                    </div>
                </div>

                <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} shrink-0`}>
                    {survey.status === 'active' && <StatusIcon className="w-1.5 h-1.5" />}
                    {cfg.label}
                </span>

                {survey.total_interviews !== null && (
                    <div className="hidden md:flex flex-col items-end shrink-0">
                        <span className="text-sm font-bold text-slate-700">{survey.total_interviews.toLocaleString('pt-BR')}</span>
                        <span className="text-xs text-slate-400">entrevistas</span>
                    </div>
                )}

                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
            </Link>

            {survey.status === 'draft' && (
                <button
                    type="button"
                    onClick={() => onDelete(survey)}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                >
                    {isDeleting
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    {isDeleting ? 'Excluindo...' : 'Excluir'}
                </button>
            )}
        </div>
    );
}

export default function DashboardPage() {
    return (
        <Suspense>
            <DashboardContent />
        </Suspense>
    );
}

function DashboardContent() {
    const searchParams = useSearchParams();
    const showWelcome = searchParams.get('welcome') === '1';

    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [deletingSurveyId, setDeletingSurveyId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<SurveyStatus | 'all'>('all');

    useEffect(() => {
        loadDashboard();
    }, []);

    async function loadDashboard() {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/dashboard');
            const json = await res.json();
            if (res.ok) {
                setData(json.data);
            } else {
                setError('Não foi possível carregar os dados.');
            }
        } catch {
            setError('Erro de conexão com o servidor.');
        } finally {
            setLoading(false);
        }
    }

    async function handleDeleteSurvey(survey: Survey) {
        if (survey.status !== 'draft') {
            setActionFeedback({
                type: 'error',
                message: 'Por segurança institucional, somente pesquisas em rascunho podem ser excluídas.',
            });
            return;
        }

        const confirmed = window.confirm(
            `Excluir a pesquisa "${survey.title}"?\n\nEsta ação remove o rascunho da listagem e não pode ser desfeita pela interface.`
        );
        if (!confirmed) return;

        setDeletingSurveyId(survey.id);
        setActionFeedback(null);
        try {
            const res = await fetch(`/api/surveys/${survey.id}`, { method: 'DELETE' });
            const json = await res.json().catch(() => null);

            if (res.ok) {
                setActionFeedback({ type: 'success', message: 'Pesquisa em rascunho excluída com sucesso.' });
                await loadDashboard();
            } else {
                setActionFeedback({
                    type: 'error',
                    message: json?.error || 'Não foi possível excluir a pesquisa.',
                });
            }
        } catch {
            setActionFeedback({ type: 'error', message: 'Erro de conexão ao excluir pesquisa.' });
        } finally {
            setDeletingSurveyId(null);
        }
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-96 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
                <p className="text-slate-500 dark:text-slate-400 text-sm">Carregando painel...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-96 gap-3">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <p className="text-slate-700 font-medium">{error}</p>
                <button onClick={loadDashboard} className="text-blue-600 text-sm hover:underline">
                    Tentar novamente
                </button>
            </div>
        );
    }

    const { tenant, metrics, surveys } = data!;
    const filteredSurveys = filterStatus === 'all' ? surveys : surveys.filter(s => s.status === filterStatus);
    const activeSurveys = surveys.filter(s => s.status === 'active');

    const greeting = (() => {
        const h = new Date().getHours();
        if (h < 12) return 'Bom dia';
        if (h < 18) return 'Boa tarde';
        return 'Boa noite';
    })();

    return (
        <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
            {showWelcome && (
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl p-5 text-white flex items-center gap-4 shadow-lg">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                        <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="font-bold text-lg">Tudo pronto! Sua empresa está configurada.</p>
                        <p className="text-green-100 text-sm mt-0.5">
                            Agora você pode criar sua primeira pesquisa e começar a coletar dados em campo.
                        </p>
                    </div>
                    <Link
                        href="/surveys/new"
                        className="shrink-0 bg-white text-emerald-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-50 transition"
                    >
                        Criar pesquisa
                    </Link>
                </div>
            )}

            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                        {greeting}{tenant?.name ? `, ${tenant.name}` : ''}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-sm">
                        {new Intl.DateTimeFormat('pt-BR', {
                            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                        }).format(new Date())}
                        {tenant?.city && tenant?.state && (
                            <span className="text-slate-400"> — {tenant.city}/{tenant.state}</span>
                        )}
                    </p>
                </div>
                <Link
                    href="/surveys/new"
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Nova Pesquisa
                </Link>
            </div>

            {actionFeedback && (
                <div
                    className={`rounded-xl border px-4 py-3 text-sm font-medium ${actionFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-800'}`}
                >
                    {actionFeedback.message}
                </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={ClipboardList}
                    label="Total de Pesquisas"
                    value={metrics.total_surveys}
                    sub={`${metrics.active_surveys} em andamento`}
                    color="bg-blue-50 text-blue-600"
                />
                <StatCard
                    icon={TrendingUp}
                    label="Em Andamento"
                    value={metrics.active_surveys}
                    sub={`${metrics.draft_surveys} rascunho${metrics.draft_surveys !== 1 ? 's' : ''}`}
                    color="bg-emerald-50 text-emerald-600"
                />
                <StatCard
                    icon={CheckCircle2}
                    label="Encerradas"
                    value={metrics.closed_surveys}
                    sub="com coleta concluída"
                    color="bg-violet-50 text-violet-600"
                />
                <StatCard
                    icon={Users}
                    label="Equipe Ativa"
                    value={metrics.active_team}
                    sub={`${metrics.interviewers} pesquisador${metrics.interviewers !== 1 ? 'es' : ''} de campo`}
                    color="bg-orange-50 text-orange-600"
                />
            </div>

            {activeSurveys.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                        Em andamento agora
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {activeSurveys.slice(0, 4).map(survey => (
                            <Link
                                key={survey.id}
                                href={getSurveyHref(survey)}
                                className="bg-white dark:bg-slate-800 rounded-xl border border-emerald-200 dark:border-emerald-900 p-5 hover:border-emerald-400 dark:hover:border-emerald-600 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Ativa</span>
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                                </div>
                                <p className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                                    {survey.title}
                                </p>
                                {survey.survey_type && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                        {SURVEY_TYPE_LABELS[survey.survey_type] ?? survey.survey_type}
                                    </p>
                                )}
                                {survey.total_interviews !== null && (
                                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-sm">
                                        <span className="text-slate-500 dark:text-slate-400">Total previsto</span>
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            {survey.total_interviews.toLocaleString('pt-BR')} entrevistas
                                        </span>
                                    </div>
                                )}
                                {survey.ended_at && (
                                    <div className="mt-1 flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                                        <span>Encerra em</span>
                                        <span className="font-medium">{formatDate(survey.ended_at)}</span>
                                    </div>
                                )}
                            </Link>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-slate-400" />
                        <h2 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Todas as pesquisas</h2>
                        <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
                            {surveys.length}
                        </span>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {(['all', 'active', 'draft', 'paused', 'closed'] as const).map(status => (
                            <button
                                key={status}
                                type="button"
                                onClick={() => setFilterStatus(status)}
                                className={`px-3 py-1 rounded-full text-xs font-medium transition
                                    ${filterStatus === status
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                            >
                                {status === 'all' ? 'Todas' : STATUS_CONFIG[status].label}
                            </button>
                        ))}
                    </div>
                </div>

                {filteredSurveys.length > 0 ? (
                    <div>
                        {filteredSurveys.map(survey => (
                            <SurveyRow
                                key={survey.id}
                                survey={survey}
                                onDelete={handleDeleteSurvey}
                                isDeleting={deletingSurveyId === survey.id}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400 dark:text-slate-500 gap-3">
                        <FileSearch className="w-12 h-12 text-slate-200 dark:text-slate-700" />
                        {filterStatus === 'all' ? (
                            <>
                                <p className="font-medium text-slate-600 dark:text-slate-400">Nenhuma pesquisa criada ainda</p>
                                <p className="text-sm">Comece criando sua primeira pesquisa de campo</p>
                                <Link
                                    href="/surveys/new"
                                    className="mt-2 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition"
                                >
                                    <Plus className="w-4 h-4" />
                                    Criar primeira pesquisa
                                </Link>
                            </>
                        ) : (
                            <p className="text-sm">
                                Nenhuma pesquisa com status{' '}
                                <strong>{STATUS_CONFIG[filterStatus as SurveyStatus].label}</strong>
                            </p>
                        )}
                    </div>
                )}
            </div>

            <div>
                <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                    Acesso rápido
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Link
                        href="/surveys/new"
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all flex items-center gap-4"
                    >
                        <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shrink-0">
                            <Plus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Nova Pesquisa</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Iniciar wizard de criação</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                    </Link>

                    <Link
                        href="/team"
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all flex items-center gap-4"
                    >
                        <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center shrink-0">
                            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Gerenciar Equipe</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                {metrics.active_team} membro{metrics.active_team !== 1 ? 's' : ''} ativo{metrics.active_team !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                    </Link>

                    <Link
                        href="/settings"
                        className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all flex items-center gap-4"
                    >
                        <div className="w-10 h-10 bg-slate-50 dark:bg-slate-700 rounded-xl flex items-center justify-center shrink-0">
                            <BarChart3 className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Configurações</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Dados da empresa e plano</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 ml-auto" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
