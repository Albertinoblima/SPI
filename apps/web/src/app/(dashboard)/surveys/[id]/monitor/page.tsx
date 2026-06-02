'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Construction,
    BarChart3,
    MapPin,
    Users,
    ClipboardList,
    TrendingUp,
    Bell,
    Settings2,
    HelpCircle,
} from 'lucide-react';
import { HelpAssistant } from '@/components/help/HelpAssistant';
import { reportClientError } from '@/lib/monitoring/reportClientError';

const COMING_SOON_FEATURES = [
    {
        icon: BarChart3,
        title: 'Painel de Progresso',
        description: 'Acompanhe em tempo real o percentual de entrevistas concluídas por localidade, pesquisador e período.',
        color: 'text-blue-600 bg-blue-50',
    },
    {
        icon: MapPin,
        title: 'Mapa de Coleta',
        description: 'Visualize a distribuição geográfica das entrevistas realizadas com mapa interativo e clusters.',
        color: 'text-emerald-600 bg-emerald-50',
    },
    {
        icon: Users,
        title: 'Desempenho da Equipe',
        description: 'Ranking de pesquisadores por produtividade, tempo médio de entrevista e taxa de qualidade.',
        color: 'text-violet-600 bg-violet-50',
    },
    {
        icon: ClipboardList,
        title: 'Respostas em Tempo Real',
        description: 'Tabela com todas as entrevistas registradas, filtros por localidade, data e status de validação.',
        color: 'text-orange-600 bg-orange-50',
    },
    {
        icon: TrendingUp,
        title: 'Análise de Resultados',
        description: 'Gráficos de barras, pizza e tendência para cada pergunta do questionário com exportação PDF.',
        color: 'text-rose-600 bg-rose-50',
    },
    {
        icon: Bell,
        title: 'Alertas e Notificações',
        description: 'Receba alertas quando metas de cota forem atingidas, quando houver inconsistências ou a pesquisa estiver próxima do prazo.',
        color: 'text-amber-600 bg-amber-50',
    },
];

export default function SurveyMonitorPage() {
    const { id } = useParams<{ id: string }>();

    return (
        <div className="min-h-[100dvh] bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 text-sm transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Voltar ao Início
                    </Link>
                    <span className="text-slate-300">/</span>
                    <span className="text-slate-600 text-sm font-medium truncate">Monitoramento da Pesquisa</span>
                    <span className="text-xs text-slate-400 font-mono bg-slate-100 px-2 py-0.5 rounded ml-auto hidden sm:block">
                        ID: {id}
                    </span>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
                {/* Badge em desenvolvimento + Acesso rápido a Relatórios */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-8">
                    <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-800 border border-amber-200 px-4 py-2 rounded-full text-sm font-semibold">
                        <Construction className="w-4 h-4" />
                        Módulo em desenvolvimento
                    </div>

                    <div className="flex items-center gap-2">
                        <Link
                            href={`/dashboard/surveys/${id}/dynamic-report`}
                            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-indigo-200 text-indigo-700 rounded-lg hover:bg-indigo-50 transition"
                        >
                            📈 Dinâmico
                        </Link>
                        <Link
                            href={`/dashboard/surveys/${id}/reports`}
                            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-50 transition"
                        >
                            📊 Físicos
                        </Link>
                    </div>
                </div>

                {/* Evolução do Suporte: Ajuda contextual sobre o fluxo de cotas (ponta a ponta) */}
                <div className="max-w-3xl mx-auto mb-10 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-emerald-700">
                        <HelpCircle className="w-4 h-4" />
                        Entenda como as cotas por entrevistador funcionam aqui
                    </div>
                    <HelpAssistant
                        context="mobile-collection"
                        compact
                        onStillNeedHelp={() => { }}
                        onTrackHelpful={(topic) => {
                            reportClientError({
                                errorCode: 'HELP_TOPIC_MARKED_HELPFUL',
                                errorMessage: `Artigo útil (mobile/collection): ${topic.title}`,
                                severity: 'low',
                                metadata: { topicId: topic.id, category: topic.category, context: 'mobile-collection' }
                            });
                        }}
                    />
                </div>

                {/* Título */}
                <div className="text-center mb-12">
                    <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                        <BarChart3 className="w-10 h-10 text-blue-600" />
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                        Central de Monitoramento
                    </h1>
                    <p className="text-slate-500 text-lg max-w-xl mx-auto leading-relaxed">
                        Esta tela permitirá o acompanhamento completo da pesquisa em tempo real —
                        do progresso das entrevistas até a análise dos resultados.
                    </p>
                </div>

                {/* Grid de funcionalidades */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
                    {COMING_SOON_FEATURES.map((feature) => {
                        const Icon = feature.icon;
                        return (
                            <div
                                key={feature.title}
                                className="bg-white rounded-xl border border-slate-200 p-5 flex gap-4"
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${feature.color}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-slate-800 text-sm mb-1">{feature.title}</h3>
                                    <p className="text-xs text-slate-500 leading-relaxed">{feature.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* CTA */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 sm:p-8 text-white text-center">
                    <Settings2 className="w-8 h-8 mx-auto mb-3 text-blue-200" />
                    <h2 className="text-xl font-bold mb-2">Enquanto isso, configure sua pesquisa</h2>
                    <p className="text-blue-100 text-sm mb-6 max-w-md mx-auto">
                        Continue editando o questionário, as localidades e as premissas da pesquisa.
                        A central de monitoramento estará disponível quando a coleta começar.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href={`/surveys/${id}`}
                            className="bg-white text-blue-700 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-50 transition"
                        >
                            Editar Questionário
                        </Link>
                        <Link
                            href="/surveys"
                            className="bg-blue-500 hover:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition"
                        >
                            Ver Todas as Pesquisas
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
