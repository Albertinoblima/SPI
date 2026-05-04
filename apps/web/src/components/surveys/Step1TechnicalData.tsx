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

const METHODOLOGY_TEMPLATES: Record<string, string[]> = {
    eleitoral: [
        'Pesquisa quantitativa de intenção de voto realizada por meio de entrevistas presenciais domiciliares com questionário estruturado, aplicado a eleitores com domicílio eleitoral no município, selecionados por amostragem probabilística estratificada por localidade e perfil socioeconômico.',
        'Levantamento amostral de opinião eleitoral conduzido com entrevistas face a face, adotando cotas proporcionais de sexo, faixa etária e escolaridade, conforme distribuição do eleitorado junto ao TSE.',
        'Sondagem eleitoral por entrevistas domiciliares aleatórias, com questionário padronizado aprovado pelo responsável técnico, respeitando margem de erro e intervalo de confiança estabelecidos no planejamento amostral.',
    ],
    opiniao_publica: [
        'Pesquisa quantitativa de opinião pública realizada por entrevistas presenciais com adultos residentes no município, utilizando amostragem aleatória simples estratificada por zona urbana e rural, com cotas de sexo e faixa etária.',
        'Levantamento de percepção e opinião da população local sobre temas de interesse público, conduzido por entrevistadores treinados com questionário fechado validado previamente em pré-teste com 30 respondentes.',
        'Sondagem de opinião com abordagem por cotas proporcionais ao perfil censitário do município, capturando percepções sobre gestão pública, serviços e demandas sociais.',
    ],
    satisfacao: [
        'Pesquisa de satisfação com serviços públicos conduzida por entrevistas presenciais junto a usuários dos serviços avaliados, com escala Likert de 5 pontos e questões abertas complementares para captura de sugestões de melhoria.',
        'Levantamento amostral de satisfação do cidadão com a gestão municipal, aplicado em pontos de alto fluxo (UBS, escolas, feiras), com abordagem aleatória e questionário estruturado.',
        'Avaliação de satisfação com serviços essenciais (saúde, educação, infraestrutura e segurança), por meio de entrevistas domiciliares com amostragem proporcional ao tamanho de cada setor censitário.',
    ],
    avaliacao_servicos: [
        'Pesquisa de avaliação de serviços públicos municipais por entrevistas presenciais com usuários, utilizando escala de desempenho e questões sobre expectativas e experiências recentes, com amostragem sistemática.',
        'Levantamento quantitativo de percepção de qualidade nos serviços públicos prestados, aplicado em pontos de atendimento, com coleta de dados via app mobile com geolocalização e assinatura digital.',
        'Avaliação periódica de serviços por entrevistas domiciliares aleatórias, comparando resultados com waves anteriores para mensuração de evolução de indicadores de desempenho.',
    ],
    mercado_quantitativa: [
        'Pesquisa quantitativa de mercado realizada por entrevistas presenciais com consumidores, utilizando amostragem por cotas de perfil socioeconômico, com questionário estruturado de uso, hábitos e preferências.',
        'Levantamento de intenção de compra e percepção de marca conduzido com abordagem em pontos de venda e residências, com coleta digital e envio de dados em tempo real.',
        'Sondagem de mercado com amostragem aleatória estratificada por bairro, coletando informações sobre comportamento do consumidor, satisfação e propensão a recomendar produtos e serviços.',
    ],
    censo: [
        'Levantamento censitário de cobertura total do universo pesquisado, realizado por entrevistadores com dispositivos móveis, com geolocalização obrigatória de cada domicílio visitado e sincronização online/offline.',
        'Cadastramento integral da população-alvo por meio de visitas domiciliares sistemáticas por setor, com formulário estruturado digital e supervisão remota em tempo real.',
        'Censo socioeconômico conduzido com questionário padronizado aplicado a todos os domicílios da área delimitada, com revisão de consistência automática e supervisão de campo.',
    ],
    qualitativa_grupo_focal: [
        'Pesquisa qualitativa realizada por meio de grupos focais compostos por 8 a 10 participantes recrutados por perfil específico, conduzidos por moderador treinado com roteiro semiestruturado e análise temática dos resultados.',
        'Grupos de discussão focal com segmentos distintos da população, gravados com autorização dos participantes e analisados conforme metodologia de análise de conteúdo categorial.',
        'Pesquisa exploratória qualitativa com grupos focais por perfil etário e socioeconômico, abordando percepções, expectativas e representações sobre o tema central da investigação.',
    ],
    qualitativa_profundidade: [
        'Pesquisa qualitativa com entrevistas em profundidade individuais conduzidas por entrevistadores especializados, com roteiro semiestruturado, duração estimada de 60 minutos e análise temática das transcrições.',
        'Entrevistas em profundidade com informantes-chave selecionados por critérios de relevância e expertise, com análise de conteúdo qualitativo e triangulação de fontes.',
        'Investigação qualitativa exploratória por entrevistas individuais em profundidade, com técnica narrativa e análise fenomenológica orientada a compreender experiências e significados atribuídos pelos participantes.',
    ],
    quali_quanti: [
        'Pesquisa mista combinando fase qualitativa exploratória (grupos focais ou entrevistas em profundidade) para construção de hipóteses, seguida de fase quantitativa amostral para validação estatística dos achados.',
        'Metodologia quali-quanti sequencial: etapa qualitativa para geração de insights e etapa quantitativa amostral com questionário estruturado para mensuração de frequências e correlações no público-alvo.',
        'Estudo integrado quali-quanti com coleta simultânea: questionários estruturados para dados quantitativos e questões abertas para aprofundamento qualitativo, com análise convergente dos resultados.',
    ],
    outros: [
        'Pesquisa conduzida por entrevistas presenciais com questionário estruturado, amostragem definida pela coordenação técnica e supervisão de campo com uso de aplicativo mobile.',
        'Levantamento de dados primários por entrevistas diretas com o público-alvo definido no planejamento, seguindo protocolo metodológico aprovado pelo responsável técnico da pesquisa.',
    ],
};

