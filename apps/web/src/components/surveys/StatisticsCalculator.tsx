'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Calculator, PenLine, RefreshCw, MapPin } from 'lucide-react';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';
import Link from 'next/link';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface SamplingStats {
    margin_of_error: number;        // % (ex: 3 = 3%)
    confidence_interval: number;    // % (90 | 95 | 99)
    total_interviews: number;       // tamanho da amostra
    population_size: number | null; // pop. de referência (null = infinita)
    deff: number;                   // Design Effect (1.0 = AAS pura)
    p_proportion: number;           // estimativa de p (0.5 padrão)
    stats_mode: 'auto' | 'manual';  // modo de cálculo
}

interface Props {
    value: SamplingStats;
    onChange: (v: SamplingStats) => void;
}

// ─── Helpers estatísticos ────────────────────────────────────────────────────

const Z_VALUES: Record<number, number> = {
    90: 1.645, 91: 1.695, 92: 1.751, 93: 1.812, 94: 1.880,
    95: 1.960, 96: 2.054, 97: 2.170, 98: 2.326, 99: 2.576,
};

function calcSampleSize(
    confidence: number,
    marginPct: number,
    p: number,
    populationSize: number | null,
    deff: number,
): number {
    const z = Z_VALUES[confidence] ?? 1.96;
    const E = marginPct / 100;
    const n0 = (z * z * p * (1 - p)) / (E * E);
    // Correção de população finita
    const n = populationSize && populationSize > 0
        ? n0 / (1 + (n0 - 1) / populationSize)
        : n0;
    return Math.ceil(n * (deff ?? 1));
}

function buildFormula(confidence: number, marginPct: number, p: number): string {
    const z = Z_VALUES[confidence] ?? 1.96;
    const zStr = z.toFixed(3).replace('.', ',');
    const pStr = p.toFixed(2).replace('.', ',');
    const eStr = (marginPct / 100).toFixed(2).replace('.', ',');
    return `n = (${zStr})² × ${pStr}×${(1 - p).toFixed(2).replace('.', ',')} / (${eStr})²`;
}

// ─── Sub-componente: Tooltip ──────────────────────────────────────────────────

