'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, MapPin, Users, BarChart2, Building2, Globe2,
    Loader2, AlertCircle, RefreshCw, CheckCircle2, Database,
    TreePine, Home, ChevronRight, Info, Activity, TrendingUp,
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

interface Localidade {
    localidade_id: number;
    localidade: string;
    tipo_localidade: string;
    zona: string;
    total_habitantes: number;
    total_eleitores: number;
    percentual_eleitores_populacao: number | null;
    metodo_vinculo_eleitoral: string | null;
    fonte: string;
    ibge_id: number | null;
}

interface Stats {
    total_localidades: number;
    localidades_urbanas: number;
    localidades_rurais: number;
    com_dados_demograficos: number;
    com_dados_eleitorais: number;
    por_tipo: Record<string, number>;
}

interface IngestaoLog {
    operacao: string;
    status: string;
    registros_total: number;
    registros_novos: number;
    registros_erro: number;
    concluido_em: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
    if (n == null) return '—';
    return n.toLocaleString('pt-BR');
}

const TIPO_ICONS: Record<string, React.ElementType> = {
    BAIRRO: Home,
    DISTRITO: MapPin,
    SUBDISTRITO: MapPin,
    SITIO: TreePine,
    FAZENDA: TreePine,
    POVOADO: Building2,
    VILA: Home,
    NUCLEO: Building2,
    OUTROS: Globe2,
};

const ZONA_LABEL: Record<string, { label: string; color: string }> = {
    URBANA: { label: 'Urbana', color: 'text-blue-700 bg-blue-100' },
    RURAL: { label: 'Rural', color: 'text-green-700 bg-green-100' },
    MISTA: { label: 'Mista', color: 'text-amber-700 bg-amber-100' },
};

const METODO_LABEL: Record<string, string> = {
    EXATO: 'Exato',
    ESPACIAL: 'Espacial',
    BACIA: 'Bacia',
    MANUAL: 'Manual',
};

// ─── Card de métrica ─────────────────────────────────────────────────────────

