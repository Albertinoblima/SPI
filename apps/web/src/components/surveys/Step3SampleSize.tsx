'use client';

import { useMemo, useState } from 'react';
import { Calculator, Users, HelpCircle, BarChart2, Infinity, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { shouldUseStatisticalSampling, type SurveyTechData } from './Step1TechnicalData';
import type { Locality } from './Step2Localities';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';

interface Props {
    localities: Locality[];
    tech: Pick<
        SurveyTechData,
        | 'survey_type'
        | 'margin_of_error'
        | 'confidence_interval'
        | 'total_interviews'
        | 'population_size'
        | 'deff'
        | 'p_proportion'
        | 'stats_mode'
        | 'geographic_scope'
        | 'infinite_population_mode'
        | 'infinite_population_threshold'
    >;
    onTechChange: (updates: Partial<Pick<SurveyTechData, 'infinite_population_mode' | 'infinite_population_threshold' | 'margin_of_error' | 'confidence_interval'>>) => void;
    onLocalitiesChange: (localities: Locality[]) => void;
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

function getZ(ci: number): number {
    if (ci === 90) return 1.645;
    if (ci === 99) return 2.576;
    return 1.96;
}

function calcInterviews(population: number, marginError: number, confidenceInterval: number, useInfinitePopulation = false): number {
    if (marginError <= 0) return 0;
    const z = getZ(confidenceInterval);
    const e = marginError / 100;
    const n0 = (z * z * 0.25) / (e * e);
    if (useInfinitePopulation) return Math.ceil(n0);
    if (population <= 0) return 0;
    const n = n0 / (1 + (n0 - 1) / population);
    return Math.ceil(n);
}

function getEffectiveLocalities(localities: Locality[]): Locality[] {
    return localities.filter((loc) => {
        if (loc.geo_level === 'state') {
            return !localities.some(
                (child) => child.geo_level !== 'state' && child.parent_state_name === loc.name,
            );
        }
        if (loc.geo_level === 'city') {
            return !localities.some(
                (child) =>
                    child.geo_level === 'locality' &&
                    child.parent_city_name === loc.name &&
                    child.parent_state_name === loc.parent_state_name,
            );
        }
        return true;
    });
}

function localityIsInfinite(
    loc: Locality,
    mode: SurveyTechData['infinite_population_mode'],
    threshold: number,
    isNational: boolean,
): boolean {
    if (mode === 'force_all') return true;
    if (mode === 'auto_threshold') return (loc.population ?? 0) >= threshold;
    return isNational; // national_only
}

const GEO_LEVEL_LABELS: Record<Locality['geo_level'], string> = {
    state: 'Estado',
    city: 'Cidade',
    locality: 'Localidade especÃ­fica',
};

const ZONE_LABELS: Record<Locality['zone'], string> = {
    urban: 'Urbana',
    rural: 'Rural',
    mixed: 'Misto',
};

function Tooltip({ text, helpId }: { text: string; helpId?: string }) {
    const hasTopic = helpId && HELP_TOPICS_BY_ID[helpId];
    return (
        <span className="inline-flex items-center ml-1 align-middle group relative">
            {hasTopic ? (
                <Link
                    href={`/help#${helpId}`}
                    tabIndex={-1}
                    onClick={(e) => {
                        e.preventDefault();
                        window.dispatchEvent(new CustomEvent(HELP_HOVER_EVENT, { detail: helpId }));
                    }}
                    className="text-slate-400 hover:text-blue-500 transition-colors cursor-help"
                    aria-label={`Ajuda: ${text}`}
                >
                    <HelpCircle size={13} />
                </Link>
            ) : (
                <span className="text-slate-400 cursor-help" title={text}>
                    <HelpCircle size={13} />
                </span>
            )}
            <span className="absolute left-1/2 -translate-x-1/2 bottom-5 z-50 hidden group-hover:block bg-slate-800 text-white text-xs rounded px-2 py-1 w-52 shadow-lg pointer-events-none">
                {text}
            </span>
        </span>
    );
}

export function Step3SampleSize({ localities, tech, onTechChange, onLocalitiesChange }: Props) {
    const usesSampling = shouldUseStatisticalSampling(tech.survey_type);

    const mode = tech.infinite_population_mode ?? 'national_only';
    const threshold = tech.infinite_population_threshold ?? 50000;
    const isNational = tech.geographic_scope === 'national';

    const [thresholdInput, setThresholdInput] = useState<string>(String(threshold));

    const effectiveLocalities = useMemo(() => getEffectiveLocalities(localities), [localities]);

    const totalPopulation = effectiveLocalities.reduce((acc, l) => acc + (l.population ?? 0), 0);
    const totalInterviews = tech.total_interviews ?? 0;

    const localitiesWithCalc = useMemo(() => {
        return effectiveLocalities.map((loc) => {
            const useInfinite = localityIsInfinite(loc, mode, threshold, isNational);
            const calc = usesSampling
                ? calcInterviews(loc.population, tech.margin_of_error, tech.confidence_interval, useInfinite)
                : (loc.interviews_required ?? 0);
            return { ...loc, calc_interviews: calc, use_infinite: useInfinite };
        });
    }, [effectiveLocalities, usesSampling, tech.margin_of_error, tech.confidence_interval, mode, threshold, isNational]);

    const Z = getZ(tech.confidence_interval);
    const E = tech.margin_of_error / 100;

    const handleModeChange = (newMode: SurveyTechData['infinite_population_mode']) => {
        onTechChange({ infinite_population_mode: newMode, infinite_population_threshold: threshold });
    };

    const handleThresholdBlur = () => {
        const val = parseInt(thresholdInput, 10);
        if (!isNaN(val) && val > 0) {
            onTechChange({ infinite_population_mode: mode, infinite_population_threshold: val });
        } else {
            setThresholdInput(String(threshold));
        }
    };

    const handlePopulationChange = (localityId: string, value: string) => {
        const parsed = parseInt(value, 10);
        const nextPopulation = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
        const updated = localities.map((loc) =>
            loc.id === localityId ? { ...loc, population: nextPopulation } : loc,
        );
        onLocalitiesChange(updated);
    };

    return (
        <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 3 — Dimensionamento Amostral</h2>
            <p className="text-sm text-slate-500 mb-6">
                Configure os parâmetros estatísticos e finalize o dimensionamento da amostra com base nas localidades cadastradas.
                <Tooltip text="Revise este dimensionamento antes de elaborar o questionário." helpId="sample-size-review" />
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800 mb-4">
                {getMethodologyHint(tech.survey_type)}
            </div>

            {usesSampling && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-xl border border-blue-100 bg-blue-50/60 p-4 mb-6">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between mb-0.5">
                            <label htmlFor="margin_of_error" className="flex items-center text-sm font-medium text-slate-700">
                                Margem de Erro
                                <Tooltip text="Variação máxima aceitável nos resultados, expressa em pontos percentuais. Padrão: 3%." />
                            </label>
                            <span className="text-sm font-bold text-blue-700 tabular-nums">{tech.margin_of_error.toFixed(1)}%</span>
                        </div>
                        <input
                            id="margin_of_error"
                            type="range"
                            min={1}
                            max={10}
                            step={0.5}
                            value={tech.margin_of_error}
                            onChange={(e) => onTechChange({
                                infinite_population_mode: mode,
                                infinite_population_threshold: threshold,
                                margin_of_error: parseFloat(e.target.value),
                                confidence_interval: tech.confidence_interval,
                            })}
                            className="w-full accent-blue-600 cursor-pointer"
                            aria-label="Margem de erro"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                            <span>1%</span>
                            <span>5%</span>
                            <span>10%</span>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between mb-0.5">
                            <label htmlFor="confidence_interval" className="flex items-center text-sm font-medium text-slate-700">
                                Intervalo de Confiança
                                <Tooltip text="Probabilidade de o resultado estar dentro da margem de erro. Padrão: 95%." />
                            </label>
                            <span className="text-sm font-bold text-blue-700 tabular-nums">{tech.confidence_interval}%</span>
                        </div>
                        <input
                            id="confidence_interval"
                            type="range"
                            min={90}
                            max={99}
                            step={1}
                            value={tech.confidence_interval}
                            onChange={(e) => onTechChange({
                                infinite_population_mode: mode,
                                infinite_population_threshold: threshold,
                                margin_of_error: tech.margin_of_error,
                                confidence_interval: parseInt(e.target.value, 10),
                            })}
                            className="w-full accent-blue-600 cursor-pointer"
                            aria-label="Intervalo de confiança"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400">
                            <span>90%</span>
                            <span>95%</span>
                            <span>99%</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="border border-slate-200 rounded-xl p-5 mb-6 bg-white">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Calculator size={15} className="text-blue-600" />
                    Parâmetros estatísticos
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Margem de erro</p>
                        <p className="font-bold text-slate-800">± {tech.margin_of_error}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Intervalo de confiança</p>
                        <p className="font-bold text-slate-800">{tech.confidence_interval}%</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Efeito de delineamento</p>
                        <p className="font-bold text-slate-800">Deff = {tech.deff ?? 1.0}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500 mb-1">Modo de cálculo</p>
                        <p className="font-bold text-slate-800 capitalize">{tech.stats_mode === 'auto' ? 'Automático' : 'Manual'}</p>
                    </div>
                </div>

                {usesSampling && (
                    <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 flex items-start gap-2">
                        <Calculator size={14} className="mt-0.5 shrink-0 text-blue-600" />
                        <span>
                            {mode === 'force_all' ? (
                                <>
                                    <strong>População infinita forçada (todas as localidades):</strong>{' '}
                                    n = Z² × p × q / e² — onde Z={Z.toFixed(3)}, p=0,5, e={E.toFixed(3)}.
                                </>
                            ) : mode === 'auto_threshold' ? (
                                <>
                                    <strong>Limiar automático ({threshold.toLocaleString('pt-BR')} hab.):</strong>{' '}
                                    Localidades com população ≥ {threshold.toLocaleString('pt-BR')} usam fórmula infinita;
                                    demais usam correção finita. Z={Z.toFixed(3)}, e={E.toFixed(3)}.
                                </>
                            ) : isNational ? (
                                <>
                                    <strong>Abrangência nacional — população infinita:</strong>{' '}
                                    n = Z² × p × q / e² — onde Z={Z.toFixed(3)}, p=0,5, e={E.toFixed(3)}.
                                </>
                            ) : (
                                <>
                                    <strong>Fórmula amostral para populações finitas:</strong>{' '}
                                    n = (Z² × p × q / e²) / (1 + (Z² × p × q / e² − 1) / N) — onde Z={Z.toFixed(3)}, p=0,5,
                                    e={E.toFixed(3)}.
                                </>
                            )}
                        </span>
                    </div>
                )}

                {!usesSampling && (
                    <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                        Para esta tipologia metodológica, não há cálculo amostral automático. As metas operacionais
                        foram definidas manualmente.
                    </div>
                )}
            </div>

            {/* Controle de abrangÃªncia amostral */}
            {usesSampling && (
                <div className="border border-indigo-200 rounded-xl p-5 mb-6 bg-indigo-50">
                    <h3 className="text-sm font-semibold text-indigo-800 mb-1 flex items-center gap-2">
                        <TrendingDown size={15} className="text-indigo-600" />
                        AbrangÃªncia amostral â€” tratamento da populaÃ§Ã£o
                        <Tooltip text="Define como o sistema trata o tamanho da populaÃ§Ã£o em cada localidade. PopulaÃ§Ãµes 'infinitas' eliminam a correÃ§Ã£o de populaÃ§Ã£o finita, reduzindo drasticamente o tamanho mÃ­nimo da amostra." helpId="sample-size-review" />
                    </h3>
                    <p className="text-xs text-indigo-600 mb-4">
                        Grandes institutos tratam populaÃ§Ãµes acima de um limiar como infinitas, reduzindo o tamanho da amostra e tornando a pesquisa viÃ¡vel sem comprometer margem de erro ou intervalo de confianÃ§a.
                    </p>

                    <div className="space-y-3">
                        {/* OpÃ§Ã£o 1: padrÃ£o finito */}
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${mode === 'national_only' ? 'border-indigo-400 bg-white ring-1 ring-indigo-300' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                            <input
                                type="radio"
                                name="infinite_mode"
                                value="national_only"
                                checked={mode === 'national_only'}
                                onChange={() => handleModeChange('national_only')}
                                className="mt-0.5 accent-indigo-600"
                            />
                            <div>
                                <p className="text-sm font-semibold text-slate-800">PadrÃ£o: populaÃ§Ã£o finita</p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Aplica a correÃ§Ã£o de populaÃ§Ã£o finita em todas as localidades. AbrangÃªncia nacional usa fÃ³rmula infinita automaticamente.
                                </p>
                            </div>
                        </label>

                        {/* OpÃ§Ã£o 2: limiar automÃ¡tico */}
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${mode === 'auto_threshold' ? 'border-indigo-400 bg-white ring-1 ring-indigo-300' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                            <input
                                type="radio"
                                name="infinite_mode"
                                value="auto_threshold"
                                checked={mode === 'auto_threshold'}
                                onChange={() => handleModeChange('auto_threshold')}
                                className="mt-0.5 accent-indigo-600"
                            />
                            <div className="flex-1">
                                <p className="text-sm font-semibold text-slate-800">
                                    AutomÃ¡tico por limiar
                                    <span className="ml-2 text-xs font-normal text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">recomendado para municÃ­pios grandes</span>
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Localidades com populaÃ§Ã£o â‰¥ ao limiar sÃ£o tratadas como infinitas. Reduz significativamente o n mÃ­nimo.
                                </p>
                                {mode === 'auto_threshold' && (
                                    <div className="mt-2 flex items-center gap-2">
                                        <span className="text-xs text-slate-600">Limiar:</span>
                                        <input
                                            type="number"
                                            min={1000}
                                            step={1000}
                                            value={thresholdInput}
                                            onChange={(e) => setThresholdInput(e.target.value)}
                                            onBlur={handleThresholdBlur}
                                            className="w-28 text-sm border border-indigo-300 rounded px-2 py-1 focus:ring-1 focus:ring-indigo-400"
                                        />
                                        <span className="text-xs text-slate-500">habitantes</span>
                                        <span className="text-xs text-slate-400">(padrÃ£o: 50.000)</span>
                                    </div>
                                )}
                            </div>
                        </label>

                        {/* OpÃ§Ã£o 3: forÃ§ar infinita */}
                        <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${mode === 'force_all' ? 'border-indigo-400 bg-white ring-1 ring-indigo-300' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                            <input
                                type="radio"
                                name="infinite_mode"
                                value="force_all"
                                checked={mode === 'force_all'}
                                onChange={() => handleModeChange('force_all')}
                                className="mt-0.5 accent-indigo-600"
                            />
                            <div>
                                <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                                    <Infinity size={14} className="text-indigo-500" />
                                    ForÃ§ar infinita para todas as localidades
                                </p>
                                <p className="text-xs text-slate-500 mt-0.5">
                                    Usa n = ZÂ²Ã—pÃ—q/eÂ² em todas. Minimiza a amostra independente do tamanho da populaÃ§Ã£o.
                                    Recomendado apenas quando o universo Ã© desconhecido ou muito amplo.
                                </p>
                            </div>
                        </label>
                    </div>
                </div>
            )}

            {/* Resumo do universo e amostra */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 flex items-center gap-4">
                    <Users size={22} className="text-emerald-600 shrink-0" />
                    <div>
                        <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide mb-0.5">
                            Universo total pesquisado
                        </p>
                        <p className="text-2xl font-extrabold text-emerald-800">
                            {totalPopulation.toLocaleString('pt-BR')}
                            <span className="text-xs font-normal text-emerald-600 ml-1">pessoas / eleitores</span>
                        </p>
                    </div>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex items-center gap-4">
                    <BarChart2 size={22} className="text-blue-600 shrink-0" />
                    <div>
                        <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide mb-0.5">
                            Tamanho da amostra
                        </p>
                        <p className="text-2xl font-extrabold text-blue-800">
                            {totalInterviews.toLocaleString('pt-BR')}
                            <span className="text-xs font-normal text-blue-600 ml-1">entrevistas</span>
                        </p>
                        {tech.stats_mode === 'manual' && (
                            <p className="text-xs text-blue-600 mt-0.5">Definido manualmente na Etapa 1</p>
                        )}
                    </div>
                </div>
            </div>

            {/* DistribuiÃ§Ã£o por localidade */}
            {localitiesWithCalc.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800 text-sm">
                    Nenhuma localidade cadastrada. Volte Ã  Etapa 2 e adicione pelo menos uma localidade.
                </div>
            ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                        <BarChart2 size={14} className="text-slate-500" />
                        <span className="text-sm font-semibold text-slate-700">DistribuiÃ§Ã£o amostral por localidade</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold">NÃ­vel</th>
                                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                                    <th className="text-left px-4 py-3 font-semibold">Zona</th>
                                    <th className="text-right px-4 py-3 font-semibold">
                                        População
                                        <Tooltip text="População da localidade usada no dimensionamento. Informe os valores nesta etapa." helpId="localities-population" />
                                    </th>
                                    {usesSampling && (
                                        <th className="text-center px-4 py-3 font-semibold">
                                            Pop. tratada
                                            <Tooltip text="Se a populaÃ§Ã£o Ã© tratada como finita ou infinita no cÃ¡lculo amostral." helpId="sample-size-review" />
                                        </th>
                                    )}
                                    <th className="text-right px-4 py-3 font-semibold">
                                        Entrevistas
                                        <Tooltip text="Entrevistas calculadas por fÃ³rmula amostral ou definidas manualmente." helpId="sample-size-review" />
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold">Peso (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localitiesWithCalc.map((loc, idx) => {
                                    const weight =
                                        totalInterviews > 0
                                            ? ((loc.calc_interviews / totalInterviews) * 100).toFixed(1)
                                            : 'â€”';
                                    return (
                                        <tr
                                            key={loc.id}
                                            className={`border-t border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/40'}`}
                                        >
                                            <td className="px-4 py-3 text-xs text-slate-500">{GEO_LEVEL_LABELS[loc.geo_level]}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">
                                                {loc.name}
                                                {loc.parent_state_name && (
                                                    <span className="text-xs text-slate-400 ml-1">({loc.parent_state_name})</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-500">{ZONE_LABELS[loc.zone]}</td>
                                            <td className="px-4 py-3 text-right text-slate-700">
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={loc.population > 0 ? loc.population : ''}
                                                    onChange={(e) => handlePopulationChange(loc.id, e.target.value)}
                                                    className="w-32 ml-auto text-right border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-blue-500"
                                                    placeholder="0"
                                                    aria-label={`População da localidade ${loc.name}`}
                                                />
                                            </td>
                                            {usesSampling && (
                                                <td className="px-4 py-3 text-center">
                                                    {loc.use_infinite ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                            <Infinity size={10} /> Infinita
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                            Finita
                                                        </span>
                                                    )}
                                                </td>
                                            )}
                                            <td className="px-4 py-3 text-right font-semibold text-blue-700">
                                                {loc.calc_interviews > 0 ? loc.calc_interviews.toLocaleString('pt-BR') : <span className="text-slate-400">â€”</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right text-slate-500 text-xs">{weight}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                                <tr>
                                    <td className="px-4 py-3 font-semibold text-slate-700" colSpan={3}>
                                        Total (localidades efetivas)
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                                        {totalPopulation.toLocaleString('pt-BR')}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">
                                        {totalInterviews.toLocaleString('pt-BR')} entrevistas
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-500 text-xs">100%</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            <p className="mt-4 text-xs text-slate-400">
                Nesta etapa você define os parâmetros estatísticos e a população de cada localidade para o cálculo.
                Use a Etapa 2 apenas para ajustar a estrutura territorial. Confirme os dados acima antes de elaborar o questionário.
            </p>
        </div>
    );
}

