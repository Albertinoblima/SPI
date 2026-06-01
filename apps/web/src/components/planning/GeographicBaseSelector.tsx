'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapPin, X, Loader2, Plus, CheckSquare, Square, Filter } from 'lucide-react';
import { getSurveyDecision, allowedGeoLevels, type GeoScope } from '@/lib/survey-decisions';
import type { GeographicBaseSelection, PlanningMunicipality, PlanningLocality } from './types';

interface Props {
  value: GeographicBaseSelection;
  onChange: (data: GeographicBaseSelection) => void;
  researchType?: string;
}

interface MunicipalitySearchResult {
  id?: string;
  ibge_id?: number;
  name: string;
  uf?: string;
  population?: number;
  populacao_estimada?: number;
  populacao_censo?: number;
}

interface LocalitySearchResult {
  ibge_id?: string | number;
  name: string;
  zone?: string;
  population?: number;
  interviews?: number;
}

export default function GeographicBaseSelector({ value, onChange, researchType }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<MunicipalitySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUf, setSelectedUf] = useState('');

  const municipalities = value.municipalities || [];
  const localities = value.localities || [];

  // Decisão baseada no tipo de pesquisa
  const decision = researchType ? getSurveyDecision(researchType) : null;
  const allowedScopes = decision ? [...decision.allowedScopes, 'mixed'] : ['national', 'state', 'city', 'specific_public', 'mixed'];
  const scopeHint = decision?.scopeHint;

  // Busca de municípios via API existente
  useEffect(() => {
    const fetchMunicipios = async () => {
      if (!searchTerm || searchTerm.length < 2) {
        setResults([]);
        return;
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({ q: searchTerm });
        if (selectedUf) params.append('uf', selectedUf);

        const res = await fetch(`/api/geo/municipios?${params}`);
        if (res.ok) {
          const json = await res.json();
          setResults(json.data?.municipios || []);
        }
      } catch (err) {
        console.error('Erro ao buscar municípios', err);
      } finally {
        setLoading(false);
      }
    };

    const timer = setTimeout(fetchMunicipios, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedUf]);

  const addMunicipality = async (m: MunicipalitySearchResult) => {
    const newMun: PlanningMunicipality = {
      ...(m.ibge_id !== undefined ? { ibge_id: m.ibge_id } : {}),
      name: m.name,
      uf: m.uf || '',
      ...((m.populacao_estimada || m.populacao_censo || m.population) !== undefined
        ? { population: m.populacao_estimada || m.populacao_censo || m.population }
        : {}),
    };

    if (!municipalities.some((m2) => m2.ibge_id === newMun.ibge_id)) {
      // Adiciona imediatamente com dados básicos (boa UX)
      const updatedMuns = [...municipalities, newMun];
      onChange({ ...value, municipalities: updatedMuns });

      // Busca dados enriquecidos em background (Fase 1 - Geo Enrichment)
      try {
        const res = await fetch(
          `/api/geo/municipality-profile?state=${m.uf || ''}&city=${encodeURIComponent(m.name)}`
        );
        if (res.ok) {
          const json = await res.json();
          const profile = json.data?.data;

          if (profile) {
            const enrichedMun: PlanningMunicipality = {
              ...newMun,
              population: profile.recommended_population || newMun.population,
              enriched: {
                population_census: profile.census?.population_total,
                electorate_total: profile.electorate?.total,
                residences_cnefe: profile.cnefe?.residences_total,
                data_quality_score: profile.data_quality?.ingestion_score,
                has_census: profile.data_quality?.has_census,
                has_tse: profile.data_quality?.has_tse,
                has_cnefe: profile.data_quality?.has_cnefe,
                sources: profile.sources,
              },
            };

            const finalList = updatedMuns.map((mun) =>
              mun.ibge_id === newMun.ibge_id ? enrichedMun : mun
            );
            onChange({ ...value, municipalities: finalList });
          }
        }
      } catch (e) {
        // Silencioso — mantém os dados básicos
        console.info('Dados enriquecidos não disponíveis para', m.name);
      }
    }

    setSearchTerm('');
    setResults([]);
  };

  const removeMunicipality = (ibgeId?: number) => {
    onChange({
      ...value,
      municipalities: municipalities.filter((m) => m.ibge_id !== ibgeId),
    });
  };

  // Estado para controle de seleção de localidades dentro de um município (modal)
  const [editingLocalitiesFor, setEditingLocalitiesFor] = useState<number | null>(null);
  const [localitiesForCurrent, setLocalitiesForCurrent] = useState<LocalitySearchResult[]>([]);
  const [selectedLocalities, setSelectedLocalities] = useState<Set<string>>(new Set());
  const [localitySearch, setLocalitySearch] = useState('');
  const [activeZoneFilter, setActiveZoneFilter] = useState<'all' | 'urban' | 'rural'>('all');

  // Cache simples de localidades por município (evita refetches repetidos na mesma sessão)
  const [localitiesCache, setLocalitiesCache] = useState<Record<string, LocalitySearchResult[]>>({});

  // Carregar localidades de um município específico (com cache)
  const loadLocalitiesForMunicipality = async (municipality: PlanningMunicipality) => {
    if (!municipality.name || !municipality.uf) return [];

    const key = String(municipality.ibge_id || `${municipality.name}-${municipality.uf}`);
    if (localitiesCache[key]) {
      return localitiesCache[key];
    }

    try {
      const params = new URLSearchParams({
        city: municipality.name,
        state: municipality.uf,
      });
      const res = await fetch(`/api/geo/localities?${params}`);
      if (!res.ok) return [];

      const json = await res.json();
      const data = (json.data?.localities || []) as LocalitySearchResult[];

      // Guarda em cache
      setLocalitiesCache(prev => ({ ...prev, [key]: data }));
      return data;
    } catch (error) {
      console.error('Erro ao carregar localidades:', error);
      return [];
    }
  };

  // Abrir seletor de localidades para um município (com pré-seleção das já escolhidas)
  const openLocalitySelector = async (ibgeId: number) => {
    const municipality = municipalities.find(m => m.ibge_id === ibgeId);
    if (!municipality) return;

    setEditingLocalitiesFor(ibgeId);
    setLocalitySearch('');
    setActiveZoneFilter('all');

    // Pré-carrega as localidades já selecionadas para este município
    const already = new Set<string>((municipality.localities || []).map((l: { name: string }) => l.name));
    setSelectedLocalities(already);

    // Carrega da API (com cache simples no estado do componente para evitar reloads repetidos)
    const data = await loadLocalitiesForMunicipality(municipality);
    setLocalitiesForCurrent(data);
  };

  const closeLocalitySelector = () => {
    setEditingLocalitiesFor(null);
    setLocalitiesForCurrent([]);
    setSelectedLocalities(new Set());
    setLocalitySearch('');
    setActiveZoneFilter('all');
  };

  // Confirmar seleção exata de localidades para o município (substitui a seleção anterior)
  const confirmAddSelectedLocalities = () => {
    if (editingLocalitiesFor === null) return;

    const municipalityIndex = municipalities.findIndex(m => m.ibge_id === editingLocalitiesFor);
    if (municipalityIndex === -1) return;

    const municipality = municipalities[municipalityIndex];
    if (!municipality) return;

    const finalLocalities = localitiesForCurrent
      .filter(loc => selectedLocalities.has(loc.name))
      .map((loc): PlanningLocality => ({
        id: loc.ibge_id ?? `${municipality.ibge_id ?? municipality.name}-${loc.name}`,
        name: loc.name,
        geo_level: 'locality' as const,
        parent_city_name: municipality.name,
        parent_state_name: municipality.uf,
        zone: (loc.zone === 'rural' || loc.zone === 'mixed') ? loc.zone : 'urban',
        population: loc.population || 0,
      }));

    const updatedMunicipalities = [...municipalities];
    updatedMunicipalities[municipalityIndex] = finalLocalities.length > 0
      ? { ...municipality, localities: finalLocalities }
      : (() => {
        const { localities, ...baseMunicipality } = municipality;
        return baseMunicipality;
      })();

    onChange({
      ...value,
      municipalities: updatedMunicipalities,
    });

    closeLocalitySelector();
  };

  const toggleLocalitySelection = (name: string) => {
    const newSet = new Set(selectedLocalities);
    if (newSet.has(name)) {
      newSet.delete(name);
    } else {
      newSet.add(name);
    }
    setSelectedLocalities(newSet);
  };

  // Helpers avançados para UX de localidades
  const currentMunicipality = municipalities.find(m => m.ibge_id === editingLocalitiesFor);

  const filteredLocalities = useMemo(() => {
    let list = localitiesForCurrent;

    if (localitySearch.trim()) {
      const term = localitySearch.toLowerCase();
      list = list.filter((loc: { name: string }) => loc.name.toLowerCase().includes(term));
    }

    if (activeZoneFilter !== 'all') {
      list = list.filter((loc: { zone?: string }) => (loc.zone || 'urban') === activeZoneFilter);
    }

    return list;
  }, [localitiesForCurrent, localitySearch, activeZoneFilter]);

  const zoneCounts = useMemo(() => {
    const urban = localitiesForCurrent.filter((l: { zone?: string }) => (l.zone || 'urban') === 'urban').length;
    const rural = localitiesForCurrent.filter((l: { zone?: string }) => (l.zone || 'urban') === 'rural').length;
    return { all: localitiesForCurrent.length, urban, rural };
  }, [localitiesForCurrent]);

  const selectedCountInFilter = useMemo(() => {
    return filteredLocalities.filter((loc: { name: string }) => selectedLocalities.has(loc.name)).length;
  }, [filteredLocalities, selectedLocalities]);

  // Ações em massa no modal
  const selectAllVisible = () => {
    const newSet = new Set(selectedLocalities);
    filteredLocalities.forEach((loc: { name: string }) => newSet.add(loc.name));
    setSelectedLocalities(newSet);
  };

  const selectAllByZone = (zone: 'urban' | 'rural') => {
    const newSet = new Set(selectedLocalities);
    localitiesForCurrent
      .filter((loc: { zone?: string }) => (loc.zone || 'urban') === zone)
      .forEach((loc: { name: string }) => newSet.add(loc.name));
    setSelectedLocalities(newSet);
  };

  const clearCurrentSelection = () => {
    setSelectedLocalities(new Set());
  };

  // Estatísticas globais da base (para resumo)
  const totalLocalitiesSelected = municipalities.reduce((sum, m) => sum + (m.localities?.length || 0), 0);
  const municipalitiesWithSpecificLocalities = municipalities.filter(m => m.localities && m.localities.length > 0).length;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-2">Abrangência Geográfica</label>
        <select
          aria-label="Abrangência geográfica"
          title="Abrangência geográfica"
          value={value.scope}
          onChange={(e) => onChange({ ...value, scope: e.target.value as GeoScope | 'mixed' })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          {allowedScopes.map((scope) => (
            <option key={scope} value={scope}>
              {(SCOPE_LABELS as Record<string, string>)[scope] || scope}
            </option>
          ))}
        </select>
        {scopeHint && (
          <p className="text-xs text-blue-400 mt-1.5">{scopeHint}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Municípios Selecionados</label>

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar município..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
          />
          <select
            aria-label="Filtrar municípios por UF"
            title="Filtro de UF"
            value={selectedUf}
            onChange={(e) => setSelectedUf(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm w-28"
          >
            <option value="">Todos UF</option>
            <option value="SP">SP</option>
            <option value="RJ">RJ</option>
            <option value="MG">MG</option>
            <option value="BA">BA</option>
            <option value="RS">RS</option>
            <option value="PR">PR</option>
            <option value="SC">SC</option>
            <option value="GO">GO</option>
            <option value="DF">DF</option>
            <option value="PE">PE</option>
            <option value="CE">CE</option>
          </select>
        </div>

        {loading && <div className="text-xs text-slate-400 flex items-center gap-1"><Loader2 size={14} className="animate-spin" /> Buscando...</div>}

        {results.length > 0 && (
          <div className="border border-slate-700 rounded-lg max-h-48 overflow-auto mb-3 bg-slate-950">
            {results.slice(0, 8).map((m, idx) => (
              <div
                key={idx}
                onClick={() => addMunicipality(m)}
                className="px-3 py-2 hover:bg-slate-800 cursor-pointer text-sm flex justify-between"
              >
                <span>{m.name} - {m.uf}</span>
                <span className="text-slate-500 text-xs">{(m.populacao_estimada || m.population || 0).toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Toolbar de ações em massa (aparece quando há municípios) */}
        {municipalities.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-slate-900/60 border border-slate-700 rounded-lg">
            <span className="text-xs text-slate-400 mr-1">Ações em massa:</span>
            <button
              type="button"
              onClick={() => {
                // Remover refinamentos de TODOS (voltar para municípios inteiros)
                const updated = municipalities.map((municipality) => {
                  const { localities, ...baseMunicipality } = municipality;
                  return baseMunicipality;
                });
                onChange({ ...value, municipalities: updated });
              }}
              className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600"
            >
              Usar todos como municípios inteiros
            </button>
            <button
              type="button"
              onClick={() => {
                // Exemplo poderoso: aplicar "só urbanas" onde possível (requer carregar, simplificado: limpa e avisa)
                // Para UX real profunda, o usuário abre o refinamento individual ou usamos default urban em massa
                const updated = municipalities.map((municipality) => {
                  const { localities, ...baseMunicipality } = municipality;
                  return baseMunicipality;
                });
                onChange({ ...value, municipalities: updated });
                alert('Para aplicar "somente áreas urbanas" em vários municípios, abra o refinamento em cada um (ou use o filtro no Passo 4). Ação em massa avançada disponível em refinamento individual.');
              }}
              className="text-xs px-3 py-1 bg-slate-800 hover:bg-slate-700 rounded border border-slate-600"
            >
              Limpar todos os refinamentos
            </button>
            <div className="ml-auto text-[10px] text-slate-500">
              {municipalitiesWithSpecificLocalities} com localidades específicas • {totalLocalitiesSelected} localidades no total
            </div>
          </div>
        )}

        {/* Lista de municípios selecionados - visual poderoso e claro */}
        <div className="space-y-2.5 mt-1">
          {municipalities.length === 0 && (
            <div className="border border-dashed border-slate-700 rounded-xl p-4 text-center">
              <p className="text-sm text-slate-500">Nenhum município selecionado ainda.</p>
              <p className="text-xs text-slate-600 mt-1">Busque acima por nome ou UF para começar a montar sua base geográfica.</p>
            </div>
          )}

          {municipalities.map((m, index) => {
            const hasLocalities = m.localities && m.localities.length > 0;
            const locCount = hasLocalities ? m.localities!.length : 0;
            const urbanCount = hasLocalities ? m.localities!.filter(l => l.zone === 'urban').length : 0;
            const ruralCount = hasLocalities ? m.localities!.filter(l => l.zone === 'rural').length : 0;

            return (
              <div key={m.ibge_id || m.name || index} className="border border-slate-700 bg-slate-800/80 rounded-2xl p-3.5 hover:border-slate-500 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5">
                      <MapPin size={17} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-base">{m.name} – {m.uf}</span>
                        {m.population && (
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-300 tabular-nums">
                            {m.population.toLocaleString('pt-BR')} hab.
                          </span>
                        )}

                        {/* Badges de dados enriquecidos (Fase 1) */}
                        {m.enriched && (
                          <>
                            {m.enriched.has_census && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/50 text-emerald-300 border border-emerald-700/40" title="Censo 2022 disponível">
                                Censo
                              </span>
                            )}
                            {m.enriched.has_tse && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700/40" title="Dados eleitorais TSE">
                                TSE
                              </span>
                            )}
                            {m.enriched.has_cnefe && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/40" title="Residências CNEFE 2022">
                                CNEFE
                              </span>
                            )}
                            {m.enriched.data_quality_score !== undefined && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${m.enriched.data_quality_score === 3 ? 'bg-emerald-900/60 text-emerald-300' : m.enriched.data_quality_score >= 2 ? 'bg-yellow-900/60 text-yellow-300' : 'bg-slate-700 text-slate-300'}`}>
                                {m.enriched.data_quality_score}/3
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Status da granularidade */}
                      <div className="mt-1.5 flex items-center gap-2">
                        {!hasLocalities ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
                            Município completo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-amber-900/40 text-amber-300 border border-amber-700/50">
                            {locCount} localidades específicas
                            <span className="text-amber-400/70">({urbanCount} urbanas • {ruralCount} rurais)</span>
                          </span>
                        )}
                      </div>

                      {/* Chips de localidades (preview) */}
                      {hasLocalities && (
                        <div className="mt-2 flex flex-wrap gap-1 max-h-16 overflow-hidden">
                          {m.localities!.slice(0, 6).map((loc, li) => (
                            <span key={li} className="text-[10px] bg-slate-900 border border-slate-600 px-2 py-0.5 rounded-full text-slate-300">
                              {loc.name} <span className="text-slate-500">({loc.zone?.[0] || 'u'})</span>
                            </span>
                          ))}
                          {locCount > 6 && (
                            <span className="text-[10px] text-slate-400 self-center px-1">+{locCount - 6}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ações rápidas por município */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openLocalitySelector(m.ibge_id!)}
                        className="text-xs px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition-colors"
                        title={hasLocalities ? "Editar seleção de localidades específicas" : "Refinar para localidades específicas (bairros, distritos...)"}
                      >
                        <Filter size={13} />
                        {hasLocalities ? 'Editar localidades' : 'Refinar localidades'}
                      </button>
                      {hasLocalities && (
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...municipalities];
                            const { localities, ...baseMunicipality } = m;
                            updated[index] = baseMunicipality;
                            onChange({ ...value, municipalities: updated });
                          }}
                          className="text-xs px-2.5 py-1 rounded-lg border border-slate-600 hover:bg-slate-700 text-slate-300"
                          title="Voltar a usar o município inteiro"
                        >
                          Usar inteiro
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMunicipality(m.ibge_id)}
                        className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remover município da base"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ===== MODAL PODEROSO DE SELEÇÃO DE LOCALIDADES ===== */}
        {editingLocalitiesFor !== null && currentMunicipality && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl">
              {/* Header do Modal */}
              <div className="flex items-start justify-between px-5 py-4 border-b border-slate-700">
                <div>
                  <div className="text-lg font-semibold text-white flex items-center gap-2">
                    <Filter size={18} className="text-blue-400" />
                    Refinar localidades em {currentMunicipality.name} – {currentMunicipality.uf}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Selecione bairros, distritos ou subdistritos específicos. As cotas no Passo 4 usarão exatamente estas áreas.
                  </div>
                </div>
                <button aria-label="Fechar refinamento de localidades" title="Fechar" onClick={closeLocalitySelector} className="text-slate-400 hover:text-white p-1">
                  <X size={20} />
                </button>
              </div>

              {/* Barra de estatísticas e filtros de zona */}
              <div className="px-5 pt-4 pb-2 bg-slate-950/60 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                  <div className="text-slate-400">
                    Disponíveis: <span className="font-medium text-white">{zoneCounts.all}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setActiveZoneFilter('all')}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition ${activeZoneFilter === 'all' ? 'bg-blue-600 text-white border-blue-500' : 'border-slate-600 hover:bg-slate-800'}`}
                    >
                      Todos ({zoneCounts.all})
                    </button>
                    <button
                      onClick={() => setActiveZoneFilter('urban')}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition flex items-center gap-1 ${activeZoneFilter === 'urban' ? 'bg-blue-600 text-white border-blue-500' : 'border-slate-600 hover:bg-slate-800'}`}
                    >
                      🌆 Urbanas ({zoneCounts.urban})
                    </button>
                    <button
                      onClick={() => setActiveZoneFilter('rural')}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition flex items-center gap-1 ${activeZoneFilter === 'rural' ? 'bg-emerald-600 text-white border-emerald-500' : 'border-slate-600 hover:bg-slate-800'}`}
                    >
                      🌾 Rurais ({zoneCounts.rural})
                    </button>
                  </div>

                  <div className="ml-auto text-emerald-400 text-sm font-medium">
                    Selecionadas agora: {selectedLocalities.size}
                  </div>
                </div>
              </div>

              {/* Busca + Ações em massa */}
              <div className="px-5 py-3 border-b border-slate-800 flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={localitySearch}
                  onChange={(e) => setLocalitySearch(e.target.value)}
                  placeholder="Buscar bairro, distrito, RPA..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />

                <div className="flex gap-2 flex-wrap">
                  <button onClick={selectAllVisible} className="text-xs px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800 flex items-center gap-1">
                    <CheckSquare size={14} /> Selecionar visíveis ({filteredLocalities.length})
                  </button>
                  <button onClick={() => selectAllByZone('urban')} className="text-xs px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800">
                    Todas urbanas
                  </button>
                  <button onClick={() => selectAllByZone('rural')} className="text-xs px-3 py-2 rounded-lg border border-slate-600 hover:bg-slate-800">
                    Todas rurais
                  </button>
                  <button onClick={clearCurrentSelection} className="text-xs px-3 py-2 rounded-lg border border-red-900/60 text-red-300 hover:bg-red-950">
                    Limpar seleção
                  </button>
                </div>
              </div>

              {/* Lista de localidades (scrollável e filtrada) */}
              <div className="flex-1 overflow-auto px-5 py-3 bg-slate-950/40 max-h-[420px]">
                {filteredLocalities.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
                    {filteredLocalities.slice(0, 400).map((loc, i: number) => {
                      const isSelected = selectedLocalities.has(loc.name);
                      const isAlreadyInBase = (currentMunicipality.localities || []).some((l: { name: string }) => l.name === loc.name);

                      return (
                        <label
                          key={loc.ibge_id || loc.name || i}
                          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition hover:bg-slate-800 ${isSelected ? 'bg-blue-950/40 ring-1 ring-blue-500/30' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleLocalitySelection(loc.name)}
                            className="accent-blue-500 w-4 h-4"
                          />
                          <span className="flex-1 truncate">{loc.name}</span>

                          <span className={`text-[10px] px-1.5 py-px rounded ${loc.zone === 'urban' ? 'bg-blue-900/60 text-blue-300' : 'bg-emerald-900/60 text-emerald-300'}`}>
                            {loc.zone === 'urban' ? 'urbana' : 'rural'}
                          </span>

                          {(loc.population || 0) > 0 && (
                            <span className="tabular-nums text-emerald-400 text-xs">
                              {(loc.population || 0).toLocaleString('pt-BR')}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center text-slate-500 text-sm">
                    Nenhuma localidade encontrada com os filtros atuais.
                  </div>
                )}

                {localitiesForCurrent.length > 400 && (
                  <p className="text-center text-[10px] text-amber-400 mt-3">
                    Exibindo até 400 itens. Use a busca ou filtros de zona para refinar.
                  </p>
                )}
              </div>

              {/* Footer do Modal */}
              <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between bg-slate-900 rounded-b-2xl">
                <div className="text-xs text-slate-400">
                  {selectedLocalities.size > 0 ? (
                    <>Pronto para aplicar <strong className="text-white">{selectedLocalities.size}</strong> localidades específicas.</>
                  ) : (
                    'Selecione pelo menos uma localidade ou cancele para manter o município inteiro.'
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={closeLocalitySelector}
                    className="px-4 py-2 text-sm rounded-lg border border-slate-600 hover:bg-slate-800 text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmAddSelectedLocalities}
                    disabled={selectedLocalities.size === 0}
                    className="px-5 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white font-medium transition-colors"
                  >
                    Aplicar {selectedLocalities.size} localidades
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Resumo da Base - enriquecido com granularidade real */}
        {municipalities.length > 0 && (
          <div className="mt-4 p-4 bg-slate-950 border border-slate-600 rounded-2xl text-sm">
            <div className="font-semibold text-slate-200 mb-2 flex items-center justify-between">
              <span>Resumo da Base Selecionada</span>
              {totalLocalitiesSelected > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/40">
                  {totalLocalitiesSelected} localidades específicas em {municipalitiesWithSpecificLocalities} municípios
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Municípios:</span>
                <span className="font-medium text-white">{municipalities.length}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">População total:</span>
                <span className="font-semibold text-emerald-400">
                  {municipalities.reduce((sum, m) => sum + (m.population || 0), 0).toLocaleString('pt-BR')}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Nível de detalhe:</span>
                <span className={`font-medium ${totalLocalitiesSelected > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {totalLocalitiesSelected > 0 ? 'Misto (localidades)' : 'Municipal'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-400">Áreas para cotas:</span>
                <span className="font-medium text-white">
                  {totalLocalitiesSelected > 0 ? totalLocalitiesSelected : municipalities.length}
                </span>
              </div>
            </div>

            <div className="mt-2.5 text-xs text-slate-500">
              Esta base será usada para sugerir a distribuição proporcional de entrevistas no Passo 4 (respeitando localidades específicas quando definidas).
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Helpers ---

const SCOPE_LABELS: Record<GeoScope | 'mixed', string> = {
  national: 'Nacional',
  state: 'Estadual',
  city: 'Municipal',
  specific_public: 'Público Específico',
  mixed: 'Mista',
};