function MetricCard({
    icon: Icon, label, value, sub, color = 'text-blue-600',
}: {
    icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string;
}) {
    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex items-start gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color === 'text-blue-600' ? 'bg-blue-50 dark:bg-blue-900/30' : color === 'text-green-600' ? 'bg-green-50 dark:bg-green-900/30' : color === 'text-purple-600' ? 'bg-purple-50 dark:bg-purple-900/30' : 'bg-amber-50 dark:bg-amber-900/30'}`}>
                <Icon size={18} className={color} />
            </div>
            <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
                <p className="text-xl font-bold text-slate-900 dark:text-white tabular-nums">{value}</p>
                {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
            </div>
        </div>
    );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MunicipioDetalhePage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.id as string;

    const [municipio, setMunicipio] = useState<MunicipioResumo | null>(null);
    const [localidades, setLocalidades] = useState<Localidade[]>([]);
    const [stats, setStats] = useState<Stats | null>(null);
    const [historico, setHistorico] = useState<IngestaoLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroZona, setFiltroZona] = useState('');
    const [busca, setBusca] = useState('');

    const fetchData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError('');
        try {
            const res = await fetch(`/api/geo/municipios/${id}`);
            if (res.status === 404) {
                setError('Município não encontrado.');
                return;
            }
            if (!res.ok) throw new Error('Erro ao carregar município');
            const json = await res.json();
            setMunicipio(json.data?.municipio ?? null);
            setLocalidades(json.data?.localidades ?? []);
            setStats(json.data?.stats ?? null);
            setHistorico(json.data?.historico_ingestao ?? []);
        } catch (e) {
            setError(e instanceof Error ? e.message : 'Erro inesperado');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Filtro local de localidades
    const localidadesFiltradas = localidades.filter((l) => {
        if (filtroTipo && l.tipo_localidade !== filtroTipo) return false;
        if (filtroZona && l.zona !== filtroZona) return false;
        if (busca && !l.localidade.toLowerCase().includes(busca.toLowerCase())) return false;
        return true;
    });

    const tiposDisponiveis = [...new Set(localidades.map((l) => l.tipo_localidade))].sort();

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen gap-2 text-slate-400">
                <Loader2 size={22} className="animate-spin" />
                <span>Carregando município...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-lg mx-auto mt-20 p-6 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <div>
                    <p className="font-semibold mb-1">Erro ao carregar</p>
                    <p>{error}</p>
                    <button onClick={() => router.back()} className="mt-3 text-xs underline">Voltar</button>
                </div>
            </div>
        );
    }

    if (!municipio) return null;

    const coberturaDemo = stats && stats.total_localidades > 0
        ? Math.round((stats.com_dados_demograficos / stats.total_localidades) * 100)
        : 0;
    const coberturaEleit = stats && stats.total_localidades > 0
        ? Math.round((stats.com_dados_eleitorais / stats.total_localidades) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Cabeçalho */}
            <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-5">
                <div className="max-w-7xl mx-auto">
                    <div className="flex items-center gap-3 mb-3">
                        <Link
                            href="/municipios"
                            className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition"
                        >
                            <ArrowLeft size={15} /> Municípios
                        </Link>
                        <ChevronRight size={13} className="text-slate-300 dark:text-slate-600" />
                        <span className="text-sm text-slate-900 dark:text-white font-medium">
                            {municipio.nome} – {municipio.uf}
                        </span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <MapPin size={22} className="text-blue-600" />
                                {municipio.nome}
                                <span className="text-base font-normal text-slate-400">{municipio.uf}</span>
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                                {municipio.regiao && `${municipio.regiao} · `}
                                IBGE: {municipio.id_ibge}
                                {municipio.area_km2 && ` · ${municipio.area_km2.toLocaleString('pt-BR')} km²`}
                            </p>
                        </div>
                        <button
                            onClick={fetchData}
                            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-500 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                        >
                            <RefreshCw size={13} /> Atualizar
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

                {/* Métricas principais */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <MetricCard
                        icon={Globe2} label="Pop. Estimada IBGE"
                        value={fmt(municipio.populacao_estimada)}
                        color="text-blue-600"
                    />
                    <MetricCard
                        icon={Users} label="Eleitores (TSE)"
                        value={fmt(municipio.total_eleitores)}
                        sub={municipio.percentual_eleitores != null
                            ? `${municipio.percentual_eleitores.toFixed(1)}% da pop.`
                            : undefined}
                        color="text-purple-600"
                    />
                    <MetricCard
                        icon={MapPin} label="Localidades"
                        value={fmt(municipio.total_localidades)}
                        sub={`${municipio.localidades_urbanas} urbanas · ${municipio.localidades_rurais} rurais`}
                        color="text-green-600"
                    />
                    <MetricCard
                        icon={Activity} label="Pop. Censo 2022"
                        value={fmt(municipio.populacao_censo || municipio.populacao_estimada)}
                        color="text-amber-600"
                    />
                </div>

                {/* Cobertura de dados */}
                {stats && stats.total_localidades > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
                        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
                            <Database size={15} className="text-blue-500" />
                            Cobertura de Dados por Localidade
                        </h2>
                        <div className="grid sm:grid-cols-2 gap-4">
                            {/* Demograficos */}
                            <div>
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                    <span>Dados demográficos (IBGE Censo)</span>
                                    <span className="font-medium">{coberturaDemo}%</span>
                                </div>
                                <progress
                                    value={coberturaDemo}
                                    max={100}
                                    className="w-full h-2 rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 dark:[&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-blue-500"
                                    aria-label="Cobertura demográfica"
                                />
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    {stats.com_dados_demograficos} de {stats.total_localidades} localidades
                                </p>
                            </div>
                            {/* Eleitorais */}
                            <div>
                                <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                                    <span>Dados eleitorais (TSE)</span>
                                    <span className="font-medium">{coberturaEleit}%</span>
                                </div>
                                <progress
                                    value={coberturaEleit}
                                    max={100}
                                    className="w-full h-2 rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-slate-100 dark:[&::-webkit-progress-bar]:bg-slate-800 [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-purple-500"
                                    aria-label="Cobertura eleitoral"
                                />
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    {stats.com_dados_eleitorais} de {stats.total_localidades} localidades
                                </p>
                            </div>
                        </div>

                        {/* Por tipo */}
                        {Object.keys(stats.por_tipo).length > 0 && (
                            <div className="mt-4 flex flex-wrap gap-2">
                                {Object.entries(stats.por_tipo)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([tipo, qtd]) => (
                                        <span
                                            key={tipo}
                                            className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full"
                                        >
                                            {tipo} <span className="font-semibold">{qtd}</span>
                                        </span>
                                    ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Tabela de Localidades */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <MapPin size={15} className="text-green-500" />
                                Localidades ({localidadesFiltradas.length}
                                {localidadesFiltradas.length !== localidades.length && ` / ${localidades.length}`})
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {/* Busca */}
                                <input
                                    type="text"
                                    value={busca}
                                    onChange={(e) => setBusca(e.target.value)}
                                    placeholder="Filtrar por nome..."
                                    aria-label="Filtrar por nome"
                                    className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none w-40"
                                />
                                {/* Tipo */}
                                <select
                                    value={filtroTipo}
                                    onChange={(e) => setFiltroTipo(e.target.value)}
                                    aria-label="Filtrar por tipo"
                                    className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Todos os tipos</option>
                                    {tiposDisponiveis.map((t) => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                                {/* Zona */}
                                <select
                                    value={filtroZona}
                                    onChange={(e) => setFiltroZona(e.target.value)}
                                    aria-label="Filtrar por zona"
                                    className="text-xs px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="">Todas as zonas</option>
                                    <option value="URBANA">Urbana</option>
                                    <option value="RURAL">Rural</option>
                                    <option value="MISTA">Mista</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {localidades.length === 0 ? (
                        <div className="py-12 text-center">
                            <Database size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Nenhuma localidade carregada. Execute o ETL para importar os dados do IBGE/TSE.
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Localidade</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Zona</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Habitantes</th>
                                        <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Eleitores</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">% Eleit.</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Vínculo TSE</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Fonte</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {localidadesFiltradas.map((l) => {
                                        const IconTipo = TIPO_ICONS[l.tipo_localidade] ?? MapPin;
                                        const zona = ZONA_LABEL[l.zona] ?? { label: l.zona, color: 'text-slate-600 bg-slate-100' };
                                        return (
                                            <tr key={l.localidade_id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                                <td className="px-4 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <IconTipo size={13} className="text-slate-400 shrink-0" />
                                                        <span className="font-medium text-slate-800 dark:text-slate-200">
                                                            {l.localidade}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className="text-xs text-slate-500 dark:text-slate-400">{l.tipo_localidade}</span>
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${zona.color}`}>
                                                        {zona.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                                    {l.total_habitantes > 0 ? fmt(l.total_habitantes) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                                                    {l.total_eleitores > 0 ? fmt(l.total_eleitores) : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-center tabular-nums text-slate-600 dark:text-slate-300">
                                                    {l.percentual_eleitores_populacao != null
                                                        ? `${l.percentual_eleitores_populacao.toFixed(1)}%`
                                                        : <span className="text-slate-300 dark:text-slate-600">—</span>}
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    {l.metodo_vinculo_eleitoral ? (
                                                        <span className="text-xs text-slate-500 dark:text-slate-400">
                                                            {METODO_LABEL[l.metodo_vinculo_eleitoral] ?? l.metodo_vinculo_eleitoral}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2.5 text-center">
                                                    <span className="text-xs text-slate-400 dark:text-slate-500">{l.fonte}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Aviso sobre dados rurais */}
                <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-900/10 text-sm text-amber-800 dark:text-amber-300">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <div>
                        <p className="font-semibold mb-0.5">Dados eleitorais em áreas rurais</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                            Em zonas rurais isoladas, os dados eleitorais de um local de votação refletem a
                            soma de moradores de vários sítios vizinhos (<strong>bacia de captação</strong>).
                            O campo <em>Vínculo TSE</em> indica o método usado: BACIA = raio de influência,
                            ESPACIAL = ST_Distance PostGIS, EXATO = correspondência de nome, MANUAL = auditado.
                        </p>
                    </div>
                </div>

                {/* Histórico de ingestão */}
                {historico.length > 0 && (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                                <Database size={15} className="text-slate-400" />
                                Histórico de Ingestão ETL
                            </h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                                        <th className="text-left px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Operação</th>
                                        <th className="text-center px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Total</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Novos</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Erros</th>
                                        <th className="text-right px-4 py-2.5 font-semibold text-slate-500 uppercase tracking-wide">Concluído em</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {historico.map((h, i) => (
                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                                            <td className="px-4 py-2.5 font-mono text-slate-600 dark:text-slate-300">{h.operacao}</td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className={`font-medium px-2 py-0.5 rounded-full ${h.status === 'concluido' ? 'text-green-700 bg-green-100' :
                                                    h.status === 'erro' ? 'text-red-700 bg-red-100' :
                                                        h.status === 'em_andamento' ? 'text-blue-700 bg-blue-100' :
                                                            'text-slate-600 bg-slate-100'
                                                    }`}>
                                                    {h.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{fmt(h.registros_total)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">{fmt(h.registros_novos)}</td>
                                            <td className="px-4 py-2.5 text-right tabular-nums text-red-500">{h.registros_erro > 0 ? fmt(h.registros_erro) : '—'}</td>
                                            <td className="px-4 py-2.5 text-right text-slate-400">
                                                {h.concluido_em
                                                    ? new Date(h.concluido_em).toLocaleString('pt-BR')
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