function getMethodologySuggestions(surveyType: string): string[] {
    return METHODOLOGY_TEMPLATES[surveyType] ?? METHODOLOGY_TEMPLATES['outros'] ?? [];
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

    // Validação de datas
    const dateError = (() => {
        if (!data.started_at || !data.ended_at) return '';
        if (data.ended_at < data.started_at) return 'A data de encerramento não pode ser anterior à data de início.';
        return '';
    })();

    const handleEndDate = (value: string) => {
        onChange({ ...data, ended_at: value });
    };

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
                            onChange={e => {
                                const newStart = e.target.value;
                                // Se a data final já está preenchida e fica menor, limpa a data final
                                const newEnded = data.ended_at && data.ended_at < newStart ? '' : data.ended_at;
                                onChange({ ...data, started_at: newStart, ended_at: newEnded });
                            }}
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
                            min={data.started_at || undefined}
                            onChange={e => handleEndDate(e.target.value)}
                            className={`border rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 ${dateError ? 'border-red-400 focus:ring-red-400 bg-red-50' : 'border-slate-300'
                                }`}
                            aria-label="Data de encerramento da coleta"
                        />
                        {dateError && (
                            <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                <span>⚠</span> {dateError}
                            </p>
                        )}
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
                    <Label htmlFor="methodology" tooltip="Texto descritivo que aparecerá no relatório explicando como a pesquisa foi conduzida.">
                        Texto complementar da metodologia
                    </Label>
                    <textarea
                        id="methodology"
                        rows={4}
                        value={data.methodology}
                        onChange={e => set('methodology', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-y text-sm"
                        placeholder="Descreva como a pesquisa será conduzida: método de coleta, forma de abordagem, critérios de seleção dos entrevistados..."
                    />
                    {getMethodologySuggestions(data.survey_type).length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs text-slate-500 mb-1.5">Sugestões para <strong>{SURVEY_TYPE_OPTIONS.find(o => o.value === data.survey_type)?.label ?? 'este tipo'}</strong> — clique para usar:</p>
                            <div className="flex flex-col gap-1.5">
                                {getMethodologySuggestions(data.survey_type).map((template, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => set('methodology', template)}
                                        className={`text-xs text-left px-3 py-2 rounded-lg border transition ${data.methodology === template
                                                ? 'border-blue-400 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
                                            }`}
                                    >
                                        {template}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {!data.survey_type && (
                        <p className="text-xs text-slate-400 mt-1.5">Selecione o tipo de pesquisa para ver sugestões de texto metodológico.</p>
                    )}
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
