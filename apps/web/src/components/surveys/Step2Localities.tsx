'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Plus, Trash2, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import {
    getSurveyDecision,
    allowedGeoLevels,
    checkLocalitiesCompatibility,
    getEffectiveLocalities,
    GEO_LEVEL_LABELS,
    GEO_LEVEL_ADD_LABELS,
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

interface GeoStateOption {
    code: number;
    uf: string;
    name: string;
}

type FormState = {
    name: string;
    geo_level: GeoLevel;
    parent_state_name: string;
    parent_city_name: string;
    zone: 'urban' | 'rural' | 'mixed';
};

// --- Helpers UI ---

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

function BlockHeader({
    step,
    title,
    done,
    tooltip,
}: {
    step: number;
    title: string;
    done?: boolean;
    tooltip?: string;
}) {
    return (
        <div className="flex items-center gap-3 mb-4">
            <div
                className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 ${done ? 'bg-green-500 text-white' : 'bg-blue-600 text-white'}`}
            >
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

    const allowedLevels = useMemo(
        () => allowedGeoLevels(scopeData.geographic_scope),
        [scopeData.geographic_scope],
    );

    const scopeIsValid = useMemo(() => {
        if (!scopeData.geographic_scope) return false;
        if (scopeData.geographic_scope === 'national') return Boolean(scopeData.scope_country_name.trim());
        if (scopeData.geographic_scope === 'state') return Boolean(scopeData.scope_state_name.trim());
        if (scopeData.geographic_scope === 'city')
            return Boolean(scopeData.scope_state_name.trim() && scopeData.scope_city_name.trim());
        if (scopeData.geographic_scope === 'specific_public')
            return Boolean(scopeData.specific_public_description.trim());
        return false;
    }, [scopeData]);

    const [form, setForm] = useState<FormState>({
        name: '',
        geo_level: allowedLevels[0] ?? 'locality',
        parent_state_name: '',
        parent_city_name: '',
        zone: 'urban',
    });

    const [formError, setFormError] = useState('');
    const [scopeError, setScopeError] = useState('');
    const [confirmScopeReset, setConfirmScopeReset] = useState(false);
    const [pendingScopeChange, setPendingScopeChange] = useState<ScopeData | null>(null);

    const [geoSource, setGeoSource] = useState<'ibge' | 'fallback' | null>(null);
    const [ibgeStates, setIbgeStates] = useState<GeoStateOption[]>([]);
    const [ibgeCities, setIbgeCities] = useState<string[]>([]);

    useEffect(() => {
        if (allowedLevels.length > 0 && !allowedLevels.includes(form.geo_level)) {
            setForm((prev) => ({ ...prev, geo_level: allowedLevels[0] }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [scopeData.geographic_scope]);

    const activeStateForCitySuggestions = useMemo(() => {
        if (scopeData.geographic_scope === 'city' || scopeData.geographic_scope === 'state') {
            return scopeData.scope_state_name;
        }
        if (scopeData.geographic_scope === 'national') {
            return form.parent_state_name;
        }
        return '';
    }, [scopeData.geographic_scope, scopeData.scope_state_name, form.parent_state_name]);

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

    useEffect(() => {
        const stateName = activeStateForCitySuggestions.trim();
        if (!stateName) { setIbgeCities([]); return; }
        let active = true;
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
            .catch(() => { if (!active) return; setIbgeCities([]); });
        return () => { active = false; };
    }, [activeStateForCitySuggestions]);

    const stateOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    ...localities.filter((l) => l.geo_level === 'state').map((l) => l.name),
                    ...ibgeStates.map((s) => s.name),
                ]),
            ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [localities, ibgeStates],
    );

    const cityOptions = useMemo(
        () =>
            Array.from(
                new Set([
                    ...localities
                        .filter((l) => l.geo_level === 'city')
                        .filter(
                            (l) =>
                                !activeStateForCitySuggestions ||
                                l.parent_state_name === activeStateForCitySuggestions,
                        )
                        .map((l) => l.name),
                    ...ibgeCities,
                ]),
            ).sort((a, b) => a.localeCompare(b, 'pt-BR')),
        [localities, activeStateForCitySuggestions, ibgeCities],
    );

    const localitiesByLevel = useMemo(
        () => ({
            state: localities.filter((l) => l.geo_level === 'state').length,
            city: localities.filter((l) => l.geo_level === 'city').length,
            locality: localities.filter((l) => l.geo_level === 'locality').length,
        }),
        [localities],
    );

    const internalConflict = useMemo(
        () => checkLocalitiesCompatibility(localities, scopeData.geographic_scope, surveyType),
        [localities, scopeData.geographic_scope, surveyType],
    );

    const conflict = externalConflict ?? internalConflict;

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
        setForm({ name: '', geo_level: 'locality', parent_state_name: '', parent_city_name: '', zone: 'urban' });
    };

    const handleAdd = () => {
        if (!scopeIsValid) {
            setScopeError('Preencha todos os campos de abrangencia antes de adicionar localidades.');
            setFormError('');
            return;
        }
        setScopeError('');

        if (!form.name.trim()) {
            setFormError('Informe o nome da localidade.');
            return;
        }

        const resolvedParentState = (() => {
            if (scopeData.geographic_scope === 'state' || scopeData.geographic_scope === 'city')
                return scopeData.scope_state_name.trim();
            return form.parent_state_name.trim();
        })();

        const resolvedParentCity = (() => {
            if (scopeData.geographic_scope === 'city') return scopeData.scope_city_name.trim();
            return form.parent_city_name.trim();
        })();

        if ((form.geo_level === 'city' || form.geo_level === 'locality') && !resolvedParentState) {
            setFormError('Informe o estado de referencia.');
            return;
        }
        if (form.geo_level === 'locality' && !resolvedParentCity) {
            setFormError('Informe a cidade de referencia.');
            return;
        }

        const duplicate = localities.some(
            (loc) =>
                loc.geo_level === form.geo_level &&
                loc.name.toLowerCase() === form.name.trim().toLowerCase() &&
                (loc.parent_state_name ?? '') === resolvedParentState &&
                (loc.parent_city_name ?? '') === resolvedParentCity,
        );
        if (duplicate) {
            setFormError('Esta localidade ja esta cadastrada na mesma hierarquia.');
            return;
        }

        setFormError('');

        const newLoc: Locality = {
            id: `loc_${Date.now()}`,
            name: form.name.trim(),
            geo_level: form.geo_level,
            parent_state_name: resolvedParentState || null,
            parent_city_name: resolvedParentCity || null,
            zone: form.zone,
            population: 0,
            population_type: decision.specificAudience ? 'segmento_especifico' : defaultPopulationType,
            interviews_required: 0,
            interviews_weight: 0,
        };

        onChange([...localities, newLoc]);

        setForm((prev) => ({
            ...prev,
            name: '',
            parent_state_name: prev.parent_state_name,
            parent_city_name: '',
        }));
    };

    const handleRemove = (id: string) => {
        onChange(localities.filter((l) => l.id !== id));
    };

    const scopeSummary = (() => {
        if (scopeData.geographic_scope === 'national') return `Pais: ${scopeData.scope_country_name || '---'}`;
        if (scopeData.geographic_scope === 'state') return `Estado: ${scopeData.scope_state_name || '---'}`;
        if (scopeData.geographic_scope === 'city')
            return `${scopeData.scope_state_name || '---'} > ${scopeData.scope_city_name || '---'}`;
        if (scopeData.geographic_scope === 'specific_public')
            return `Publico: ${scopeData.specific_public_description || '---'}`;
        return 'Nao definida';
    })();

    const scopesForDecision = decision.allowedScopes as string[];

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 2 &mdash; Abrangencia e Localidades</h2>
                <p className="text-sm text-slate-500">
                    Defina o territorio da pesquisa e cadastre as localidades de coleta. Dados populacionais e amostragem sao configurados na <strong>Etapa 3</strong>.
                </p>
                {decision.scopeHint && (
                    <p className="mt-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5">
                        {decision.scopeHint}
                    </p>
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
                    <p className="mb-4 text-xs">As {localities.length} localidade(s) cadastradas nao sao compativeis com a nova abrangencia e serao removidas. Deseja continuar?</p>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={confirmResetLocalities}
                            className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-xs font-medium hover:bg-red-700 transition"
                        >
                            Confirmar e redefinir localidades
                        </button>
                        <button
                            type="button"
                            onClick={() => { setPendingScopeChange(null); setConfirmScopeReset(false); }}
                            className="px-4 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-medium hover:bg-red-100 transition"
                        >
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
                        <label className="text-sm font-medium text-slate-700 block mb-1">
                            Nivel de abrangencia <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={scopeData.geographic_scope}
                            aria-label="Nivel de abrangencia territorial"
                            onChange={(e) => {
                                const nextScope = e.target.value as ScopeData['geographic_scope'];
                                handleScopeChange({
                                    ...scopeData,
                                    geographic_scope: nextScope,
                                    scope_country_name:
                                        nextScope === 'national'
                                            ? scopeData.scope_country_name || 'Brasil'
                                            : scopeData.scope_country_name,
                                });
                            }}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            {(['national', 'state', 'city', 'specific_public'] as GeoScope[]).map((s) => (
                                <option key={s} value={s} disabled={surveyType ? !scopesForDecision.includes(s) : false}>
                                    {GEO_SCOPE_LABELS[s]}
                                    {surveyType && !scopesForDecision.includes(s) ? ' (nao disponivel para este tipo)' : ''}
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
                            <input
                                type="text"
                                value={scopeData.scope_country_name}
                                onChange={(e) => handleScopeChange({ ...scopeData, scope_country_name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Brasil"
                            />
                        </div>
                    )}

                    {(scopeData.geographic_scope === 'state' || scopeData.geographic_scope === 'city') && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Estado <span className="text-red-500">*</span></label>
                            <input
                                list="state-options-scope"
                                type="text"
                                value={scopeData.scope_state_name}
                                onChange={(e) => handleScopeChange({ ...scopeData, scope_state_name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Ceara"
                            />
                        </div>
                    )}

                    {scopeData.geographic_scope === 'city' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Cidade <span className="text-red-500">*</span></label>
                            <input
                                list="city-options-scope"
                                type="text"
                                value={scopeData.scope_city_name}
                                onChange={(e) => handleScopeChange({ ...scopeData, scope_city_name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Fortaleza"
                            />
                        </div>
                    )}

                    {scopeData.geographic_scope === 'specific_public' && (
                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-slate-700 block mb-1">Recorte do publico especifico <span className="text-red-500">*</span></label>
                            <textarea
                                rows={2}
                                value={scopeData.specific_public_description}
                                onChange={(e) => handleScopeChange({ ...scopeData, specific_public_description: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-y"
                                placeholder="Ex: Comerciantes formais do setor alimenticio com faturamento ate R$ 200 mil/ano"
                            />
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

                <datalist id="state-options-scope">
                    {stateOptions.map((s) => <option key={s} value={s} />)}
                </datalist>
                <datalist id="city-options-scope">
                    {cityOptions.map((c) => <option key={c} value={c} />)}
                </datalist>
            </div>

            {/* BLOCO B -- Cadastro de localidade */}
            <div className={`rounded-xl border p-5 transition ${!scopeIsValid ? 'border-slate-200 bg-slate-50 opacity-70' : 'border-slate-200 bg-slate-50'}`}>
                <BlockHeader
                    step={2}
                    title="Adicionar localidade de coleta"
                    tooltip="Cadastre os niveis territoriais inferiores a abrangencia. Nao repita a propria abrangencia como localidade."
                />

                {!scopeIsValid && (
                    <p className="text-xs text-slate-500 mb-4">Conclua o Bloco 1 (Abrangencia) para habilitar o cadastro.</p>
                )}

                {scopeIsValid && (
                    <>
                        {allowedLevels.length > 1 && (
                            <div className={`mb-4 grid gap-2 ${allowedLevels.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                                {allowedLevels.map((level) => (
                                    <button
                                        key={level}
                                        type="button"
                                        onClick={() => setForm((prev) => ({ ...prev, geo_level: level, name: '', parent_city_name: '' }))}
                                        className={`rounded-lg border px-3 py-2 text-left text-sm transition ${form.geo_level === level
                                                ? 'border-blue-500 bg-blue-100 text-blue-800'
                                                : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                            }`}
                                    >
                                        <div className="font-semibold">{GEO_LEVEL_ADD_LABELS[level]}</div>
                                        <div className="text-xs opacity-70">
                                            {localitiesByLevel[level]} cadastrado{localitiesByLevel[level] !== 1 ? 's' : ''}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="loc-name" className="text-sm font-medium text-slate-700 block mb-1">
                                    {GEO_LEVEL_LABELS[form.geo_level]} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="loc-name"
                                    type="text"
                                    list={
                                        form.geo_level === 'state'
                                            ? 'state-options-scope'
                                            : form.geo_level === 'city'
                                                ? 'city-options-scope'
                                                : undefined
                                    }
                                    value={form.name}
                                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                    placeholder={
                                        form.geo_level === 'state'
                                            ? 'Ex: Ceara'
                                            : form.geo_level === 'city'
                                                ? 'Ex: Fortaleza'
                                                : 'Ex: Bairro Aldeota'
                                    }
                                />
                            </div>

                            {scopeData.geographic_scope === 'national' &&
                                (form.geo_level === 'city' || form.geo_level === 'locality') && (
                                    <div>
                                        <label htmlFor="loc-parent-state" className="text-sm font-medium text-slate-700 block mb-1">
                                            Estado de referencia <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="loc-parent-state"
                                            list="state-options-scope"
                                            type="text"
                                            value={form.parent_state_name}
                                            onChange={(e) =>
                                                setForm((prev) => ({
                                                    ...prev,
                                                    parent_state_name: e.target.value,
                                                    parent_city_name: '',
                                                }))
                                            }
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ex: Ceara"
                                        />
                                    </div>
                                )}

                            {form.geo_level === 'locality' &&
                                (scopeData.geographic_scope === 'national' || scopeData.geographic_scope === 'state') && (
                                    <div>
                                        <label htmlFor="loc-parent-city" className="text-sm font-medium text-slate-700 block mb-1">
                                            Cidade de referencia <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            id="loc-parent-city"
                                            list="city-options-scope"
                                            type="text"
                                            value={form.parent_city_name}
                                            onChange={(e) =>
                                                setForm((prev) => ({ ...prev, parent_city_name: e.target.value }))
                                            }
                                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ex: Fortaleza"
                                        />
                                    </div>
                                )}

                            <div>
                                <label htmlFor="loc-zone" className="text-sm font-medium text-slate-700 block mb-1">
                                    Zona
                                    <Tooltip text="Urbana (sede), rural (interior) ou mista. Usado para organizacao operacional de campo." helpId="localities-zone" />
                                </label>
                                <select
                                    id="loc-zone"
                                    value={form.zone}
                                    onChange={(e) => setForm((prev) => ({ ...prev, zone: e.target.value as FormState['zone'] }))}
                                    className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                >
                                    {(Object.entries(ZONE_LABELS) as [FormState['zone'], string][]).map(([v, l]) => (
                                        <option key={v} value={v}>{l}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {formError && <p className="mt-2 text-sm text-red-600">{formError}</p>}

                        <button
                            type="button"
                            onClick={handleAdd}
                            className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
                        >
                            <Plus size={18} />
                            {GEO_LEVEL_ADD_LABELS[form.geo_level]}
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
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${loc.geo_level === 'state'
                                                        ? 'bg-indigo-100 text-indigo-700'
                                                        : loc.geo_level === 'city'
                                                            ? 'bg-teal-100 text-teal-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {GEO_LEVEL_LABELS[loc.geo_level]}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{loc.name}</td>
                                            <td className="px-4 py-3 text-slate-500 text-xs">
                                                {loc.parent_state_name ? `${loc.parent_state_name}` : '---'}
                                                {loc.parent_city_name ? ` > ${loc.parent_city_name}` : ''}
                                            </td>
                                            <td className="px-4 py-3 text-slate-600 text-xs">{ZONE_LABELS[loc.zone]}</td>
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
