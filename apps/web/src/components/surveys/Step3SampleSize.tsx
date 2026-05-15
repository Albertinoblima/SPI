'use client';

import { useMemo } from 'react';
import { Calculator, Users, HelpCircle, BarChart2 } from 'lucide-react';
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
    >;
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

const GEO_LEVEL_LABELS: Record<Locality['geo_level'], string> = {
    state: 'Estado',
    city: 'Cidade',
    locality: 'Localidade específica',
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

export function Step3SampleSize({ localities, tech }: Props) {
    const usesSampling = shouldUseStatisticalSampling(tech.survey_type);
    const forceInfinitePopulation = tech.geographic_scope === 'national';
    const effectiveLocalities = useMemo(() => getEffectiveLocalities(localities), [localities]);

    const totalPopulation = effectiveLocalities.reduce((acc, l) => acc + (l.population ?? 0), 0);
    const totalInterviews = tech.total_interviews ?? 0;

    const localitiesWithCalc = useMemo(() => {
        return effectiveLocalities.map((loc) => {
            const calc = usesSampling
                ? calcInterviews(loc.population, tech.margin_of_error, tech.confidence_interval, forceInfinitePopulation)
                : (loc.interviews_required ?? 0);
            return {
                ...loc,
                calc_interviews: calc,
            };
        });
    }, [effectiveLocalities, usesSampling, tech.margin_of_error, tech.confidence_interval, forceInfinitePopulation]);

    const Z = getZ(tech.confidence_interval);
    const E = tech.margin_of_error / 100;

    return (
        <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 3 — Dimensionamento Amostral</h2>
            <p className="text-sm text-slate-500 mb-6">
                Revise o cálculo do tamanho da amostra com base na população cadastrada nas localidades e nos
                parâmetros estatísticos definidos na Etapa 1.
                <Tooltip text="Revise este dimensionamento antes de elaborar o questionário." helpId="sample-size-review" />
            </p>

            {/* Parâmetros estatísticos */}
            <div className="border border-slate-200 rounded-xl p-5 mb-6 bg-white">
                <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <Calculator size={15} className="text-blue-600" />
                    Parâmetros estatísticos (Etapa 1)
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
                            {forceInfinitePopulation ? (
                                <>
                                    <strong>População infinita aplicada (abrangência nacional):</strong>{' '}
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
                        foram definidas manualmente na Etapa 2.
                    </div>
                )}
            </div>

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

            {/* Distribuição por localidade */}
            {localitiesWithCalc.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-amber-800 text-sm">
                    Nenhuma localidade cadastrada. Volte à Etapa 2 e adicione pelo menos uma localidade.
                </div>
            ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-slate-50 px-4 py-3 border-b border-slate-200 flex items-center gap-2">
                        <BarChart2 size={14} className="text-slate-500" />
                        <span className="text-sm font-semibold text-slate-700">Distribuição amostral por localidade</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold">Nível</th>
                                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                                    <th className="text-left px-4 py-3 font-semibold">Zona</th>
                                    <th className="text-right px-4 py-3 font-semibold">
                                        População base
                                        <Tooltip text="População cadastrada na Etapa 2 para cada localidade efetiva." helpId="localities-population" />
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold">
                                        Entrevistas
                                        <Tooltip text="Entrevistas calculadas por fórmula amostral ou definidas manualmente." helpId="sample-size-review" />
                                    </th>
                                    <th className="text-right px-4 py-3 font-semibold">Peso (%)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {localitiesWithCalc.map((loc, idx) => {
                                    const weight =
                                        totalInterviews > 0
                                            ? ((loc.calc_interviews / totalInterviews) * 100).toFixed(1)
                                            : '—';
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
                                                {loc.population > 0 ? loc.population.toLocaleString('pt-BR') : <span className="text-slate-400">—</span>}
                                            </td>
                                            <td className="px-4 py-3 text-right font-semibold text-blue-700">
                                                {loc.calc_interviews > 0 ? loc.calc_interviews.toLocaleString('pt-BR') : <span className="text-slate-400">—</span>}
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
                Para ajustar parâmetros estatísticos, volte à <strong>Etapa 1</strong>. Para alterar localidades e
                populações, volte à <strong>Etapa 2</strong>. Confirme os dados acima antes de elaborar o questionário.
            </p>
        </div>
    );
}