function Tip({ text, helpId }: { text: string; helpId?: string }) {
    const topic = helpId ? HELP_TOPICS_BY_ID[helpId] : undefined;
    const href = topic ? `/help?q=${encodeURIComponent(topic.title)}#${topic.id}` : '/help';

    const handleMouseEnter = () => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(HELP_HOVER_EVENT, {
            detail: { id: topic?.id, title: topic?.title ?? 'Ajuda', text: topic?.short ?? text, href },
        }));
    };

    return (
        <span className="relative group inline-flex items-center ml-1" onMouseEnter={handleMouseEnter}>
            <HelpCircle size={14} className="text-slate-400 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-80 p-3 bg-slate-800 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                {text}
                <span className="mt-2 block">
                    <Link href={href} className="text-blue-200 underline underline-offset-2 hover:text-white">
                        Saber mais...
                    </Link>
                </span>
            </span>
        </span>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function StatisticsCalculator({ value, onChange }: Props) {
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [manualOverride, setManualOverride] = useState(false);

    const set = <K extends keyof SamplingStats>(key: K, val: SamplingStats[K]) => {
        const next = { ...value, [key]: val };
        // Ao mudar qualquer parâmetro no modo auto, recalcula total_interviews
        if (next.stats_mode === 'auto' && !manualOverride) {
            next.total_interviews = calcSampleSize(
                next.confidence_interval,
                next.margin_of_error,
                next.p_proportion,
                next.population_size,
                next.deff,
            );
        }
        onChange(next);
    };

    const switchMode = (mode: 'auto' | 'manual') => {
        setManualOverride(false);
        if (mode === 'auto') {
            const n = calcSampleSize(
                value.confidence_interval,
                value.margin_of_error,
                value.p_proportion,
                value.population_size,
                value.deff,
            );
            onChange({ ...value, stats_mode: 'auto', total_interviews: n });
        } else {
            onChange({ ...value, stats_mode: 'manual' });
        }
    };

    const recalculate = () => {
        setManualOverride(false);
        const n = calcSampleSize(
            value.confidence_interval,
            value.margin_of_error,
            value.p_proportion,
            value.population_size,
            value.deff,
        );
        onChange({ ...value, total_interviews: n });
    };

    const calculatedN = calcSampleSize(
        value.confidence_interval,
        value.margin_of_error,
        value.p_proportion,
        value.population_size,
        value.deff,
    );

    const isOverridden = value.stats_mode === 'auto' && value.total_interviews !== calculatedN;
    const hasPopulation = value.population_size != null && value.population_size > 0;
    const populationIsLarge = hasPopulation && value.population_size! >= 100_000;

    return (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 flex flex-col gap-4">
            {/* Cabeçalho */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calculator size={18} className="text-blue-600" />
                    <span className="font-semibold text-blue-900 text-sm">
                        Calculadora de Amostragem
                    </span>
                    <Tip
                        text="Define o tamanho mínimo da amostra com base em parâmetros estatísticos. Você pode usar o cálculo automático ou inserir seus próprios números."
                        helpId="sampling-calculator"
                    />
                </div>
            </div>

            {/* Seletor de modo */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={() => switchMode('auto')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition
                        ${value.stats_mode === 'auto'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}
                >
                    <Calculator size={15} />
                    Calcular automaticamente
                </button>
                <button
                    type="button"
                    onClick={() => switchMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition
                        ${value.stats_mode === 'manual'
                            ? 'bg-slate-700 text-white border-slate-700 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-500'}`}
                >
                    <PenLine size={15} />
                    Inserir manualmente
                </button>
            </div>

            {/* ── MODO AUTOMÁTICO ── */}
            {value.stats_mode === 'auto' && (
                <div className="flex flex-col gap-4">

                    {/* Nível de confiança */}
                    <div>
                        <label className="flex items-center text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Nível de Confiança
                            <Tip
                                text="Probabilidade de que o intervalo de confiança contenha o valor real. 95% é o padrão na maioria das pesquisas brasileiras (TSE, Datafolha, Quaest)."
                                helpId="confidence-interval"
                            />
                        </label>
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => set('confidence_interval', Math.max(90, value.confidence_interval - 1))}
                                disabled={value.confidence_interval <= 90}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-30 transition"
                                aria-label="Diminuir nível de confiança"
                            >
                                −
                            </button>
                            <div className="flex-1">
                                <input
                                    type="range"
                                    min={90}
                                    max={99}
                                    step={1}
                                    value={value.confidence_interval}
                                    onChange={e => set('confidence_interval', Number(e.target.value))}
                                    className="w-full accent-blue-600"
                                    aria-label="Nível de confiança"
                                />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                                    <span>90%</span>
                                    <span>95%</span>
                                    <span>99%</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => set('confidence_interval', Math.min(99, value.confidence_interval + 1))}
                                disabled={value.confidence_interval >= 99}
                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 disabled:opacity-30 transition"
                                aria-label="Aumentar nível de confiança"
                            >
                                +
                            </button>
                            <span className="min-w-[52px] text-center text-sm font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                                {value.confidence_interval}%
                            </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">
                            z = {(Z_VALUES[value.confidence_interval] ?? 1.96).toFixed(3).replace('.', ',')}
                        </p>
                    </div>

                    {/* Margem de erro */}
                    <div>
                        <label className="flex items-center text-xs font-semibold text-slate-700 mb-2 uppercase tracking-wide">
                            Margem de Erro
                            <Tip
                                text="Quanto menor a margem, maior a amostra necessária. Pesquisas eleitorais nacionais usam 2–2,2%. Para municípios menores, 3–5% é comum."
                                helpId="margin-error"
                            />
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="range"
                                min={1}
                                max={10}
                                step={0.5}
                                value={value.margin_of_error}
                                onChange={e => set('margin_of_error', Number(e.target.value))}
                                className="flex-1 accent-blue-600"
                                aria-label="Margem de erro em porcentagem"
                            />
                            <div className="flex items-center gap-1">
                                <input
                                    type="number"
                                    min={0.1}
                                    max={20}
                                    step={0.1}
                                    value={value.margin_of_error}
                                    onChange={e => set('margin_of_error', Math.max(0.1, Number(e.target.value)))}
                                    className="w-16 text-center border border-blue-300 bg-white rounded-lg px-2 py-1.5 text-sm font-bold text-blue-700 focus:ring-2 focus:ring-blue-500"
                                    aria-label="Valor da margem de erro"
                                />
                                <span className="text-sm font-bold text-blue-700">%</span>
                            </div>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                            <span>1% — alta precisão (amostra maior)</span>
                            <span>10% — menor rigor</span>
                        </div>
                        {/* Atalhos de margem */}
                        <div className="flex gap-2 mt-2 flex-wrap">
                            {[
                                { label: '2,0% (IBOPE/Quaest)', value: 2.0 },
                                { label: '2,2% (Datafolha)', value: 2.2 },
                                { label: '3%', value: 3.0 },
                                { label: '4%', value: 4.0 },
                                { label: '5%', value: 5.0 },
                            ].map(({ label, value: v }) => (
                                <button
                                    key={v}
                                    type="button"
                                    onClick={() => set('margin_of_error', v)}
                                    className={`text-xs px-3 py-1 rounded-full border transition
                                        ${value.margin_of_error === v
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'bg-white border-slate-300 text-slate-500 hover:border-blue-400 hover:text-blue-700'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Configurações avançadas */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced(v => !v)}
                            className="flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 font-medium"
                        >
                            {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            Configurações avançadas
                            <Tip
                                text="Ajuste o valor de p (estimativa de proporção) e o Efeito de Delineamento (Deff). O tamanho da população é calculado automaticamente a partir das localidades definidas na Etapa 2."
                                helpId="sampling-advanced"
                            />
                        </button>
                        {showAdvanced && (
                            <div className="mt-3 flex flex-col gap-4 bg-white/60 rounded-lg p-4 border border-blue-100">

                                {/* p_proportion */}
                                <div>
                                    <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5">
                                        Estimativa de proporção (p)
                                        <Tip
                                            text="Proporção esperada do parâmetro na população. Usar p = 0,50 garante a maior margem de erro possível (variância máxima), sendo o padrão conservador adotado pelo mercado."
                                            helpId="p-proportion"
                                        />
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={0.05}
                                            max={0.95}
                                            step={0.05}
                                            value={value.p_proportion}
                                            onChange={e => set('p_proportion', Number(e.target.value))}
                                            className="flex-1 accent-purple-600"
                                            aria-label="Estimativa de proporção p"
                                        />
                                        <span className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-purple-700">
                                            {(value.p_proportion * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                    {value.p_proportion === 0.5 && (
                                        <p className="text-[11px] text-slate-400 mt-1">
                                            ✓ Variância máxima — padrão conservador (recomendado)
                                        </p>
                                    )}
                                </div>

                                {/* deff */}
                                <div>
                                    <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5" htmlFor="deff">
                                        Efeito de Delineamento — Deff
                                        <Tip
                                            text="Em amostras por conglomerados ou cotas, a variância é maior que na AAS pura. O Deff multiplica o tamanho de amostra para compensar. 1,0 = amostra aleatória simples; 1,5–2,0 = amostragem por cotas típica."
                                            helpId="deff"
                                        />
                                    </label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="range"
                                            min={1}
                                            max={3}
                                            step={0.1}
                                            value={value.deff}
                                            onChange={e => set('deff', Number(e.target.value))}
                                            className="flex-1 accent-orange-500"
                                            aria-label="Efeito de delineamento"
                                        />
                                        <span className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-orange-700">
                                            {value.deff.toFixed(1)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                                        <span>1,0 — AAS pura (sem ajuste)</span>
                                        <span>3,0 — conglomerados</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Resultado do cálculo */}
                    <div className={`rounded-xl border-2 p-4 ${isOverridden ? 'border-amber-400 bg-amber-50' : 'border-blue-400 bg-white'}`}>
                        <div>
                            <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
                                {hasPopulation ? 'Tamanho de amostra calculado' : 'Estimativa de amostra'}
                            </p>
                            <p className="text-3xl font-extrabold text-blue-700 tabular-nums">
                                {calculatedN.toLocaleString('pt-BR')}
                                <span className="text-base font-normal text-slate-500 ml-1">entrevistas</span>
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 font-mono">
                                {buildFormula(value.confidence_interval, value.margin_of_error, value.p_proportion)} ≈ {calculatedN.toLocaleString('pt-BR')}
                                {value.deff !== 1 && ` × Deff ${value.deff.toFixed(1)}`}
                                {hasPopulation ? ` (pop. finita N=${value.population_size!.toLocaleString('pt-BR')})` : ''}
                            </p>

                            {/* Status da população */}
                            {!hasPopulation ? (
                                <div className="mt-3 flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-600">
                                    <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
                                    <span>
                                        <strong>Estimativa preliminar</strong> — calculada assumindo população grande (&gt; 100.000 pessoas).
                                        O valor será <strong>recalculado automaticamente</strong> quando você adicionar as localidades na{' '}
                                        <strong>Etapa 2</strong>, aplicando a correção de população finita por município.
                                    </span>
                                </div>
                            ) : populationIsLarge ? (
                                <div className="mt-3 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                                    <MapPin size={13} className="mt-0.5 shrink-0" />
                                    <span>
                                        ✓ População total (Etapa 2): <strong>{value.population_size!.toLocaleString('pt-BR')}</strong> pessoas.
                                        Para este universo, a correção de pop. finita tem impacto mínimo.
                                    </span>
                                </div>
                            ) : (
                                <div className="mt-3 flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-700">
                                    <MapPin size={13} className="mt-0.5 shrink-0" />
                                    <span>
                                        ✓ Fator de correção de pop. finita aplicado —
                                        população total (Etapa 2): <strong>{value.population_size!.toLocaleString('pt-BR')}</strong> pessoas.
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Campo de total_interviews (editável manualmente) */}
                        <div className="mt-4 border-t border-slate-200 pt-4">
                            <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5" htmlFor="total_interviews_auto">
                                Total de entrevistas a realizar
                                <Tip
                                    text="Preenchido automaticamente pela calculadora. Você pode ajustar manualmente caso precise arredondar ou adaptar à capacidade operacional."
                                    helpId="total-interviews"
                                />
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    id="total_interviews_auto"
                                    type="number"
                                    min={1}
                                    value={value.total_interviews || ''}
                                    onChange={e => {
                                        setManualOverride(true);
                                        onChange({ ...value, total_interviews: Number(e.target.value) });
                                    }}
                                    className="w-32 border border-slate-300 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-blue-500"
                                    aria-label="Total de entrevistas"
                                />
                                {isOverridden && (
                                    <button
                                        type="button"
                                        onClick={recalculate}
                                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 border border-blue-300 rounded-lg px-3 py-1.5 bg-blue-50 hover:bg-blue-100 transition"
                                    >
                                        <RefreshCw size={12} />
                                        Recalcular
                                    </button>
                                )}
                                {isOverridden && (
                                    <span className="text-xs text-amber-600 font-medium">
                                        ⚠ Valor ajustado manualmente (calculado: {calculatedN.toLocaleString('pt-BR')})
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabela de referência rápida */}
                    <details className="group">
                        <summary className="cursor-pointer text-xs text-blue-700 hover:text-blue-900 font-medium select-none flex items-center gap-1">
                            <ChevronDown size={14} className="group-open:rotate-180 transition-transform" />
                            Tabela de referência: amostra × margem de erro (IC 95%)
                        </summary>
                        <div className="mt-2 overflow-hidden rounded-lg border border-blue-100">
                            <table className="w-full text-xs text-slate-600">
                                <thead className="bg-blue-100 text-slate-700 font-semibold">
                                    <tr>
                                        <th className="text-left px-3 py-2">Margem de erro</th>
                                        <th className="text-right px-3 py-2">Amostra (n)</th>
                                        <th className="text-right px-3 py-2 hidden sm:table-cell">Referência</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { e: 1.0, n: 9604, ref: '—' },
                                        { e: 2.0, n: 2401, ref: 'IBOPE / Quaest nacional' },
                                        { e: 2.2, n: 2000, ref: 'Datafolha (padrão)' },
                                        { e: 3.0, n: 1067, ref: 'Municipal médio' },
                                        { e: 4.0, n: 600, ref: 'Municipal pequeno' },
                                        { e: 5.0, n: 384, ref: 'Piloto / baixo orçamento' },
                                    ].map(row => (
                                        <tr
                                            key={row.e}
                                            className={`border-t border-blue-50 hover:bg-blue-50 cursor-pointer transition
                                                ${value.margin_of_error === row.e ? 'bg-blue-100 font-semibold' : ''}`}
                                            onClick={() => set('margin_of_error', row.e)}
                                        >
                                            <td className="px-3 py-1.5">± {row.e.toFixed(1).replace('.', ',')}%</td>
                                            <td className="px-3 py-1.5 text-right tabular-nums">{row.n.toLocaleString('pt-BR')}</td>
                                            <td className="px-3 py-1.5 text-right text-slate-400 hidden sm:table-cell">{row.ref}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </details>
                </div>
            )}

            {/* ── MODO MANUAL ── */}
            {value.stats_mode === 'manual' && (
                <div className="flex flex-col gap-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                        <strong>Modo manual:</strong> os parâmetros abaixo serão usados como referência no relatório, mas não há cálculo automático de amostra. Você define livremente o total de entrevistas.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5" htmlFor="me_manual">
                                Margem de Erro (%)
                                <Tip text="Valor que constará no relatório como parâmetro da pesquisa." helpId="margin-error" />
                            </label>
                            <div className="flex items-center gap-1">
                                <input
                                    id="me_manual"
                                    type="number"
                                    min={0}
                                    max={50}
                                    step={0.1}
                                    value={value.margin_of_error || ''}
                                    onChange={e => set('margin_of_error', Number(e.target.value))}
                                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                    placeholder="ex: 3"
                                    aria-label="Margem de erro manual"
                                />
                                <span className="text-sm text-slate-500">%</span>
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5" htmlFor="ci_manual">
                                Intervalo de Confiança (%)
                                <Tip text="Nível de confiança estatística declarado. Consta no relatório." helpId="confidence-interval" />
                            </label>
                            <div className="flex gap-2">
                                {[90, 95, 99].map(ic => (
                                    <button
                                        key={ic}
                                        type="button"
                                        onClick={() => set('confidence_interval', ic)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition
                                            ${value.confidence_interval === ic
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white border-slate-300 text-slate-600 hover:border-blue-400'}`}
                                    >
                                        {ic}%
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="flex items-center text-xs font-semibold text-slate-700 mb-1.5" htmlFor="total_interviews_manual">
                                Total de Entrevistas
                                <Tip text="Quantidade total de entrevistas planejadas para esta pesquisa." helpId="total-interviews" />
                            </label>
                            <input
                                id="total_interviews_manual"
                                type="number"
                                min={1}
                                value={value.total_interviews || ''}
                                onChange={e => set('total_interviews', Number(e.target.value))}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                                placeholder="ex: 1.200"
                                aria-label="Total de entrevistas manual"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
