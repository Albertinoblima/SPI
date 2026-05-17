'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, MapPin, Plus, Trash2, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import {
    getSurveyDecision,
    allowedGeoLevels,
    checkLocalitiesCompatibility,
    getEffectiveLocalities,
    GEO_LEVEL_LABELS,
    GEO_SCOPE_LABELS,
    GEO_SCOPE_DESCRIPTION,
    ZONE_LABELS,
    type GeoLevel,
    type GeoScope,
} from '@/lib/survey-decisions';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';
import type { SurveyTechData, PopulationType } from './Step1TechnicalData';

// --- Tipos ---

export interface Locality {
    id: string;
    name: string;
    geo_level: GeoLevel;
    parent_state_name?: string | null;
    parent_city_name?: string | null;
    zone: 'urban' | 'rural' | 'mixed';
    population: number;
    population_type: PopulationType;
    interviews_required?: number;
    interviews_weight?: number;
}

interface ScopeData {
    geographic_scope: SurveyTechData['geographic_scope'];
    scope_country_name: string;
    scope_state_name: string;
    scope_city_name: string;
    specific_public_description: string;
}

interface Props {
    localities: Locality[];
    onChange: (localities: Locality[]) => void;
    surveyType: string;
    scopeData: ScopeData;
    onScopeChange: (scopeData: ScopeData) => void;
    defaultPopulationType?: PopulationType;
    externalConflict?: string | null;
}

interface GeoStateOption { code: number; uf: string; name: string; }
interface LocalityOption { name: string; zone: 'urban' | 'rural'; ibge_id?: number; }

// --- Helpers UI ---

function Tooltip({ text, helpId }: { text: string; helpId?: string }) {
    const topic = helpId ? HELP_TOPICS_BY_ID[helpId] : undefined;
    const href = topic ? `/help?q=${encodeURIComponent(topic.title)}#${topic.id}` : '/help';
    const handleMouseEnter = () => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(HELP_HOVER_EVENT, {
            detail: { id: topic?.id, title: topic?.title ?? 'Ajuda rapida', text: topic?.short ?? text, href },
        }));
    };
    return (
        <span className="relative group inline-flex items-center ml-1.5" onMouseEnter={handleMouseEnter}>
            <HelpCircle size={15} className="text-slate-400 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                <span>{text}</span>
                <span className="mt-2 block">
                    <Link href={href} className="text-blue-200 underline underline-offset-2 hover:text-white">Saber mais...</Link>
                </span>
            </span>
        </span>
    );
}

function BlockHeader({ step, title, done, tooltip }: { step: number; title: string; done?: boolean; tooltip?: string; }) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}>
                {done ? <CheckCircle2 size={16} /> : step}
            </div>
            <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                {title}
                {tooltip && <Tooltip text={tooltip} />}
            </h3>
        </div>
    );
}

// --- Componente principal ---

