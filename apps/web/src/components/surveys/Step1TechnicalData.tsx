'use client';

import { HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';
import { StatisticsCalculator, type SamplingStats } from './StatisticsCalculator';

export interface SurveyTechData {
    title: string;
    description: string;
    survey_type: string;
    // ── Estatísticas amostrais ──
    margin_of_error: number;
    confidence_interval: number;
    total_interviews: number;
    population_size: number | null;
    deff: number;
    p_proportion: number;
    stats_mode: 'auto' | 'manual';
    // ── Demais campos ──
    objective: string;
    methodology: string;
    target_audience: string;
    is_registered_research: boolean;
    registered_responsible_name: string;
    registered_responsible_registry: string;
    registered_responsible_body: string;
    requires_geolocation: boolean;
    requires_photo: boolean;
    requires_signature: boolean;
    allow_offline: boolean;
    started_at: string;
    ended_at: string;
}

interface Props {
    data: SurveyTechData;
    onChange: (data: SurveyTechData) => void;
}

function Tooltip({ text, helpId }: { text: string; helpId?: string }) {
    const topic = helpId ? HELP_TOPICS_BY_ID[helpId] : undefined;
    const href = topic ? `/help?q=${encodeURIComponent(topic.title)}#${topic.id}` : '/help';

    const handleMouseEnter = () => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(HELP_HOVER_EVENT, {
            detail: {
                id: topic?.id,
                title: topic?.title ?? 'Ajuda rapida',
                text: topic?.short ?? text,
                href,
            },
        }));
    };

    return (
        <span className="relative group inline-flex items-center ml-1.5" onMouseEnter={handleMouseEnter}>
            <HelpCircle size={15} className="text-slate-400 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                <span>{text}</span>
                <span className="mt-2 block">
                    <Link href={href} className="text-blue-200 underline underline-offset-2 hover:text-white">
                        Saber mais...
                    </Link>
                </span>
            </span>
        </span>
    );
}

function Label({ htmlFor, children, tooltip }: { htmlFor: string; children: React.ReactNode; tooltip?: string }) {
    const helpByField: Record<string, string> = {
        title: 'survey-title',
        survey_type: 'survey-type',
        target_audience: 'target-audience',
        margin_of_error: 'margin-error',
        confidence_interval: 'confidence-interval',
        started_at: 'survey-period',
        ended_at: 'survey-period',
        objective: 'survey-objective',
        methodology: 'survey-methodology',
        description: 'survey-internal-notes',
    };

    return (
        <label htmlFor={htmlFor} className="flex items-center text-sm font-medium text-slate-700 mb-1.5">
            {children}
            {tooltip && <Tooltip text={tooltip} helpId={helpByField[htmlFor]} />}
        </label>
    );
}

