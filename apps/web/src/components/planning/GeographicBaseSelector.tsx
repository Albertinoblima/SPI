'use client';

import { useState, useEffect, useMemo } from 'react';
import { MapPin, X, Loader2 } from 'lucide-react';
import { getSurveyDecision, allowedGeoLevels, type GeoScope } from '@/lib/survey-decisions';
import type { GeographicBaseSelection, PlanningMunicipality, PlanningLocality } from './types';

interface Props {
  value: GeographicBaseSelection;
  onChange: (data: GeographicBaseSelection) => void;
  researchType?: string;
}

export default function GeographicBaseSelector({ value, onChange, researchType }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
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

  const addMunicipality = (m: any) => {
    const newMun: PlanningMunicipality = {
      ibge_id: m.ibge_id,
      name: m.nome,
      uf: m.uf,
      population: m.populacao_estimada || m.populacao_censo,
    };

    if (!municipalities.some((m2) => m2.ibge_id === newMun.ibge_id)) {
      onChange({
        ...value,
        municipalities: [...municipalities, newMun],
      });
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

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-2">Abrangência Geográfica</label>
        <select
          value={value.scope}
          onChange={(e) => onChange({ ...value, scope: e.target.value as GeoScope | 'mixed' })}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
        >
          {allowedScopes.map((scope) => (
            <option key={scope} value={scope}>
              {SCOPE_LABELS[scope]}
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
            value={selectedUf}
            onChange={(e) => setSelectedUf(e.target.value)}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm w-28"
          >
            <option value="">Todos UF</option>
            <option value="SP">SP</option>
            <option value="RJ">RJ</option>
            <option value="MG">MG</option>
            {/* Adicionar mais UFs conforme necessário */}
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
                <span>{m.nome} - {m.uf}</span>
                <span className="text-slate-500 text-xs">{m.populacao_estimada?.toLocaleString('pt-BR')}</span>
              </div>
            ))}
          </div>
        )}

        {/* Lista de municípios selecionados */}
        <div className="space-y-2 mt-2">
          {municipalities.length === 0 && (
            <p className="text-sm text-slate-500">Nenhum município selecionado ainda.</p>
          )}

          {municipalities.map((m, index) => (
            <div key={index} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-blue-400" />
                <span>{m.name} - {m.uf}</span>
                {m.population && (
                  <span className="text-xs text-slate-400">({m.population.toLocaleString('pt-BR')} hab.)</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeMunicipality(m.ibge_id)}
                className="text-red-400 hover:text-red-300"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Resumo da Base */}
        {municipalities.length > 0 && (
          <div className="mt-3 p-3 bg-slate-950 border border-slate-700 rounded-lg text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Total de municípios:</span>
              <span className="font-medium text-white">{municipalities.length}</span>
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-slate-400">População estimada:</span>
              <span className="font-medium text-emerald-400">
                {municipalities.reduce((sum, m) => sum + (m.population || 0), 0).toLocaleString('pt-BR')} habitantes
              </span>
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


