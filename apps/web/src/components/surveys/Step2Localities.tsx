'use client';

import { useState } from 'react';
import { Plus, Trash2, HelpCircle, Calculator, Users } from 'lucide-react';
import Link from 'next/link';
import { shouldUseStatisticalSampling } from './Step1TechnicalData';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';

export interface Locality {
    id: string;
    name: string;
    zone: 'urban' | 'rural' | 'mixed';
    population: number;
    population_type: 'eleitores' | 'habitantes' | 'comerciantes' | 'comerciarios' | 'consumidores' | 'dona_de_casa' | 'industriarios' | 'funcionarios_publicos' | 'prestadores_servicos' | 'professores' | 'profissional_liberal' | 'publico_geral' | 'segmento_especifico' | 'sindicalistas';
    interviews_required?: number;
    interviews_weight?: number;
}

interface Props {
    localities: Locality[];
    onChange: (localities: Locality[]) => void;
    marginOfError: number;
    confidenceInterval: number;
    surveyType: string;
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

function getZ(ci: number): number {
    if (ci === 90) return 1.645;
    if (ci === 99) return 2.576;
    return 1.96; // 95%
}

/** Fórmula amostral para população finita */
function calcInterviews(population: number, marginError: number, confidenceInterval: number): number {
    if (population <= 0 || marginError <= 0) return 0;
    const z = getZ(confidenceInterval);
    const p = 0.5;
    const e = marginError / 100;
    const n0 = (z * z * p * (1 - p)) / (e * e);
    const n = n0 / (1 + (n0 - 1) / population);
    return Math.ceil(n);
}

const ZONE_LABELS: Record<string, string> = {
    urban: 'Sede ou Urbana',
    rural: 'Interior ou Rural',
    mixed: 'Misto (Urbana + Rural)',
};

export function Step2Localities({ localities, onChange, marginOfError, confidenceInterval, surveyType }: Props) {
    const [form, setForm] = useState<Omit<Locality, 'id' | 'interviews_weight'> & { interviews_required: number }>({
        name: '',
        zone: 'urban',
        population: 0,
        population_type: 'eleitores',
        interviews_required: 0,
    });
    const [error, setError] = useState('');
    const usesSampling = shouldUseStatisticalSampling(surveyType);

    const totalInterviews = localities.reduce((acc, l) => acc + (l.interviews_required ?? 0), 0);
    const totalPopulation = localities.reduce((acc, l) => acc + (l.population ?? 0), 0);

    const handleAdd = () => {
        if (!form.name.trim()) { setError('Informe o nome da localidade.'); return; }
        if (form.population <= 0) { setError('A população deve ser maior que zero.'); return; }
        setError('');

        const interviews = usesSampling
            ? calcInterviews(form.population, marginOfError, confidenceInterval)
            : form.interviews_required;
        if (!usesSampling && interviews <= 0) {
            setError('Informe a quantidade planejada de entrevistas para esta localidade.');
            return;
        }
        const newLoc: Locality = {
            id: `loc_${Date.now()}`,
            ...form,
            name: form.name.trim(),
            interviews_required: interviews,
        };
        const updated = [...localities, newLoc];
        // Recalcular pesos
        const total = updated.reduce((s, l) => s + (l.interviews_required ?? 0), 0);
        const withWeights = updated.map(l => ({
            ...l,
            interviews_weight: total > 0 ? (l.interviews_required ?? 0) / total : 0,
        }));
        onChange(withWeights);
        setForm({ name: '', zone: 'urban', population: 0, population_type: 'eleitores', interviews_required: 0 });
    };

    const handleRemove = (id: string) => {
        const updated = localities.filter(l => l.id !== id);
        const total = updated.reduce((s, l) => s + (l.interviews_required ?? 0), 0);
        onChange(updated.map(l => ({ ...l, interviews_weight: total > 0 ? (l.interviews_required ?? 0) / total : 0 })));
    };

    const handleRecalcAll = () => {
        if (!usesSampling) {
            const total = localities.reduce((s, l) => s + (l.interviews_required ?? 0), 0);
            onChange(localities.map(l => ({ ...l, interviews_weight: total > 0 ? (l.interviews_required ?? 0) / total : 0 })));
            return;
        }

        const recalc = localities.map(l => ({
            ...l,
            interviews_required: calcInterviews(l.population, marginOfError, confidenceInterval),
        }));
        const total = recalc.reduce((s, l) => s + (l.interviews_required ?? 0), 0);
        onChange(recalc.map(l => ({ ...l, interviews_weight: total > 0 ? (l.interviews_required ?? 0) / total : 0 })));
    };

    return (
        <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 2 — Localidades</h2>
            <p className="text-sm text-slate-500 mb-2">
                {usesSampling
                    ? 'Informe os municípios, zonas e população. O sistema calculará automaticamente o número de entrevistas necessárias com base na margem de erro e no intervalo de confiança definidos na etapa anterior.'
                    : 'Informe os municípios e defina manualmente a quantidade planejada de entrevistas por localidade.'}
            </p>

            {/* Fórmula explicada */}
            {usesSampling ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-xs text-blue-800 flex items-start gap-2">
                    <Calculator size={15} className="mt-0.5 shrink-0 text-blue-600" />
                    <span>
                        <strong>Fórmula amostral para populações finitas:</strong>{' '}
                        n = (Z² × p × q / e²) / (1 + (Z² × p × q / e² − 1) / N) — onde Z={getZ(confidenceInterval).toFixed(3)}, p=0,5, e={marginOfError / 100}.
                    </span>
                </div>
            ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-xs text-amber-900">
                    Para esta tipologia metodológica, não há cálculo amostral automático. A empresa define a meta operacional por localidade.
                </div>
            )}

            {/* Formulário de adição */}
            <div className="border border-slate-200 rounded-xl p-5 mb-6 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">
                    Adicionar localidade
                    <Tooltip text="Cada localidade terá sua cota de entrevistas calculada proporcionalmente à população ou meta definida pela gestão." helpId="localities-method" />
                </h3>
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-xs text-amber-900 flex items-start gap-2">
                    <span className="text-amber-600 font-bold shrink-0">⚠</span>
                    <span>
                        <strong>Atenção:</strong> Tenha em mãos o <strong>extrato do plano da pesquisa</strong> antes de preencher este campo.
                        O extrato deve conter as localidades previstas e o total de entrevistas por localidade.
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="loc-name" className="text-sm font-medium text-slate-700 block mb-1">
                            Nome do município / localidade <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="loc-name"
                            type="text"
                            value={form.name}
                            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Fortaleza"
                        />
                    </div>

                    <div>
                        <label htmlFor="loc-zone" className="text-sm font-medium text-slate-700 block mb-1">
                            Zona
                            <Tooltip text="Urbana: área citadina. Rural: zona rural. Misto: ambas as zonas." helpId="localities-zone" />
                        </label>
                        <select
                            id="loc-zone"
                            value={form.zone}
                            onChange={e => setForm(f => ({ ...f, zone: e.target.value as Locality['zone'] }))}
                            aria-label="Zona da localidade"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="urban">Sede ou Urbana</option>
                            <option value="rural">Interior ou Rural</option>
                            <option value="mixed">Misto (Urbana + Rural)</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="loc-pop" className="text-sm font-medium text-slate-700 block mb-1">
                            Quantidade
                            <Tooltip text="Número de eleitores ou habitantes da localidade. Base para o cálculo amostral." helpId="localities-population" />
                        </label>
                        <input
                            id="loc-pop"
                            type="number"
                            min={1}
                            value={form.population || ''}
                            onChange={e => setForm(f => ({ ...f, population: parseInt(e.target.value) || 0 }))}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 50000"
                        />
                    </div>

                    <div>
                        <label htmlFor="loc-pop-type" className="text-sm font-medium text-slate-700 block mb-1">
                            Público Alvo
                            <Tooltip text="Defina o público alvo desta localidade conforme o extrato do plano da pesquisa." helpId="localities-population" />
                        </label>
                        <select
                            id="loc-pop-type"
                            value={form.population_type}
                            onChange={e => setForm(f => ({ ...f, population_type: e.target.value as Locality['population_type'] }))}
                            aria-label="Público Alvo"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="comerciantes">Comerciantes</option>
                            <option value="comerciarios">Comerciários</option>
                            <option value="consumidores">Consumidores</option>
                            <option value="eleitores">Eleitores</option>
                            <option value="dona_de_casa">Dona de Casa</option>
                            <option value="industriarios">Industriários</option>
                            <option value="funcionarios_publicos">Funcionários Públicos</option>
                            <option value="prestadores_servicos">Prestadores de Serviços</option>
                            <option value="professores">Professores</option>
                            <option value="profissional_liberal">Profissional Liberal</option>
                            <option value="publico_geral">Público em Geral</option>
                            <option value="segmento_especifico">Segmento Específico</option>
                            <option value="sindicalistas">Sindicalistas</option>
                            <option value="habitantes">Habitantes</option>
                        </select>
                    </div>

                    {!usesSampling && (
                        <div>
                            <label htmlFor="loc-interviews" className="text-sm font-medium text-slate-700 block mb-1">
                                Entrevistas planejadas
                                <Tooltip text="Meta operacional definida pela gestão para esta localidade." helpId="localities-manual-target" />
                            </label>
                            <input
                                id="loc-interviews"
                                type="number"
                                min={1}
                                value={form.interviews_required || ''}
                                onChange={e => setForm(f => ({ ...f, interviews_required: parseInt(e.target.value) || 0 }))}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: 120"
                            />
                        </div>
                    )}
                </div>

                {usesSampling && form.population > 0 && marginOfError > 0 && (
                    <p className="mt-3 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                        📊 Estimativa: <strong className="text-blue-700">
                            {calcInterviews(form.population, marginOfError, confidenceInterval)} entrevistas
                        </strong> para {form.population.toLocaleString('pt-BR')} {form.population_type}
                    </p>
                )}

                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

                <button
                    type="button"
                    onClick={handleAdd}
                    className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
                >
                    <Plus size={18} />
                    Adicionar Localidade
                </button>
            </div>

            {/* Tabela de localidades */}
            {localities.length > 0 ? (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-700">
                            {localities.length} localidade{localities.length > 1 ? 's' : ''} adicionada{localities.length > 1 ? 's' : ''}
                        </h3>
                        <button
                            type="button"
                            onClick={handleRecalcAll}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition"
                        >
                            <Calculator size={14} />
                            {usesSampling ? 'Recalcular todas' : 'Atualizar pesos'}
                        </button>
                    </div>

                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-slate-600">
                                <tr>
                                    <th className="text-left px-4 py-3 font-semibold">Localidade</th>
                                    <th className="text-left px-4 py-3 font-semibold">Zona</th>
                                    <th className="text-right px-4 py-3 font-semibold">População</th>
                                    <th className="text-right px-4 py-3 font-semibold">Entrevistas</th>
                                    <th className="text-right px-4 py-3 font-semibold">Peso</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {localities.map(loc => (
                                    <tr key={loc.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-800">{loc.name}</td>
                                        <td className="px-4 py-3 text-slate-600">{ZONE_LABELS[loc.zone]}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">
                                            {loc.population.toLocaleString('pt-BR')}
                                            <span className="text-xs text-slate-400 ml-1">
                                                {loc.population_type}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-bold text-blue-700">
                                            {loc.interviews_required?.toLocaleString('pt-BR')}
                                        </td>
                                        <td className="px-4 py-3 text-right text-slate-500 text-xs">
                                            {loc.interviews_weight !== undefined
                                                ? `${(loc.interviews_weight * 100).toFixed(1)}%`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => handleRemove(loc.id)}
                                                className="text-red-400 hover:text-red-600 transition"
                                                aria-label={`Remover ${loc.name}`}
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                                <tr>
                                    <td className="px-4 py-3 font-semibold text-slate-700" colSpan={3}>Total</td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">
                                        {totalInterviews.toLocaleString('pt-BR')} entrevistas
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-500 text-xs">100%</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {/* Banner de resumo amostral */}
                    {usesSampling && (
                        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Users size={18} className="text-emerald-600 shrink-0" />
                                <div>
                                    <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">
                                        Universo total pesquisado
                                    </p>
                                    <p className="text-lg font-extrabold text-emerald-800">
                                        {totalPopulation.toLocaleString('pt-BR')}
                                        <span className="text-xs font-normal text-emerald-600 ml-1">pessoas / eleitores</span>
                                    </p>
                                </div>
                            </div>
                            <div className="h-px sm:h-10 w-full sm:w-px bg-emerald-200" />
                            <div className="flex items-center gap-3">
                                <Calculator size={18} className="text-blue-600 shrink-0" />
                                <div>
                                    <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">
                                        Total de entrevistas (Etapa 2)
                                    </p>
                                    <p className="text-lg font-extrabold text-blue-800">
                                        {totalInterviews.toLocaleString('pt-BR')}
                                        <span className="text-xs font-normal text-blue-600 ml-1">entrevistas</span>
                                    </p>
                                </div>
                            </div>
                            <div className="text-xs text-slate-500 max-w-xs">
                                Este é o total definitivo — calculado pela fórmula de população finita para cada município individualmente.
                                Atualizado automaticamente na Etapa 1.
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-lg mb-1">Nenhuma localidade adicionada</p>
                    <p className="text-sm">Adicione ao menos uma localidade para calcular o número de entrevistas</p>
                </div>
            )}
        </div>
    );
}