function Field({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col">{children}</div>;
}

const SURVEY_TYPE_OPTIONS = [
    { value: 'eleitoral', label: 'Eleitoral (quantitativa amostral)' },
    { value: 'opiniao_publica', label: 'Opinião pública (quantitativa amostral)' },
    { value: 'satisfacao', label: 'Satisfação com gestão/serviço (quantitativa amostral)' },
    { value: 'avaliacao_servicos', label: 'Avaliação de serviços (quantitativa amostral)' },
    { value: 'mercado_quantitativa', label: 'Mercado e consumo (quantitativa amostral)' },
    { value: 'censo', label: 'Censo / cadastro (cobertura total)' },
    { value: 'qualitativa_grupo_focal', label: 'Qualitativa - Grupo focal' },
    { value: 'qualitativa_profundidade', label: 'Qualitativa - Entrevista em profundidade' },
    { value: 'quali_quanti', label: 'Mista (quali-quanti)' },
    { value: 'outros', label: 'Outros' },
];

export function shouldUseStatisticalSampling(surveyType: string): boolean {
    return ['eleitoral', 'opiniao_publica', 'satisfacao', 'avaliacao_servicos', 'mercado_quantitativa'].includes(surveyType);
}

function getMethodologyHint(surveyType: string): string {
    if (shouldUseStatisticalSampling(surveyType)) {
        return 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.';
    }
    if (surveyType === 'censo') {
        return 'Levantamento censitário: cobertura total do universo. A quantidade por localidade deve ser definida manualmente.';
    }
    if (surveyType === 'qualitativa_grupo_focal' || surveyType === 'qualitativa_profundidade') {
        return 'Pesquisa qualitativa: não utiliza margem de erro estatística. Defina metas de entrevistas por critério técnico na etapa de localidades.';
    }
    if (surveyType === 'quali_quanti') {
        return 'Pesquisa mista: use amostragem apenas na fase quantitativa. Metas qualitativas devem ser definidas manualmente.';
    }
    return 'Defina o tipo para habilitar recomendações metodológicas e regras automáticas de amostragem.';
}

export function Step1TechnicalData({ data, onChange }: Props) {
    const set = (key: keyof SurveyTechData, value: string | number | boolean) =>
        onChange({ ...data, [key]: value });
    const usesSampling = shouldUseStatisticalSampling(data.survey_type);

    return (
        <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 1 — Dados Técnicos e Metodologia</h2>
            <p className="text-sm text-slate-500 mb-6">
                Informe os dados de identificação e os parâmetros estatísticos que aparecerão no cabeçalho do relatório.
            </p>

            <div className="grid grid-cols-1 gap-5">
                {/* Título */}
                <Field>
                    <Label htmlFor="title" tooltip="Nome oficial da pesquisa. Aparecerá em todos os relatórios e na capa.">
                        Título da Pesquisa <span className="text-red-500">*</span>
                    </Label>
                    <input
                        id="title"
                        type="text"
                        value={data.title}
                        onChange={e => set('title', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Pesquisa Eleitoral Municipal — 2026"
                        maxLength={500}
                    />
                </Field>

                {/* Tipo + Objetivo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field>
                        <Label htmlFor="survey_type" tooltip="Classifica a natureza da pesquisa para fins de relatório e análise.">
                            Tipo de Pesquisa
                        </Label>
                        <select
                            id="survey_type"
                            value={data.survey_type}
                            onChange={e => set('survey_type', e.target.value)}
                            aria-label="Tipo de pesquisa"
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {SURVEY_TYPE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                        </select>
                    </Field>

                    <Field>
                        <Label htmlFor="target_audience" tooltip="Quem são os entrevistados? Ex: Eleitores com título ativo no município.">
                            Público-alvo
                        </Label>
                        <input
                            id="target_audience"
                            type="text"
                            value={data.target_audience}
                            onChange={e => set('target_audience', e.target.value)}
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Eleitores registrados no município"
                        />
                    </Field>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                    {getMethodologyHint(data.survey_type)}
                </div>

                {/* Calculadora de Amostragem */}
                {usesSampling ? (
                    <StatisticsCalculator
                        value={{
                            margin_of_error: data.margin_of_error,
                            confidence_interval: data.confidence_interval,
                            total_interviews: data.total_interviews,
                            population_size: data.population_size,
                            deff: data.deff,
                            p_proportion: data.p_proportion,
                            stats_mode: data.stats_mode,
                        }}
                        onChange={(stats: SamplingStats) => onChange({ ...data, ...stats })}
                    />
                ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900">
                        Para este tipo de pesquisa, a quantidade de entrevistas será definida manualmente por localidade na Etapa 2.
                    </div>
                )}

                {/* Período */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field>
                        <Label htmlFor="started_at" tooltip="Data de início prevista para a coleta de dados em campo.">
                            Início da Coleta
                        </Label>
                        <input
                            id="started_at"
                            type="date"
                            value={data.started_at}
                            onChange={e => set('started_at', e.target.value)}
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            aria-label="Data de início da coleta"
                        />
                    </Field>
                    <Field>
                        <Label htmlFor="ended_at" tooltip="Data de encerramento prevista para a coleta de dados.">
                            Fim da Coleta
                        </Label>
                        <input
                            id="ended_at"
                            type="date"
                            value={data.ended_at}
                            onChange={e => set('ended_at', e.target.value)}
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            aria-label="Data de encerramento da coleta"
                        />
                    </Field>
                </div>

                {/* Objetivo */}
                <Field>
                    <Label htmlFor="objective" tooltip="Descreva o objetivo principal da pesquisa. Consta no relatório como apresentação.">
                        Objetivo da Pesquisa
                    </Label>
                    <textarea
                        id="objective"
                        rows={3}
                        value={data.objective}
                        onChange={e => set('objective', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Descreva o objetivo principal da pesquisa..."
                    />
                </Field>

                {/* Metodologia */}
                <Field>
                    <Label htmlFor="methodology" tooltip="Ex: Entrevista domiciliar face-a-face com questionário estruturado.">
                        Texto complementar da metodologia
                    </Label>
                    <textarea
                        id="methodology"
                        rows={2}
                        value={data.methodology}
                        onChange={e => set('methodology', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Ex: Entrevista domiciliar face-a-face com questionário estruturado."
                    />
                    <div className="mt-2 flex flex-wrap gap-2">
                        {[
                            'Amostragem probabilística estratificada por localidade',
                            'Entrevistas presenciais domiciliares com questionário estruturado',
                            'Grupo focal moderado com roteiro semiestruturado',
                            'Entrevistas em profundidade com análise temática',
                        ].map(template => (
                            <button
                                key={template}
                                type="button"
                                onClick={() => set('methodology', template)}
                                className="text-xs px-3 py-1.5 rounded-full border border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-700"
                            >
                                {template}
                            </button>
                        ))}
                    </div>
                </Field>

                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <label className="flex items-center gap-2 mb-3 text-sm font-medium text-slate-700">
                        <input
                            type="checkbox"
                            checked={data.is_registered_research}
                            onChange={e => set('is_registered_research', e.target.checked)}
                            className="accent-blue-600 w-4 h-4"
                        />
                        Pesquisa registrada em órgão de classe oficial
                        <Tooltip text="Quando houver exigencia regulatoria, identifique o responsavel tecnico e seus dados de registro." helpId="registered-research" />
                    </label>
                    {data.is_registered_research && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <input
                                type="text"
                                value={data.registered_responsible_name}
                                onChange={e => set('registered_responsible_name', e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="Responsável técnico"
                            />
                            <input
                                type="text"
                                value={data.registered_responsible_registry}
                                onChange={e => set('registered_responsible_registry', e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="Número do cadastro"
                            />
                            <input
                                type="text"
                                value={data.registered_responsible_body}
                                onChange={e => set('registered_responsible_body', e.target.value)}
                                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="Órgão de classe"
                            />
                        </div>
                    )}
                </div>

                {/* Opções da coleta */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1">
                        Recursos da coleta
                        <Tooltip text="Define quais dados adicionais serão coletados durante as entrevistas pelo app mobile." helpId="collection-resources" />
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { key: 'requires_geolocation', label: '📍 Geolocalização', tip: 'Captura as coordenadas GPS no momento da entrevista.', helpId: 'collection-resources' },
                            { key: 'requires_photo', label: '📷 Foto', tip: 'Permite tirar foto do entrevistado ou local.', helpId: 'collection-resources' },
                            { key: 'requires_signature', label: '✍️ Assinatura', tip: 'Coleta assinatura digital do entrevistado.', helpId: 'collection-resources' },
                            { key: 'allow_offline', label: '📵 Modo offline', tip: 'Permite coletar sem internet e sincronizar depois.', helpId: 'collection-resources' },
                        ].map(({ key, label, tip, helpId }) => (
                            <label key={key} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-300 transition">
                                <input
                                    type="checkbox"
                                    checked={data[key as keyof SurveyTechData] as boolean}
                                    onChange={e => set(key as keyof SurveyTechData, e.target.checked)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span className="text-sm text-slate-700">{label}</span>
                                <Tooltip text={tip} helpId={helpId} />
                            </label>
                        ))}
                    </div>
                </div>

                {/* Descrição */}
                <Field>
                    <Label htmlFor="description" tooltip="Descrição adicional ou observações internas. Não aparece no relatório final.">
                        Observações internas
                    </Label>
                    <textarea
                        id="description"
                        rows={2}
                        value={data.description}
                        onChange={e => set('description', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Observações internas (não aparecem no relatório)..."
                    />
                </Field>
            </div>
        </div>
    );
}