export function Step2Localities({
    localities,
    onChange,
    surveyType,
    scopeData,
    onScopeChange,
    defaultPopulationType = 'eleitores',
    externalConflict,
}: Props) {
    const decision = useMemo(() => getSurveyDecision(surveyType), [surveyType]);
    const allowedLevels = useMemo(() => allowedGeoLevels(scopeData.geographic_scope), [scopeData.geographic_scope]);

    const scopeIsValid = useMemo(() => {
        if (!scopeData.geographic_scope) return false;
        if (scopeData.geographic_scope === 'national') return Boolean(scopeData.scope_country_name.trim());
        if (scopeData.geographic_scope === 'state') return Boolean(scopeData.scope_state_name.trim());
        if (scopeData.geographic_scope === 'city') return Boolean(scopeData.scope_state_name.trim() && scopeData.scope_city_name.trim());
        if (scopeData.geographic_scope === 'specific_public') return Boolean(scopeData.specific_public_description.trim());
        return false;
    }, [scopeData]);

    // --- Estado IBGE ---
    const [ibgeStates, setIbgeStates] = useState<GeoStateOption[]>([]);
    const [ibgeCities, setIbgeCities] = useState<string[]>([]);
    const [ibgeLocalities, setIbgeLocalities] = useState<LocalityOption[]>([]);
    const [loadingCities, setLoadingCities] = useState(false);
    const [loadingLocalities, setLoadingLocalities] = useState(false);
    const [geoSource, setGeoSource] = useState<'ibge' | 'fallback' | null>(null);

    // --- Cascata de seleção para adicionar ---
    // cascade.state e cascade.city sao usados como "pai" do item a adicionar
    const [cascade, setCascade] = useState<{
        state: string;       // estado do item (vazio = usa scope fixo)
        city: string;        // cidade do item (vazio = usa scope fixo)
        localityName: string;// nome da localidade especifica
        zone: 'urban' | 'rural' | 'mixed';
        geo_level: GeoLevel;
    }>({
        state: '',
        city: '',
        localityName: '',
        zone: 'urban',
        geo_level: allowedLevels[0] ?? 'locality',
    });

    const [formError, setFormError] = useState('');
    const [scopeError, setScopeError] = useState('');
    const [confirmScopeReset, setConfirmScopeReset] = useState(false);
    const [pendingScopeChange, setPendingScopeChange] = useState<ScopeData | null>(null);

    // Sincroniza geo_level ao mudar abrangencia
    useEffect(() => {
        if (allowedLevels.length > 0 && !allowedLevels.includes(cascade.geo_level)) {
            setCascade((prev) => ({ ...prev, geo_level: allowedLevels[0], state: '', city: '', localityName: '' }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scopeData.geographic_scope]);

    // --- Estado/cidade efetivos para a cascata ---
    // O estado de referencia para carregamento de cidades
    const cascadeStateForCities = useMemo(() => {
        if (scopeData.geographic_scope === 'city' || scopeData.geographic_scope === 'state') return scopeData.scope_state_name;
        return cascade.state;
    }, [scopeData.geographic_scope, scopeData.scope_state_name, cascade.state]);

    // A cidade de referencia para carregamento de localidades
    const cascadeCityForLocalities = useMemo(() => {
        if (scopeData.geographic_scope === 'city') return scopeData.scope_city_name;
        return cascade.city;
    }, [scopeData.geographic_scope, scopeData.scope_city_name, cascade.city]);

    // Carrega estados IBGE (uma vez)
    useEffect(() => {
        let active = true;
        fetch('/api/geo/states', { cache: 'force-cache' })
            .then((r) => r.json())
            .then((payload) => {
                if (!active) return;
                if (payload?.success && Array.isArray(payload?.data?.states)) {
                    setIbgeStates(payload.data.states as GeoStateOption[]);
                    setGeoSource((payload.data.source as 'ibge' | 'fallback') ?? null);
                }
            })
            .catch(() => { if (!active) return; setGeoSource('fallback'); });
        return () => { active = false; };
    }, []);

    // Carrega cidades IBGE quando o estado muda
    useEffect(() => {
        const stateName = cascadeStateForCities.trim();
        if (!stateName) { setIbgeCities([]); return; }
        let active = true;
        setLoadingCities(true);
        setIbgeCities([]);
        fetch(`/api/geo/cities?state=${encodeURIComponent(stateName)}`, { cache: 'force-cache' })
            .then((r) => r.json())
            .then((payload) => {
                if (!active) return;
                if (payload?.success && Array.isArray(payload?.data?.cities)) {
                    setIbgeCities(payload.data.cities as string[]);
                    if (payload?.data?.source) setGeoSource(payload.data.source as 'ibge' | 'fallback');
                } else {
                    setIbgeCities([]);
                }
            })
            .catch(() => { if (!active) return; setIbgeCities([]); })
            .finally(() => { if (active) setLoadingCities(false); });
        return () => { active = false; };
    }, [cascadeStateForCities]);

    // Carrega localidades IBGE (distritos/subdistritos) quando a cidade muda
    useEffect(() => {
        const cityName = cascadeCityForLocalities.trim();
        const stateName = cascadeStateForCities.trim();
        if (!cityName || !stateName) { setIbgeLocalities([]); return; }
        let active = true;
        setLoadingLocalities(true);
        setIbgeLocalities([]);
        fetch(`/api/geo/localities?city=${encodeURIComponent(cityName)}&state=${encodeURIComponent(stateName)}`, { cache: 'force-cache' })
            .then((r) => r.json())
            .then((payload) => {
                if (!active) return;
                if (payload?.success && Array.isArray(payload?.data?.localities)) {
                    setIbgeLocalities(payload.data.localities as LocalityOption[]);
                    if (payload?.data?.source) setGeoSource(payload.data.source as 'ibge' | 'fallback');
                } else {
                    setIbgeLocalities([]);
                }
            })
            .catch(() => { if (!active) return; setIbgeLocalities([]); })
            .finally(() => { if (active) setLoadingLocalities(false); });
        return () => { active = false; };
    }, [cascadeCityForLocalities, cascadeStateForCities]);

    const stateNames = useMemo(
        () => Array.from(new Set(ibgeStates.map((s) => s.name))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [ibgeStates],
    );

    const internalConflict = useMemo(
        () => checkLocalitiesCompatibility(localities, scopeData.geographic_scope, surveyType),
        [localities, scopeData.geographic_scope, surveyType],
    );
    const conflict = externalConflict ?? internalConflict;

    // --- Handlers de abrangencia ---
    const handleScopeChange = (next: ScopeData) => {
        if (localities.length > 0 && next.geographic_scope !== scopeData.geographic_scope) {
            const future = checkLocalitiesCompatibility(localities, next.geographic_scope, surveyType);
            if (future) {
                setPendingScopeChange(next);
                setConfirmScopeReset(true);
                return;
            }
        }
        setScopeError('');
        onScopeChange(next);
    };

    const confirmResetLocalities = () => {
        if (!pendingScopeChange) return;
        onChange([]);
        setScopeError('');
        onScopeChange(pendingScopeChange);
        setPendingScopeChange(null);
        setConfirmScopeReset(false);
        setCascade({ state: '', city: '', localityName: '', zone: 'urban', geo_level: 'locality' });
    };

    // --- Handler de adicao ---
    const handleAdd = () => {
        if (!scopeIsValid) {
            setScopeError('Preencha todos os campos de abrangencia antes de adicionar localidades.');
            setFormError('');
            return;
        }
        setScopeError('');

        const level = cascade.geo_level;

        // Resolve hierarquia final
        const resolvedState = (() => {
            if (scopeData.geographic_scope === 'state' || scopeData.geographic_scope === 'city') return scopeData.scope_state_name.trim();
            return cascade.state.trim();
        })();

        const resolvedCity = (() => {
            if (scopeData.geographic_scope === 'city') return scopeData.scope_city_name.trim();
            return cascade.city.trim();
        })();

        // Nome do item a adicionar
        const itemName = (() => {
            if (level === 'state') return resolvedState || cascade.state.trim();
            if (level === 'city') return resolvedCity || cascade.city.trim();
            return cascade.localityName.trim();
        })();

        if (!itemName) {
            setFormError(
                level === 'state' ? 'Selecione ou informe o estado.' :
                    level === 'city' ? 'Selecione ou informe a cidade.' :
                        'Selecione ou informe a localidade especifica.'
            );
            return;
        }

        if ((level === 'city' || level === 'locality') && !resolvedState) {
            setFormError('Informe o estado de referencia.');
            return;
        }
        if (level === 'locality' && !resolvedCity) {
            setFormError('Informe a cidade de referencia.');
            return;
        }

        const parentState = level === 'state' ? null : resolvedState || null;
        const parentCity = level === 'locality' ? (resolvedCity || null) : null;

        const duplicate = localities.some(
            (loc) =>
                loc.geo_level === level &&
                loc.name.toLowerCase() === itemName.toLowerCase() &&
                (loc.parent_state_name ?? '') === (parentState ?? '') &&
                (loc.parent_city_name ?? '') === (parentCity ?? ''),
        );
        if (duplicate) {
            setFormError('Esta localidade ja esta cadastrada na mesma hierarquia.');
            return;
        }

        setFormError('');

        const newLoc: Locality = {
            id: `loc_${Date.now()}`,
            name: itemName,
            geo_level: level,
            parent_state_name: parentState,
            parent_city_name: parentCity,
            zone: cascade.zone,
            population: 0,
            population_type: decision.specificAudience ? 'segmento_especifico' : defaultPopulationType,
            interviews_required: 0,
            interviews_weight: 0,
        };

        onChange([...localities, newLoc]);

        // Mantém estado/cidade para facilitar adicao de multiplos itens no mesmo nivel
        setCascade((prev) => ({
            ...prev,
            localityName: '',
            zone: 'urban',
            // Se adicionou uma cidade, reset so o nome; se adicionou localidade, reset localidade
            city: level === 'city' ? '' : prev.city,
        }));
    };

    const handleRemove = (id: string) => onChange(localities.filter((l) => l.id !== id));

    // --- Resumo abrangencia ---
    const scopeSummary = (() => {
        if (scopeData.geographic_scope === 'national') return `Pais: ${scopeData.scope_country_name || '---'}`;
        if (scopeData.geographic_scope === 'state') return `Estado: ${scopeData.scope_state_name || '---'}`;
        if (scopeData.geographic_scope === 'city') return `${scopeData.scope_state_name || '---'} > ${scopeData.scope_city_name || '---'}`;
        if (scopeData.geographic_scope === 'specific_public') return `Publico: ${scopeData.specific_public_description || '---'}`;
        return 'Nao definida';
    })();

    const scopesForDecision = decision.allowedScopes as string[];

    // --- Helpers de cascata ---
    const showStatePicker = scopeData.geographic_scope === 'national';
    const showCityPicker = scopeData.geographic_scope !== 'city' && cascade.geo_level !== 'state';
    const showLocalityPicker = cascade.geo_level === 'locality';

    const cityPickerEnabled = showCityPicker && Boolean(cascadeStateForCities.trim());
    const localityPickerEnabled = showLocalityPicker && Boolean(cascadeCityForLocalities.trim());

    // Quando seleciona localidade da lista IBGE, auto-preenche a zona
    const handleLocalitySelect = (name: string) => {
        const found = ibgeLocalities.find((l) => l.name === name);
        setCascade((prev) => ({
            ...prev,
            localityName: name,
            zone: found ? found.zone : 'urban',
        }));
    };

    // Label do botao de adicionar
    const addButtonLabel = (() => {
        if (cascade.geo_level === 'state') return 'Adicionar Estado';
        if (cascade.geo_level === 'city') return 'Adicionar Cidade';
        return 'Adicionar Localidade';
    })();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 2 &mdash; Abrangencia e Localidades</h2>
                <p className="text-sm text-slate-500">
                    Defina o territorio da pesquisa e cadastre as localidades de coleta. Dados populacionais e amostragem sao configurados na <strong>Etapa 3</strong>.
                </p>
                {decision.scopeHint && (
                    <p className="mt-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">{decision.scopeHint}</p>
                )}
            </div>

            {conflict && (
                <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
                    <AlertTriangle size={20} className="shrink-0 mt-0.5 text-amber-500" />
                    <div>
                        <p className="font-semibold mb-1">Conflito territorial detectado</p>
                        <p>{conflict}</p>
                        <p className="mt-1 text-xs">Corrija ou remova as localidades incompativeis para avancar.</p>
                    </div>
                </div>
            )}

            {confirmScopeReset && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800">
                    <div className="flex gap-2 mb-3">
                        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-500" />
                        <p className="font-semibold">Mudar a abrangencia ira remover as localidades cadastradas.</p>
                    </div>
                    <p className="mb-4 text-xs">As {localities.length} localidade(s) cadastradas nao sao compativeis com a nova abrangencia e serao removidas.</p>
                    <div className="flex gap-2">
                        <button type="button" onClick={confirmResetLocalities} className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition">
                            Confirmar e redefinir localidades
                        </button>
                        <button type="button" onClick={() => { setPendingScopeChange(null); setConfirmScopeReset(false); }} className="px-4 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-medium hover:bg-red-100 transition">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* BLOCO A -- Abrangencia */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
                <BlockHeader step={1} title="Abrangencia territorial" done={scopeIsValid} tooltip="Define o alcance geografico da pesquisa e determina quais niveis de localidades podem ser cadastrados." />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Nivel de abrangencia <span className="text-red-500">*</span></label>
                        <select
                            value={scopeData.geographic_scope}
                            aria-label="Nivel de abrangencia territorial"
                            onChange={(e) => {
                                const nextScope = e.target.value as ScopeData['geographic_scope'];
                                handleScopeChange({
                                    ...scopeData,
                                    geographic_scope: nextScope,
                                    scope_country_name: nextScope === 'national' ? scopeData.scope_country_name || 'Brasil' : scopeData.scope_country_name,
                                });
                            }}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {(['national', 'state', 'city', 'specific_public'] as GeoScope[]).map((s) => (
                                <option key={s} value={s} disabled={surveyType ? !scopesForDecision.includes(s) : false}>
                                    {GEO_SCOPE_LABELS[s]}{surveyType && !scopesForDecision.includes(s) ? ' (nao disponivel)' : ''}
                                </option>
                            ))}
                        </select>
                        {scopeData.geographic_scope && (
                            <p className="mt-1 text-xs text-slate-400">{GEO_SCOPE_DESCRIPTION[scopeData.geographic_scope as GeoScope]}</p>
                        )}
                    </div>

                    {scopeData.geographic_scope === 'national' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Pais <span className="text-red-500">*</span></label>
                            <input type="text" value={scopeData.scope_country_name}
                                onChange={(e) => handleScopeChange({ ...scopeData, scope_country_name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Brasil" />
                        </div>
                    )}

                    {(scopeData.geographic_scope === 'state' || scopeData.geographic_scope === 'city') && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Estado <span className="text-red-500">*</span></label>
                            <input
                                list="scope-states-datalist"
                                value={scopeData.scope_state_name}
                                onChange={(e) => handleScopeChange({ ...scopeData, scope_state_name: e.target.value, scope_city_name: '' })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Digite ou selecione o estado..."
                                autoComplete="off"
                            />
                            <datalist id="scope-states-datalist">
                                {stateNames.map((s) => <option key={s} value={s} />)}
                            </datalist>
                        </div>
                    )}

                    {scopeData.geographic_scope === 'city' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Cidade <span className="text-red-500">*</span></label>
                            <div className="relative">
                                <input
                                    list="scope-cities-datalist"
                                    value={scopeData.scope_city_name}
                                    onChange={(e) => handleScopeChange({ ...scopeData, scope_city_name: e.target.value })}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                                    disabled={!scopeData.scope_state_name || loadingCities}
                                    placeholder={loadingCities ? 'Carregando...' : !scopeData.scope_state_name ? 'Selecione o estado primeiro' : 'Digite ou selecione a cidade...'}
                                    autoComplete="off"
                                />
                                <datalist id="scope-cities-datalist">
                                    {ibgeCities.map((c) => <option key={c} value={c} />)}
                                </datalist>
                                {loadingCities && <Loader2 size={14} className="absolute right-3 top-3 animate-spin text-blue-500" />}
                            </div>
                        </div>
                    )}

                    {scopeData.geographic_scope === 'specific_public' && (
                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-slate-700 block mb-1">Recorte do publico especifico <span className="text-red-500">*</span></label>
                            <textarea rows={2} value={scopeData.specific_public_description}
                                onChange={(e) => handleScopeChange({ ...scopeData, specific_public_description: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-y"
                                placeholder="Ex: Comerciantes formais do setor alimenticio com faturamento ate R$ 200 mil/ano" />
                        </div>
                    )}
                </div>

                {scopeData.geographic_scope && (
                    <p className="mt-3 text-xs text-slate-500">
                        Resumo: <span className="font-medium">{scopeSummary}</span>
                        {' - '}Ref. geografica: {geoSource === 'ibge' ? 'IBGE (sincronizado)' : 'fallback local'}.
                    </p>
                )}
                {scopeError && <p className="mt-2 text-sm text-red-600">{scopeError}</p>}
            </div>

            {/* BLOCO B -- Cadastro em cascata */}
            <div className={`rounded-xl border p-5 transition ${!scopeIsValid ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-slate-50'}`}>
                <BlockHeader step={2} title="Adicionar localidade de coleta" tooltip="Fluxo em cascata: escolha o nivel e percorra Estado > Cidade > Localidade conforme a abrangencia." />

                {!scopeIsValid ? (
                    <p className="text-xs text-slate-500 mb-4">Conclua o Bloco 1 (Abrangencia) para habilitar o cadastro.</p>
                ) : (
                    <>
                        {/* Seletor de nivel */}
                        {allowedLevels.length > 1 && (
                            <div className={`mb-5 grid gap-2 ${allowedLevels.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {allowedLevels.map((level) => {
                                    const count = localities.filter((l) => l.geo_level === level).length;
                                    return (
                                        <button key={level} type="button"
                                            onClick={() => setCascade((prev) => ({ ...prev, geo_level: level, localityName: '', zone: 'urban' }))}
                                            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${cascade.geo_level === level ? 'border-blue-500 bg-blue-100 text-blue-800' : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'}`}
                                        >
                                            <div className="font-semibold">{GEO_LEVEL_LABELS[level]}</div>
                                            <div className="text-xs opacity-70">{count} cadastrado{count !== 1 ? 's' : ''}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {/* Cascata visual: Estado -> Cidade -> Localidade */}
                        <div className="space-y-3">

                            {/* Passo 1: Estado (apenas nacional) */}
                            {showStatePicker && (
                                <div className="flex items-start gap-2">
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                            1. Estado {cascade.geo_level !== 'state' && <span className="text-red-500">*</span>}
                                        </label>
                                        <input
                                            list="cascade-states-datalist"
                                            value={cascade.state}
                                            onChange={(e) => setCascade((prev) => ({ ...prev, state: e.target.value, city: '', localityName: '', zone: 'urban' }))}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                                            placeholder="Digite ou selecione o estado..."
                                            autoComplete="off"
                                        />
                                        <datalist id="cascade-states-datalist">
                                            {stateNames.map((s) => <option key={s} value={s} />)}
                                        </datalist>
                                    </div>
                                    {cascade.geo_level !== 'state' && cascade.state && (
                                        <ChevronRight size={16} className="mt-8 shrink-0 text-slate-400" />
                                    )}
                                </div>
                            )}

                            {/* Passo 2: Cidade */}
                            {showCityPicker && (
                                <div className="flex items-start gap-2">
                                    {!showStatePicker && scopeData.geographic_scope === 'state' && cascade.state === '' && (
                                        // Estado fixo pelo scope; mostra badge
                                        <div className="flex-1">
                                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                                Estado (fixo pela abrangencia)
                                            </label>
                                            <div className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white text-slate-600 font-medium">
                                                {scopeData.scope_state_name}
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                            {!showStatePicker && scopeData.geographic_scope === 'state' ? '1.' : '2.'} Cidade {cascade.geo_level !== 'state' && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className="relative">
                                            <input
                                                list="cascade-cities-datalist"
                                                value={cascade.city}
                                                onChange={(e) => setCascade((prev) => ({ ...prev, city: e.target.value, localityName: '', zone: 'urban' }))}
                                                disabled={!cityPickerEnabled || loadingCities}
                                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                                placeholder={loadingCities ? 'Carregando cidades...' : !cityPickerEnabled ? 'Selecione o estado primeiro' : 'Digite ou selecione a cidade...'}
                                                autoComplete="off"
                                            />
                                            <datalist id="cascade-cities-datalist">
                                                {ibgeCities.map((c) => <option key={c} value={c} />)}
                                            </datalist>
                                            {loadingCities && <Loader2 size={14} className="absolute right-3 top-3.5 animate-spin text-blue-500" />}
                                        </div>
                                    </div>
                                    {cascade.geo_level === 'locality' && cascade.city && (
                                        <ChevronRight size={16} className="mt-8 shrink-0 text-slate-400" />
                                    )}
                                </div>
                            )}

                            {/* Passo 3: Localidade especifica */}
                            {showLocalityPicker && (
                                <div>
                                    {scopeData.geographic_scope === 'city' && (
                                        <div className="mb-3 border border-slate-200 rounded-lg px-3 py-2.5 bg-white text-sm text-slate-600">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-0.5">Cidade (fixo pela abrangencia)</span>
                                            <span className="font-medium">{scopeData.scope_state_name} &rsaquo; {scopeData.scope_city_name}</span>
                                        </div>
                                    )}
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                        {scopeData.geographic_scope === 'city' ? '1.' : showStatePicker ? '3.' : '2.'} Localidade especifica <span className="text-red-500">*</span>
                                        <Tooltip text="Bairro, distrito, vila, sitio ou outra localidade especifica. Lista carregada do IBGE com base na cidade selecionada." helpId="localities-specific" />
                                    </label>
                                    <div className="relative">
                                        <input
                                            list="ibge-localities-datalist"
                                            value={cascade.localityName}
                                            onChange={(e) => handleLocalitySelect(e.target.value)}
                                            disabled={!localityPickerEnabled && scopeData.geographic_scope !== 'city'}
                                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder={loadingLocalities ? 'Carregando sugestoes do IBGE...' : !localityPickerEnabled ? 'Selecione a cidade primeiro' : 'Digite ou selecione a localidade...'}
                                            autoComplete="off"
                                        />
                                        <datalist id="ibge-localities-datalist">
                                            {ibgeLocalities.map((l) => <option key={l.name} value={l.name} />)}
                                        </datalist>
                                        {loadingLocalities && <Loader2 size={14} className="absolute right-3 top-3.5 animate-spin text-blue-500" />}
                                    </div>

                                    {/* Zona: auto-preenchida, mas editavel */}
                                    <div className="mt-3">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                            Zona
                                            <Tooltip text="Classificacao de zona sugerida pelo IBGE. Pode ser ajustada manualmente." helpId="localities-zone" />
                                        </label>
                                        <div className="flex gap-2">
                                            {(Object.entries(ZONE_LABELS) as ['urban' | 'rural' | 'mixed', string][]).map(([v, label]) => (
                                                <button key={v} type="button"
                                                    onClick={() => setCascade((prev) => ({ ...prev, zone: v }))}
                                                    className={`flex-1 rounded-lg border px-3 py-2 text-xs text-center font-medium transition ${cascade.zone === v ? 'border-blue-500 bg-blue-100 text-blue-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-blue-50'}`}
                                                >
                                                    {label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Zona para state/city */}
                            {cascade.geo_level !== 'locality' && (
                                <div className="mt-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                        Zona <Tooltip text="Classificacao de zona para organizacao operacional de campo." helpId="localities-zone" />
                                    </label>
                                    <div className="flex gap-2">
                                        {(Object.entries(ZONE_LABELS) as ['urban' | 'rural' | 'mixed', string][]).map(([v, label]) => (
                                            <button key={v} type="button"
                                                onClick={() => setCascade((prev) => ({ ...prev, zone: v }))}
                                                className={`flex-1 rounded-lg border px-3 py-2 text-xs text-center font-medium transition ${cascade.zone === v ? 'border-blue-500 bg-blue-100 text-blue-800' : 'border-slate-300 bg-white text-slate-600 hover:bg-blue-50'}`}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

                        <button type="button" onClick={handleAdd}
                            className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
                        >
                            <Plus size={18} />
                            {addButtonLabel}
                        </button>

                        <p className="mt-2 text-xs text-slate-400">
                            Dados de populacao e dimensionamento amostral sao configurados na <strong>Etapa 3</strong>.
                        </p>
                    </>
                )}
            </div>

            {/* BLOCO C -- Lista */}
            <div className={`rounded-xl border p-5 ${!scopeIsValid ? 'border-slate-200 bg-slate-50 opacity-60' : 'border-slate-200 bg-white'}`}>
                <BlockHeader step={3} title="Localidades cadastradas" done={localities.length > 0} />

                {localities.length === 0 ? (
                    <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-xl">
                        <MapPin size={32} className="mx-auto mb-2 opacity-40" />
                        <p className="text-sm">Nenhuma localidade cadastrada</p>
                        <p className="text-xs mt-1">Adicione pelo menos uma localidade no Bloco 2 acima</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                        <th className="text-left px-4 py-3 font-semibold">Nivel</th>
                                        <th className="text-left px-4 py-3 font-semibold">Nome</th>
                                        <th className="text-left px-4 py-3 font-semibold">Hierarquia</th>
                                        <th className="text-left px-4 py-3 font-semibold">Zona</th>
                                        <th className="px-4 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {localities.map((loc) => (
                                        <tr key={loc.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${loc.geo_level === 'state' ? 'bg-indigo-100 text-indigo-700' : loc.geo_level === 'city' ? 'bg-teal-100 text-teal-700' : 'bg-amber-100 text-amber-700'}`}>
                                                    {GEO_LEVEL_LABELS[loc.geo_level]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{loc.name}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">
                                                {loc.parent_state_name ?? '---'}
                                                {loc.parent_city_name ? ` > ${loc.parent_city_name}` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">{ZONE_LABELS[loc.zone]}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button type="button" onClick={() => handleRemove(loc.id)}
                                                    className="text-red-400 hover:text-red-600 transition" aria-label={`Remover ${loc.name}`}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-200">
                                    <tr>
                                        <td className="px-4 py-3 text-xs text-slate-500" colSpan={5}>
                                            {localities.length} localidade{localities.length !== 1 ? 's' : ''} cadastrada{localities.length !== 1 ? 's' : ''}
                                            {' - '}
                                            {getEffectiveLocalities(localities).length} efetiva{getEffectiveLocalities(localities).length !== 1 ? 's' : ''}
                                            <Tooltip text="Localidades efetivas excluem registros cobertos por localidades-filho (evita dupla contagem na amostra)." />
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                            Dados de populacao e dimensionamento amostral sao configurados na <strong>Etapa 3 &mdash; Dimensionamento Amostral</strong>.
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
