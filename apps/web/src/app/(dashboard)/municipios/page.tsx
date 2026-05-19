'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    MapPin, Search, RefreshCw, ChevronRight,
    AlertCircle, Loader2, Database, Globe2,
    Users, TrendingUp, Building2, BarChart3,
} from 'lucide-react';

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface MunicipioResumo {
    id_ibge: number;
    nome: string;
    uf: string;
    regiao: string | null;
    populacao_estimada: number | null;
    area_km2: number | null;
    total_localidades: number;
    localidades_urbanas: number;
    localidades_rurais: number;
    populacao_censo: number;
    populacao_masculina: number | null;
    populacao_feminina: number | null;
    faixas_etarias: Record<string, number> | null;
    escolaridade: Record<string, number> | null;
    total_eleitores: number;
    percentual_eleitores: number | null;
    ingestoes_concluidas: number;
    ultima_ingestao_em: string | null;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const REGIOES = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const UFS_BY_REGIAO: Record<string, string[]> = {
    Norte: ['AC', 'AM', 'AP', 'PA', 'RO', 'RR', 'TO'],
    Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
    'Centro-Oeste': ['DF', 'GO', 'MS', 'MT'],
    Sudeste: ['ES', 'MG', 'RJ', 'SP'],
    Sul: ['PR', 'RS', 'SC'],
};
const ALL_UFS = Object.values(UFS_BY_REGIAO).flat().sort();

// Faixas etárias: agrupadas em 4 grandes grupos para exibição resumida
const FAIXAS_JOVEM = ['0_4', '5_9', '10_14', '15_19', '20_24'];
const FAIXAS_ADULTO = ['25_29', '30_34', '35_39', '40_44', '45_49'];
const FAIXAS_MEIA = ['50_54', '55_59', '60_64'];
const FAIXAS_IDOSO = ['65_69', '70_74', '75_79', '80_84', '85_89', '90_mais'];

function sumFaixas(fx: Record<string, number> | null, keys: string[]): number {
    if (!fx) return 0;
    return keys.reduce((acc, k) => acc + (fx[k] ?? 0), 0);
}

function dominantFaixa(fx: Record<string, number> | null): string {
    if (!fx) return '—';
    const grupos = [
        { label: 'Jovens (0–24)', v: sumFaixas(fx, FAIXAS_JOVEM) },
        { label: 'Adultos (25–49)', v: sumFaixas(fx, FAIXAS_ADULTO) },
        { label: 'Meia-idade (50–64)', v: sumFaixas(fx, FAIXAS_MEIA) },
        { label: 'Idosos (65+)', v: sumFaixas(fx, FAIXAS_IDOSO) },
    ];
    return grupos.reduce((a, b) => (b.v > a.v ? b : a)).label;
}

function ingestaoLabel(n: number) {
    if (n === 0) return { label: 'Sem dados', color: 'text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500' };
    if (n < 3) return { label: 'Parcial', color: 'text-amber-700 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400' };
    return { label: 'Completo', color: 'text-green-700 bg-green-100 dark:bg-green-900/30 dark:text-green-400' };
}

function fmt(n: number | null | undefined) {
    if (n == null) return '—';
    return n.toLocaleString('pt-BR');
}

function pct(num: number | null | undefined, den: number | null | undefined, dec = 1): string {
    if (!num || !den || den === 0) return '—';
    return (num / den * 100).toFixed(dec) + '%';
}

// Mini barra horizontal masc/fem
function SexBar({ masc, fem }: { masc: number | null; fem: number | null }) {
    if (!masc || !fem || masc + fem === 0) return <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>;
    const total = masc + fem;
    const pM = Math.round(masc / total * 100);
    const pF = 100 - pM;
    return (
        <div className="flex flex-col items-center gap-0.5">
            <div className="flex w-16 h-2 rounded-full overflow-hidden">
                <div className="bg-blue-400" style={{ width: `${pM}%` }} title={`Masc. ${pM}%`} />
                <div className="bg-pink-400" style={{ width: `${pF}%` }} title={`Fem. ${pF}%`} />
            </div>
            <span className="text-[10px] text-slate-400 tabular-nums">
                <span className="text-blue-500">{pM}%</span>
                {' / '}
                <span className="text-pink-500">{pF}%</span>
            </span>
        </div>
    );
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function MunicipiosPage() {
    const [municipios, setMunicipios] = useState<MunicipioResumo[]>([]);
    const [pagination, setPagination] = useState<Pagination | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [q, setQ] = useState('');
    const [uf, setUf] = useState('');
    const [regiao, setRegiao] = useState('');
    const [page, setPage] = useState(1);

    const fetchMunicipios = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({ page: String(page), limit: '20' });
            if (q) params.set('q', q);
            if (uf) params.set('uf', uf);
            if (regiao) params.set('regiao', regiao);

            const res = await fetch(`/api/geo/municipios?${params}`);
            if (!res.ok) throw new Error('Erro ao buscar municípios');
            const json = await res.json();
            setMunicipios(json.data?.municipios ?? []);
            setPagination(json.data?.pagination ?? null);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro inesperado');
        } finally {
            setLoading(false);
        }
    }, [q, uf, regiao, page]);

    useEffect(() => {
        fetchMunicipios();
    }, [fetchMunicipios]);

    // Reset página ao mudar filtros
    const applyFilter = (fn: () => void) => { fn(); setPage(1); };

    // KPIs derivados da página atual
    const totalPop = municipios.reduce((s, m) => s + (m.populacao_censo || m.populacao_estimada || 0), 0);
    const totalEleit = municipios.reduce((s, m) => s + m.total_eleitores, 0);
    const comDados = municipios.filter(m => m.ingestoes_concluidas > 0).length;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Cabeçalho */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                <div className="max-w-7xl mx-auto flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                        <Globe2 size={18} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                            Base Geográfica
                        </h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Municípios com dados IBGE Censo 2022 + TSE 2024 — indicadores para planejamento de pesquisa
                        </p>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

                {/* KPI Cards */}
                {municipios.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <MapPin size={14} className="text-blue-500" />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Municípios</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(pagination?.total)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">{fmt(comDados)} com dados nesta página</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Users size={14} className="text-purple-500" />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">População</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(totalPop)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Censo 2022 / estimado</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <BarChart3 size={14} className="text-green-500" />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Eleitores</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(totalEleit)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">TSE 2024 nesta página</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp size={14} className="text-amber-500" />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Eleitorado</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {totalPop > 0 ? (totalEleit / totalPop * 100).toFixed(1) + '%' : '—'}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">% eleitores / população</p>
                        </div>
                    </div>
                )}

                {/* Filtros */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                                Buscar município
                            </label>
                            <div className="relative">
                                <Search size={15} className="absolute left-3 top-2.5 text-slate-400" />
                                <input
                                    type="text"
                                    value={q}
                                    onChange={(e) => applyFilter(() => setQ(e.target.value))}
                                    placeholder="Nome do município..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                        </div>
                        <div className="w-28">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">UF</label>
                            <select
                                value={uf}
                                onChange={(e) => applyFilter(() => { setUf(e.target.value); setRegiao(''); })}
                                aria-label="Filtrar por UF"
                                className="w-full py-2 px-3 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Todas</option>
                                {ALL_UFS.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div className="w-40">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">Região</label>
                            <select
                                value={regiao}
                                onChange={(e) => applyFilter(() => { setRegiao(e.target.value); setUf(''); })}
                                aria-label="Filtrar por região"
                                className="w-full py-2 px-3 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="">Todas</option>
                                {REGIOES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <button
                            onClick={fetchMunicipios}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                            Atualizar
                        </button>
                    </div>
                </div>

                {/* Erro */}
                {error && (
                    <div className="flex items-center gap-2 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
                        <AlertCircle size={16} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* Aviso base vazia */}
                {!loading && !error && municipios.length === 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-12 text-center">
                        <Database size={36} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="text-slate-600 dark:text-slate-400 font-medium mb-1">
                            Base geográfica ainda não populada
                        </p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-md mx-auto">
                            Utilize os scripts ETL para carregar os dados do IBGE Censo 2022 e do TSE.
                        </p>
                    </div>
                )}

                {/* Tabela */}
                {(loading || municipios.length > 0) && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        {loading && (
                            <div className="flex items-center justify-center py-12 gap-2 text-slate-400">
                                <Loader2 size={20} className="animate-spin" />
                                <span className="text-sm">Carregando...</span>
                            </div>
                        )}

                        {!loading && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide min-w-[180px]">
                                                Município
                                            </th>
                                            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                UF
                                            </th>
                                            <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                População
                                            </th>
                                            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Sexo M/F
                                            </th>
                                            <th className="text-right px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Eleitores
                                            </th>
                                            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                % Eleitorado
                                            </th>
                                            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                % Urban.
                                            </th>
                                            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Faixa Dom.
                                            </th>
                                            <th className="text-center px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Cobertura
                                            </th>
                                            <th className="px-3 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {municipios.map((m) => {
                                            const badge = ingestaoLabel(m.ingestoes_concluidas);
                                            const popTotal = m.populacao_censo || m.populacao_estimada;
                                            const pctUrb = m.total_localidades > 0
                                                ? Math.round(m.localidades_urbanas / m.total_localidades * 100)
                                                : null;
                                            return (
                                                <tr
                                                    key={m.id_ibge}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                                                >
                                                    {/* Município */}
                                                    <td className="px-4 py-3">
                                                        <Link
                                                            href={`/municipios/${m.id_ibge}`}
                                                            className="flex items-center gap-2 font-medium text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition"
                                                        >
                                                            <MapPin size={13} className="text-slate-400 shrink-0" />
                                                            {m.nome}
                                                        </Link>
                                                        {m.regiao && (
                                                            <span className="text-xs text-slate-400 ml-5">{m.regiao}</span>
                                                        )}
                                                    </td>
                                                    {/* UF */}
                                                    <td className="px-3 py-3 text-center">
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                            {m.uf}
                                                        </span>
                                                    </td>
                                                    {/* População */}
                                                    <td className="px-3 py-3 text-right tabular-nums">
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                                            {fmt(popTotal)}
                                                        </span>
                                                        {m.populacao_censo === 0 && m.populacao_estimada && (
                                                            <span className="block text-[10px] text-slate-400">estimado</span>
                                                        )}
                                                    </td>
                                                    {/* Sexo M/F mini bar */}
                                                    <td className="px-3 py-3 text-center">
                                                        <SexBar masc={m.populacao_masculina} fem={m.populacao_feminina} />
                                                    </td>
                                                    {/* Eleitores */}
                                                    <td className="px-3 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                                        {fmt(m.total_eleitores)}
                                                    </td>
                                                    {/* % Eleitorado */}
                                                    <td className="px-3 py-3 text-center">
                                                        {m.percentual_eleitores != null ? (
                                                            <span className={`text-xs font-medium tabular-nums ${m.percentual_eleitores > 80 ? 'text-green-700 dark:text-green-400' :
                                                                    m.percentual_eleitores > 60 ? 'text-blue-700 dark:text-blue-400' :
                                                                        'text-slate-600 dark:text-slate-400'
                                                                }`}>
                                                                {m.percentual_eleitores.toFixed(1)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    {/* % Urbanização */}
                                                    <td className="px-3 py-3 text-center">
                                                        {pctUrb !== null ? (
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <div className="w-12 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-indigo-400 rounded-full"
                                                                        style={{ width: `${pctUrb}%` }}
                                                                    />
                                                                </div>
                                                                <span className="text-[10px] tabular-nums text-slate-500 dark:text-slate-400">{pctUrb}%</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                                                        )}
                                                    </td>
                                                    {/* Faixa Etária Dominante */}
                                                    <td className="px-3 py-3 text-center">
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            {dominantFaixa(m.faixas_etarias)}
                                                        </span>
                                                    </td>
                                                    {/* Cobertura */}
                                                    <td className="px-3 py-3 text-center">
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    {/* Ação */}
                                                    <td className="px-3 py-3 text-right">
                                                        <Link
                                                            href={`/municipios/${m.id_ibge}`}
                                                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                                                        >
                                                            Analisar <ChevronRight size={12} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* Paginação */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {fmt(pagination.total)} municípios · página {pagination.page} de {pagination.totalPages}
                                </span>
                                <div className="flex gap-1">
                                    <button
                                        disabled={page <= 1}
                                        onClick={() => setPage((p) => p - 1)}
                                        className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        disabled={page >= pagination.totalPages}
                                        onClick={() => setPage((p) => p + 1)}
                                        className="px-3 py-1.5 text-xs border border-slate-200 dark:border-slate-700 rounded-lg disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                                    >
                                        Próxima
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Legenda */}
                {municipios.length > 0 && (
                    <div className="flex flex-wrap gap-4 text-xs text-slate-400 dark:text-slate-500 pb-2">
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-1.5 rounded-full bg-blue-400 inline-block" /> Masculino
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-1.5 rounded-full bg-pink-400 inline-block" /> Feminino
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-3 h-1.5 rounded-full bg-indigo-400 inline-block" /> % Urbanização (localidades)
                        </span>
                        <span>· Faixa Dom. = grupo etário com maior população</span>
                        <span>· Cobertura: Parcial = 1-2 fontes, Completo = 3 fontes (TSE + IBGE demog. + estimativa)</span>
                    </div>
                )}
            </div>
        </div>
    );
}
