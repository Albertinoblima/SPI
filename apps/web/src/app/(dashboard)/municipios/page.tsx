'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
    MapPin, Search, Filter, RefreshCw, ChevronRight,
    Building2, Users, BarChart2, AlertCircle, Loader2,
    Database, Globe2,
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

const STATUS_INGESTAO = {
    0: { label: 'Sem dados', color: 'text-slate-400 bg-slate-100' },
    1: { label: 'Parcial', color: 'text-amber-700 bg-amber-100' },
};

function ingestaoLabel(n: number) {
    if (n === 0) return STATUS_INGESTAO[0];
    if (n < 3) return STATUS_INGESTAO[1];
    return { label: 'Completo', color: 'text-green-700 bg-green-100' };
}

function fmt(n: number | null | undefined) {
    if (n == null) return '—';
    return n.toLocaleString('pt-BR');
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

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Cabeçalho */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
                            <Globe2 size={18} className="text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                                Base Geográfica de Municípios
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Dados IBGE + TSE unificados por cruzamento espacial PostGIS
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-5">

                {/* Filtros */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                    <div className="flex flex-wrap gap-3 items-end">
                        {/* Busca */}
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

                        {/* UF */}
                        <div className="w-28">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                                UF
                            </label>
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

                        {/* Região */}
                        <div className="w-40">
                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
                                Região
                            </label>
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
                            Utilize os scripts ETL (Python/GeoPandas) para carregar os dados do IBGE CNEFE
                            e do TSE. Consulte a documentação em <code className="text-blue-600">docs/TSE_VOTER_DATA.md</code>.
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
                                            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Município
                                            </th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                UF
                                            </th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Localidades
                                            </th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Pop. Censo
                                            </th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Eleitores
                                            </th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                % Eleit.
                                            </th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                                Dados
                                            </th>
                                            <th className="px-4 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                        {municipios.map((m) => {
                                            const badge = ingestaoLabel(m.ingestoes_concluidas);
                                            return (
                                                <tr
                                                    key={m.id_ibge}
                                                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                                                >
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
                                                    <td className="px-4 py-3 text-center">
                                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                                                            {m.uf}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        {m.total_localidades > 0 ? (
                                                            <span className="font-medium text-slate-800 dark:text-slate-200">
                                                                {fmt(m.total_localidades)}
                                                                <span className="text-xs text-slate-400 ml-1">
                                                                    ({m.localidades_urbanas}U / {m.localidades_rurais}R)
                                                                </span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                                        {fmt(m.populacao_censo || m.populacao_estimada)}
                                                    </td>
                                                    <td className="px-4 py-3 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                                        {fmt(m.total_eleitores)}
                                                    </td>
                                                    <td className="px-4 py-3 text-center tabular-nums">
                                                        {m.percentual_eleitores != null ? (
                                                            <span className="text-slate-700 dark:text-slate-300">
                                                                {m.percentual_eleitores.toFixed(1)}%
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-300 dark:text-slate-600">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
                                                            {badge.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <Link
                                                            href={`/municipios/${m.id_ibge}`}
                                                            className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
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
            </div>
        </div>
    );
}
