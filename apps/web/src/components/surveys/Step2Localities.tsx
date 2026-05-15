'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, HelpCircle, Calculator, Users } from 'lucide-react';
import Link from 'next/link';
import { shouldUseStatisticalSampling, type SurveyTechData } from './Step1TechnicalData';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';
import { TSE_AGE_LABELS, type TseVoterProportions } from '@/lib/geo/tse-voter-profiles';

export interface Locality {
    id: string;
    name: string;
    geo_level: 'state' | 'city' | 'locality';
    parent_state_name?: string | null;
    parent_city_name?: string | null;
    zone: 'urban' | 'rural' | 'mixed';
    population: number;
    population_type: 'eleitores' | 'habitantes' | 'comerciantes' | 'comerciarios' | 'consumidores' | 'dona_de_casa' | 'industriarios' | 'funcionarios_publicos' | 'prestadores_servicos' | 'professores' | 'profissional_liberal' | 'publico_geral' | 'segmento_especifico' | 'sindicalistas';
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
    marginOfError: number;
    confidenceInterval: number;
    surveyType: string;
    scopeData: ScopeData;
    onScopeChange: (scopeData: ScopeData) => void;
}

interface GeoStateOption {
    code: number;
    uf: string;
    name: string;
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
    return 1.96;
}

function calcInterviews(population: number, marginError: number, confidenceInterval: number, useInfinitePopulation = false): number {
    if (marginError <= 0) return 0;
    const z = getZ(confidenceInterval);
    const p = 0.5;
    const e = marginError / 100;
    const n0 = (z * z * p * (1 - p)) / (e * e);
    if (useInfinitePopulation) return Math.ceil(n0);
    if (population <= 0) return 0;
    const n = n0 / (1 + (n0 - 1) / population);
    return Math.ceil(n);
}

const ZONE_LABELS: Record<Locality['zone'], string> = {
    urban: 'Sede ou Urbana',
    rural: 'Interior ou Rural',
    mixed: 'Misto (Urbana + Rural)',
};

const GEO_LEVEL_LABELS: Record<Locality['geo_level'], string> = {
    state: 'Estado',
    city: 'Cidade',
    locality: 'Localidade específica',
};

const GEO_LEVEL_ACTION_LABELS: Record<Locality['geo_level'], string> = {
    state: 'Adicionar estado',
    city: 'Adicionar cidade',
    locality: 'Adicionar localidade específica',
};

function isSpecificAudienceSurvey(surveyType: string): boolean {
    return ['publico_alvo', 'segmentacao_mercado', 'qualitativa_grupo_focal', 'qualitativa_profundidade', 'qualitativa_motivacional'].includes(surveyType);
}

function allowedLevelsByScope(scope: ScopeData['geographic_scope']): Array<Locality['geo_level']> {
    if (scope === 'national') return ['state', 'city', 'locality'];
    if (scope === 'state') return ['city', 'locality'];
    if (scope === 'city') return ['locality'];
    if (scope === 'specific_public') return ['locality'];
    return ['locality'];
}

function getGuidedFlowMessage(scope: ScopeData['geographic_scope']): string {
    if (scope === 'national') {
        return 'Fluxo nacional: informe o país uma vez e adicione estados, cidades e/ou localidades específicas sem repetir níveis superiores.';
    }
    if (scope === 'state') {
        return 'Fluxo estadual: informe o estado uma vez e adicione apenas cidades e localidades específicas desse estado.';
    }
    if (scope === 'city') {
        return 'Fluxo municipal: informe estado e cidade uma vez e adicione apenas localidades específicas desse município.';
    }
    if (scope === 'specific_public') {
        return 'Fluxo para público específico: descreva o recorte e adicione as localidades específicas de coleta.';
    }
    return 'Selecione a abrangência para habilitar o fluxo guiado por níveis.';
}

function getEffectiveLocalities(localities: Locality[]): Locality[] {
    return localities.filter((loc) => {
        if (loc.geo_level === 'state') {
            return !localities.some((child) => child.geo_level !== 'state' && child.parent_state_name === loc.name);
        }
        if (loc.geo_level === 'city') {
            return !localities.some((child) => child.geo_level === 'locality' && child.parent_city_name === loc.name && child.parent_state_name === loc.parent_state_name);
        }
        return true;
    });
}

export function Step2Localities({
    localities,
    onChange,
    marginOfError,
    confidenceInterval,
    surveyType,
    scopeData,
    onScopeChange,
}: Props) {
    const usesSampling = shouldUseStatisticalSampling(surveyType);
    const forceInfinitePopulation = scopeData.geographic_scope === 'national';
    const specificAudience = isSpecificAudienceSurvey(surveyType);

    const allowedLevels = useMemo(
        () => allowedLevelsByScope(scopeData.geographic_scope),
        [scopeData.geographic_scope]
    );

    const [form, setForm] = useState<Omit<Locality, 'id' | 'interviews_weight'> & { interviews_required: number }>({
        name: '',
        geo_level: 'locality',
        parent_state_name: null,
        parent_city_name: null,
        zone: 'urban',
        population: 0,
        population_type: specificAudience ? 'segmento_especifico' : 'eleitores',
        interviews_required: 0,
    });

    const [error, setError] = useState('');
    const [geoSource, setGeoSource] = useState<'ibge' | 'fallback' | null>(null);
    const [ibgeStates, setIbgeStates] = useState<GeoStateOption[]>([]);
    const [ibgeCities, setIbgeCities] = useState<string[]>([]);
    const [populationLookup, setPopulationLookup] = useState<{
        loading: boolean;
        message: string | null;
        suggestedPopulation: number | null;
        suggestedCity: string | null;
        suggestedConfidence: number | null;
    }>({
        loading: false,
        message: null,
        suggestedPopulation: null,
        suggestedCity: null,
        suggestedConfidence: null,
    });

    const [voterLookup, setVoterLookup] = useState<{
        loading: boolean;
        message: string | null;
        total: number | null;
        cityName: string | null;
        confidence: number | null;
        matchType: 'exact' | 'smart' | 'none' | null;
        proportions: TseVoterProportions | null;
        showProportions: boolean;
    }>({
        loading: false,
        message: null,
        total: null,
        cityName: null,
        confidence: null,
        matchType: null,
        proportions: null,
        showProportions: false,
    });

    const effectiveLocalities = useMemo(() => getEffectiveLocalities(localities), [localities]);
    const totalInterviews = effectiveLocalities.reduce((acc, l) => acc + (l.interviews_required ?? 0), 0);
    const totalPopulation = effectiveLocalities.reduce((acc, l) => acc + (l.population ?? 0), 0);

    const activeStateForCitySuggestions = useMemo(() => {
        if (scopeData.geographic_scope === 'city' || scopeData.geographic_scope === 'state') {
            return scopeData.scope_state_name;
        }
        if (scopeData.geographic_scope === 'national') {
            return form.parent_state_name ?? '';
        }
        return '';
    }, [scopeData.geographic_scope, scopeData.scope_state_name, form.parent_state_name]);

    useEffect(() => {
        let active = true;

        const loadStates = async () => {
            try {
                const response = await fetch('/api/geo/states', { cache: 'force-cache' });
                const payload = await response.json();
                if (!active) return;

                if (payload?.success && Array.isArray(payload?.data?.states)) {
                    setIbgeStates(payload.data.states as GeoStateOption[]);
                    setGeoSource((payload.data.source as 'ibge' | 'fallback') ?? null);
                }
            } catch {
                if (!active) return;
                setGeoSource('fallback');
            }
        };

        loadStates();

        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const stateName = activeStateForCitySuggestions.trim();
        if (!stateName) {
            setIbgeCities([]);
            return;
        }

        let active = true;

        const loadCities = async () => {
            try {
                const response = await fetch(`/api/geo/cities?state=${encodeURIComponent(stateName)}`, { cache: 'force-cache' });
                const payload = await response.json();
                if (!active) return;

                if (payload?.success && Array.isArray(payload?.data?.cities)) {
                    setIbgeCities(payload.data.cities as string[]);
                    if (payload?.data?.source) {
                        setGeoSource(payload.data.source as 'ibge' | 'fallback');
                    }
                } else {
                    setIbgeCities([]);
                }
            } catch {
                if (!active) return;
                setIbgeCities([]);
            }
        };

        loadCities();

        return () => {
            active = false;
        };
    }, [activeStateForCitySuggestions]);

    const stateOptions = useMemo(() => {
        const localStateNames = localities.filter(l => l.geo_level === 'state').map(l => l.name);
        const ibgeStateNames = ibgeStates.map((state) => state.name);

        return Array.from(new Set([...localStateNames, ...ibgeStateNames])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [localities, ibgeStates]);

    const cityOptions = useMemo(() => {
        const localCityNames = localities
            .filter(l => l.geo_level === 'city')
            .filter(l => !activeStateForCitySuggestions || l.parent_state_name === activeStateForCitySuggestions)
            .map(l => l.name);

        return Array.from(new Set([...localCityNames, ...ibgeCities])).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    }, [localities, activeStateForCitySuggestions, ibgeCities]);

    const localitiesByLevel = useMemo(() => {
        return {
            state: localities.filter(l => l.geo_level === 'state').length,
            city: localities.filter(l => l.geo_level === 'city').length,
            locality: localities.filter(l => l.geo_level === 'locality').length,
        };
    }, [localities]);

    const validateScope = (): string | null => {
        if (!scopeData.geographic_scope) return 'Selecione a abrangência territorial da pesquisa.';
        if (scopeData.geographic_scope === 'national' && !scopeData.scope_country_name.trim()) return 'Informe o país da pesquisa nacional.';
        if (scopeData.geographic_scope === 'state' && !scopeData.scope_state_name.trim()) return 'Informe o estado da pesquisa estadual.';
        if (scopeData.geographic_scope === 'city' && (!scopeData.scope_state_name.trim() || !scopeData.scope_city_name.trim())) {
            return 'Informe estado e cidade da pesquisa municipal.';
        }
        if (scopeData.geographic_scope === 'specific_public' && !scopeData.specific_public_description.trim()) {
            return 'Descreva o recorte do público específico.';
        }
        return null;
    };

    const resolveHierarchy = () => {
        const resolvedParentState = (() => {
            if (scopeData.geographic_scope === 'state' || scopeData.geographic_scope === 'city') return scopeData.scope_state_name.trim();
            if (form.geo_level === 'city' || form.geo_level === 'locality') return (form.parent_state_name ?? '').trim();
            return '';
        })();

        const resolvedParentCity = (() => {
            if (scopeData.geographic_scope === 'city') return scopeData.scope_city_name.trim();
            if (form.geo_level === 'locality') return (form.parent_city_name ?? '').trim();
            return '';
        })();

        return {
            resolvedParentState,
            resolvedParentCity,
        };
    };

    const handleSuggestPopulation = async () => {
        const { resolvedParentState, resolvedParentCity } = resolveHierarchy();

        const stateForLookup = resolvedParentState;
        const cityForLookup = form.geo_level === 'city' ? form.name.trim() : resolvedParentCity;

        if (!stateForLookup || !cityForLookup) {
            setPopulationLookup({
                loading: false,
                message: 'Informe estado e cidade para sugerir população via IBGE.',
                suggestedPopulation: null,
                suggestedCity: null,
                suggestedConfidence: null,
            });
            return;
        }

        setPopulationLookup({
            loading: true,
            message: null,
            suggestedPopulation: null,
            suggestedCity: null,
            suggestedConfidence: null,
        });

        try {
            const response = await fetch(
                `/api/geo/population?state=${encodeURIComponent(stateForLookup)}&city=${encodeURIComponent(cityForLookup)}`,
            );
            const payload = await response.json();

            const population = Number(payload?.data?.population ?? 0);
            if (payload?.success && Number.isFinite(population) && population > 0) {
                const matchType = String(payload?.data?.match_type ?? 'none');
                const matchedCity = (payload?.data?.cityName as string | undefined) ?? cityForLookup;
                const confidence = Number(payload?.data?.confidence ?? 0);

                if (matchType === 'exact') {
                    setForm((prev) => ({ ...prev, population }));
                    setPopulationLookup({
                        loading: false,
                        message: `População exata do IBGE para ${matchedCity}: ${population.toLocaleString('pt-BR')} habitantes.`,
                        suggestedPopulation: null,
                        suggestedCity: null,
                        suggestedConfidence: null,
                    });
                    return;
                }

                if (matchType === 'smart') {
                    setPopulationLookup({
                        loading: false,
                        message: payload?.data?.warning ?? `Sugestão inteligente encontrada: ${matchedCity}. Confirme para aplicar.`,
                        suggestedPopulation: population,
                        suggestedCity: matchedCity,
                        suggestedConfidence: Number.isFinite(confidence) ? confidence : null,
                    });
                    return;
                }

                setForm((prev) => ({ ...prev, population }));
                setPopulationLookup({
                    loading: false,
                    message: `População obtida do IBGE: ${population.toLocaleString('pt-BR')} habitantes.`,
                    suggestedPopulation: null,
                    suggestedCity: null,
                    suggestedConfidence: null,
                });
                return;
            }

            setPopulationLookup({
                loading: false,
                message: payload?.data?.warning ?? 'Não foi possível sugerir população para esta localidade.',
                suggestedPopulation: null,
                suggestedCity: null,
                suggestedConfidence: null,
            });
        } catch {
            setPopulationLookup({
                loading: false,
                message: 'Falha ao consultar população no IBGE. Você pode preencher manualmente.',
                suggestedPopulation: null,
                suggestedCity: null,
                suggestedConfidence: null,
            });
        }
    };

    const applySuggestedPopulation = () => {
        if (!populationLookup.suggestedPopulation || populationLookup.suggestedPopulation <= 0) return;
        setForm((prev) => ({ ...prev, population: populationLookup.suggestedPopulation as number }));
        setPopulationLookup((prev) => ({
            loading: false,
            message: `Sugestão aplicada para ${prev.suggestedCity}: ${(prev.suggestedPopulation as number).toLocaleString('pt-BR')} habitantes.`,
            suggestedPopulation: null,
            suggestedCity: null,
            suggestedConfidence: null,
        }));
    };

    const handleQueryVoters = async () => {
        const { resolvedParentState, resolvedParentCity } = resolveHierarchy();
        const stateForLookup = resolvedParentState;
        const cityForLookup = form.geo_level === 'city' ? form.name.trim() : resolvedParentCity;

        if (!stateForLookup || !cityForLookup) {
            setVoterLookup((prev) => ({ ...prev, loading: false, message: 'Informe estado e cidade para consultar o eleitorado via TSE.' }));
            return;
        }

        setVoterLookup({ loading: true, message: null, total: null, cityName: null, confidence: null, matchType: null, proportions: null, showProportions: false });

        try {
            const res = await fetch(`/api/geo/voters?state=${encodeURIComponent(stateForLookup)}&city=${encodeURIComponent(cityForLookup)}`);
            const payload = await res.json();

            if (!payload?.success) {
                setVoterLookup({ loading: false, message: payload?.error ?? 'Falha ao consultar TSE.', total: null, cityName: null, confidence: null, matchType: null, proportions: null, showProportions: false });
                return;
            }

            const { total, cityName, match_type, confidence, proportions, warning } = payload.data ?? {};

            if (!total || match_type === 'none') {
                setVoterLookup({ loading: false, message: warning ?? 'Município não encontrado no TSE.', total: null, cityName: null, confidence: null, matchType: 'none', proportions: null, showProportions: false });
                return;
            }

            if (match_type === 'exact') {
                setForm((prev) => ({ ...prev, population: total }));
                setVoterLookup({ loading: false, message: `TSE: ${(total as number).toLocaleString('pt-BR')} eleitores em ${cityName}.`, total: total as number, cityName: cityName as string, confidence: null, matchType: 'exact', proportions: proportions as TseVoterProportions ?? null, showProportions: false });
                return;
            }

            // smart match — pede confirmação
            setVoterLookup({ loading: false, message: warning as string ?? `Sugestão: "${cityName}". Confirme para aplicar.`, total: total as number, cityName: cityName as string, confidence: confidence as number ?? null, matchType: 'smart', proportions: proportions as TseVoterProportions ?? null, showProportions: false });
        } catch {
            setVoterLookup({ loading: false, message: 'Falha ao consultar eleitorado no TSE. Preencha manualmente.', total: null, cityName: null, confidence: null, matchType: null, proportions: null, showProportions: false });
        }
    };

    const applyVoterSuggestion = () => {
        if (!voterLookup.total || voterLookup.total <= 0) return;
        setForm((prev) => ({ ...prev, population: voterLookup.total as number }));
        setVoterLookup((prev) => ({
            ...prev,
            matchType: 'exact',
            message: `Aplicado: ${(voterLookup.total as number).toLocaleString('pt-BR')} eleitores em ${voterLookup.cityName}.`,
        }));
    };

    const handleAdd = () => {
        const scopeError = validateScope();
        if (scopeError) {
            setError(scopeError);
            return;
        }

        if (!form.name.trim()) {
            setError('Informe o nome da localidade.');
            return;
        }

        if (!allowedLevels.includes(form.geo_level)) {
            setError('Esse nível não é permitido para a abrangência selecionada.');
            return;
        }

        const { resolvedParentState, resolvedParentCity } = resolveHierarchy();

        if ((form.geo_level === 'city' || form.geo_level === 'locality') && !resolvedParentState) {
            setError('Informe o estado de referência para esse cadastro.');
            return;
        }

        if (form.geo_level === 'locality' && !resolvedParentCity) {
            setError('Informe a cidade de referência para a localidade específica.');
            return;
        }

        const duplicate = localities.some((loc) =>
            loc.geo_level === form.geo_level
            && loc.name.toLowerCase() === form.name.trim().toLowerCase()
            && (loc.parent_state_name ?? '') === (resolvedParentState || '')
            && (loc.parent_city_name ?? '') === (resolvedParentCity || '')
        );

        if (duplicate) {
            setError('Este item já foi cadastrado na mesma hierarquia.');
            return;
        }

        const interviews = usesSampling
            ? calcInterviews(form.population, marginOfError, confidenceInterval, forceInfinitePopulation)
            : form.interviews_required;

        if (!usesSampling && form.population > 0 && interviews <= 0) {
            setError('Informe entrevistas planejadas para esta localidade.');
            return;
        }

        setError('');

        const newLoc: Locality = {
            id: `loc_${Date.now()}`,
            ...form,
            name: form.name.trim(),
            parent_state_name: resolvedParentState || null,
            parent_city_name: resolvedParentCity || null,
            population_type: specificAudience ? 'segmento_especifico' : form.population_type,
            interviews_required: interviews,
        };

        const updated = [...localities, newLoc];
        const total = getEffectiveLocalities(updated).reduce((sum, loc) => sum + (loc.interviews_required ?? 0), 0);
        const withWeights = updated.map((loc) => ({
            ...loc,
            interviews_weight: total > 0 ? (loc.interviews_required ?? 0) / total : 0,
        }));

        onChange(withWeights);

        setForm({
            name: '',
            geo_level: allowedLevels[0] ?? 'locality',
            parent_state_name: null,
            parent_city_name: null,
            zone: 'urban',
            population: 0,
            population_type: specificAudience ? 'segmento_especifico' : 'eleitores',
            interviews_required: 0,
        });
        setPopulationLookup({
            loading: false,
            message: null,
            suggestedPopulation: null,
            suggestedCity: null,
            suggestedConfidence: null,
        });
        setVoterLookup({
            loading: false,
            message: null,
            total: null,
            cityName: null,
            confidence: null,
            matchType: null,
            proportions: null,
            showProportions: false,
        });
    };

    const handleRemove = (id: string) => {
        const updated = localities.filter((loc) => loc.id !== id);
        const total = getEffectiveLocalities(updated).reduce((sum, loc) => sum + (loc.interviews_required ?? 0), 0);
        onChange(updated.map((loc) => ({
            ...loc,
            interviews_weight: total > 0 ? (loc.interviews_required ?? 0) / total : 0,
        })));
    };

    const handleRecalcAll = () => {
        if (!usesSampling) {
            const total = getEffectiveLocalities(localities).reduce((sum, loc) => sum + (loc.interviews_required ?? 0), 0);
            onChange(localities.map((loc) => ({
                ...loc,
                interviews_weight: total > 0 ? (loc.interviews_required ?? 0) / total : 0,
            })));
            return;
        }

        const recalc = localities.map((loc) => ({
            ...loc,
            interviews_required: calcInterviews(loc.population, marginOfError, confidenceInterval, forceInfinitePopulation),
        }));
        const total = getEffectiveLocalities(recalc).reduce((sum, loc) => sum + (loc.interviews_required ?? 0), 0);
        onChange(recalc.map((loc) => ({
            ...loc,
            interviews_weight: total > 0 ? (loc.interviews_required ?? 0) / total : 0,
        })));
    };

    const scopeSummary = (() => {
        if (scopeData.geographic_scope === 'national') return `País: ${scopeData.scope_country_name || '—'}`;
        if (scopeData.geographic_scope === 'state') return `Estado: ${scopeData.scope_state_name || '—'}`;
        if (scopeData.geographic_scope === 'city') return `Estado: ${scopeData.scope_state_name || '—'} | Cidade: ${scopeData.scope_city_name || '—'}`;
        if (scopeData.geographic_scope === 'specific_public') return `Público específico: ${scopeData.specific_public_description || '—'}`;
        return 'Não definida';
    })();

    return (
        <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 2 — Localidades</h2>
            <p className="text-sm text-slate-500 mb-2">
                {usesSampling
                    ? 'Defina a abrangência territorial e cadastre níveis inferiores sem repetir níveis superiores. O sistema calcula entrevistas automaticamente para cada cadastro efetivo.'
                    : 'Defina a abrangência territorial e cadastre níveis inferiores sem repetir níveis superiores, com metas operacionais manuais quando necessário.'}
            </p>

            <div className="border border-slate-200 rounded-xl p-5 mb-6 bg-white">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">Abrangência territorial da pesquisa</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-slate-700 block mb-1">Nível de abrangência</label>
                        <select
                            value={scopeData.geographic_scope}
                            aria-label="Nível de abrangência territorial"
                            onChange={(e) => {
                                const nextScope = e.target.value as ScopeData['geographic_scope'];
                                const nextLevels = allowedLevelsByScope(nextScope);
                                onScopeChange({
                                    ...scopeData,
                                    geographic_scope: nextScope,
                                    scope_country_name: nextScope === 'national' ? (scopeData.scope_country_name || 'Brasil') : scopeData.scope_country_name,
                                });
                                if (!nextLevels.includes(form.geo_level)) {
                                    setForm((prev) => ({ ...prev, geo_level: nextLevels[0] ?? 'locality' }));
                                }
                            }}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            <option value="national">Nacional</option>
                            <option value="state">Estadual</option>
                            <option value="city">Municipal</option>
                            <option value="specific_public">Público específico</option>
                        </select>
                    </div>

                    {scopeData.geographic_scope === 'national' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">País</label>
                            <input
                                type="text"
                                value={scopeData.scope_country_name}
                                onChange={(e) => onScopeChange({ ...scopeData, scope_country_name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Brasil"
                            />
                        </div>
                    )}

                    {(scopeData.geographic_scope === 'state' || scopeData.geographic_scope === 'city') && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Estado</label>
                            <input
                                list="state-options-global"
                                type="text"
                                value={scopeData.scope_state_name}
                                onChange={(e) => onScopeChange({ ...scopeData, scope_state_name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Ceará"
                            />
                        </div>
                    )}

                    {scopeData.geographic_scope === 'city' && (
                        <div>
                            <label className="text-sm font-medium text-slate-700 block mb-1">Cidade</label>
                            <input
                                list="city-options-global"
                                type="text"
                                value={scopeData.scope_city_name}
                                onChange={(e) => onScopeChange({ ...scopeData, scope_city_name: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Fortaleza"
                            />
                        </div>
                    )}

                    {scopeData.geographic_scope === 'specific_public' && (
                        <div className="sm:col-span-2">
                            <label className="text-sm font-medium text-slate-700 block mb-1">Recorte do público específico</label>
                            <textarea
                                rows={2}
                                value={scopeData.specific_public_description}
                                onChange={(e) => onScopeChange({ ...scopeData, specific_public_description: e.target.value })}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-y"
                                placeholder="Ex: Comerciantes formais do setor alimentício com faturamento até R$ 200 mil/ano"
                            />
                        </div>
                    )}
                </div>
                <datalist id="state-options-global">
                    {stateOptions.map((stateName) => (
                        <option key={stateName} value={stateName} />
                    ))}
                </datalist>
                <datalist id="city-options-global">
                    {cityOptions.map((cityName) => (
                        <option key={cityName} value={cityName} />
                    ))}
                </datalist>
                <p className="mt-3 text-xs text-slate-500">Resumo: {scopeSummary}</p>
                <p className="mt-1 text-[11px] text-slate-400">
                    Referência geográfica: {geoSource === 'ibge' ? 'IBGE (sincronizado)' : 'fallback local'}.
                </p>
            </div>

            {usesSampling ? (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6 text-xs text-blue-800 flex items-start gap-2">
                    <Calculator size={15} className="mt-0.5 shrink-0 text-blue-600" />
                    <span>
                        {forceInfinitePopulation ? (
                            <>
                                <strong>Abrangência nacional com população infinita:</strong>{' '}
                                n = Z² × p × q / e² — onde Z={getZ(confidenceInterval).toFixed(3)}, p=0,5, e={marginOfError / 100}.
                            </>
                        ) : (
                            <>
                                <strong>Fórmula amostral para populações finitas:</strong>{' '}
                                n = (Z² × p × q / e²) / (1 + (Z² × p × q / e² − 1) / N) — onde Z={getZ(confidenceInterval).toFixed(3)}, p=0,5, e={marginOfError / 100}.
                            </>
                        )}
                    </span>
                </div>
            ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6 text-xs text-amber-900">
                    Para esta tipologia metodológica, não há cálculo amostral automático. A empresa define a meta operacional por localidade.
                </div>
            )}

            <div className="border border-slate-200 rounded-xl p-5 mb-6 bg-slate-50">
                <h3 className="text-sm font-semibold text-slate-700 mb-4">
                    Cadastro guiado de níveis inferiores
                    <Tooltip text="Cadastre níveis inferiores (estado, cidade, localidade) sem repetir os níveis superiores já definidos na abrangência." helpId="localities-method" />
                </h3>

                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-800">
                    {getGuidedFlowMessage(scopeData.geographic_scope)}
                </div>

                <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {allowedLevels.map((level) => (
                        <button
                            key={level}
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, geo_level: level }))}
                            className={`rounded-lg border px-3 py-2 text-left text-sm transition ${form.geo_level === level
                                ? 'border-blue-500 bg-blue-100 text-blue-800'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50'
                                }`}
                        >
                            <div className="font-semibold">{GEO_LEVEL_ACTION_LABELS[level]}</div>
                            <div className="text-xs opacity-80">Já cadastrados: {localitiesByLevel[level]}</div>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="loc-name" className="text-sm font-medium text-slate-700 block mb-1">
                            Nome: {GEO_LEVEL_LABELS[form.geo_level]} <span className="text-red-500">*</span>
                        </label>
                        <input
                            id="loc-name"
                            type="text"
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            placeholder={form.geo_level === 'state' ? 'Ex: Ceará' : form.geo_level === 'city' ? 'Ex: Fortaleza' : 'Ex: Bairro Aldeota'}
                        />
                    </div>

                    {(scopeData.geographic_scope === 'national' && (form.geo_level === 'city' || form.geo_level === 'locality')) && (
                        <div>
                            <label htmlFor="loc-parent-state" className="text-sm font-medium text-slate-700 block mb-1">Estado de referência</label>
                            <input
                                id="loc-parent-state"
                                list="state-options-global"
                                type="text"
                                value={form.parent_state_name ?? ''}
                                onChange={(e) => setForm((prev) => ({ ...prev, parent_state_name: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Ceará"
                            />
                        </div>
                    )}

                    {((scopeData.geographic_scope === 'national' || scopeData.geographic_scope === 'state') && form.geo_level === 'locality') && (
                        <div>
                            <label htmlFor="loc-parent-city" className="text-sm font-medium text-slate-700 block mb-1">Cidade de referência</label>
                            <input
                                id="loc-parent-city"
                                list="city-options-global"
                                type="text"
                                value={form.parent_city_name ?? ''}
                                onChange={(e) => setForm((prev) => ({ ...prev, parent_city_name: e.target.value }))}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: Fortaleza"
                            />
                        </div>
                    )}

                    <div>
                        <label htmlFor="loc-zone" className="text-sm font-medium text-slate-700 block mb-1">
                            Zona
                            <Tooltip text="Urbana, rural ou mista para organização operacional de campo." helpId="localities-zone" />
                        </label>
                        <select
                            id="loc-zone"
                            value={form.zone}
                            onChange={(e) => setForm((prev) => ({ ...prev, zone: e.target.value as Locality['zone'] }))}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="urban">Sede ou Urbana</option>
                            <option value="rural">Interior ou Rural</option>
                            <option value="mixed">Misto (Urbana + Rural)</option>
                        </select>
                    </div>

                    <div>
                        <label htmlFor="loc-pop" className="text-sm font-medium text-slate-700 block mb-1">
                            População base
                            <Tooltip text="População base para cálculo amostral ou estimativa operacional. Pode ser 0 em nível apenas de agrupamento." helpId="localities-population" />
                        </label>
                        <input
                            id="loc-pop"
                            type="number"
                            min={0}
                            value={form.population || ''}
                            onChange={(e) => setForm((prev) => ({ ...prev, population: parseInt(e.target.value, 10) || 0 }))}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: 50000"
                        />
                        {(form.geo_level === 'city' || form.geo_level === 'locality') && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleSuggestPopulation}
                                    disabled={populationLookup.loading}
                                    className="text-xs px-3 py-1.5 rounded-md border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 disabled:opacity-60"
                                >
                                    {populationLookup.loading ? 'Consultando IBGE...' : 'Sugerir população via IBGE'}
                                </button>
                                {form.population_type === 'eleitores' && (
                                    <button
                                        type="button"
                                        onClick={handleQueryVoters}
                                        disabled={voterLookup.loading}
                                        className="text-xs px-3 py-1.5 rounded-md border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 disabled:opacity-60"
                                    >
                                        {voterLookup.loading ? 'Consultando TSE...' : 'Consultar eleitorado (TSE)'}
                                    </button>
                                )}
                                <span className="text-[11px] text-slate-500">Consulta gratuita com fallback manual.</span>
                            </div>
                        )}
                        {populationLookup.message && (
                            <p className="mt-2 text-xs text-slate-600 bg-slate-100 border border-slate-200 rounded px-2.5 py-1.5">
                                {populationLookup.message}
                            </p>
                        )}
                        {populationLookup.suggestedPopulation && (
                            <div className="mt-2 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={applySuggestedPopulation}
                                    className="text-xs px-3 py-1.5 rounded-md border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                >
                                    Aplicar sugestão inteligente
                                </button>
                                {populationLookup.suggestedConfidence != null && (
                                    <span className="text-[11px] text-slate-500">
                                        Confianca: {(populationLookup.suggestedConfidence * 100).toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        )}
                        {/* Resultado da consulta TSE */}
                        {voterLookup.message && (
                            <p className="mt-2 text-xs text-violet-800 bg-violet-50 border border-violet-200 rounded px-2.5 py-1.5">
                                {voterLookup.message}
                            </p>
                        )}
                        {voterLookup.matchType === 'smart' && voterLookup.total && (
                            <div className="mt-2 flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={applyVoterSuggestion}
                                    className="text-xs px-3 py-1.5 rounded-md border border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100"
                                >
                                    Aplicar sugestão TSE
                                </button>
                                {voterLookup.confidence != null && (
                                    <span className="text-[11px] text-slate-500">Confiança: {(voterLookup.confidence * 100).toFixed(1)}%</span>
                                )}
                            </div>
                        )}
                        {/* Painel de proporções eleitorais */}
                        {voterLookup.proportions && (voterLookup.matchType === 'exact' || voterLookup.matchType === 'smart') && (
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => setVoterLookup((prev) => ({ ...prev, showProportions: !prev.showProportions }))}
                                    className="text-[11px] text-violet-700 underline underline-offset-2 hover:text-violet-900"
                                >
                                    {voterLookup.showProportions ? 'Ocultar' : 'Ver'} proporções do eleitorado
                                </button>
                                {voterLookup.showProportions && (
                                    <div className="mt-2 p-3 bg-violet-50 border border-violet-200 rounded-lg text-xs space-y-3">
                                        <div>
                                            <p className="font-semibold text-violet-800 mb-1.5">Distribuição por Sexo</p>
                                            <div className="flex gap-4">
                                                <span className="flex items-center gap-1">
                                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" />
                                                    Masculino: <strong>{voterLookup.proportions.sex.m.toFixed(1)}%</strong>
                                                </span>
                                                <span className="flex items-center gap-1">
                                                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-pink-400" />
                                                    Feminino: <strong>{voterLookup.proportions.sex.f.toFixed(1)}%</strong>
                                                </span>
                                                {voterLookup.proportions.sex.n > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
                                                        Outro: <strong>{voterLookup.proportions.sex.n.toFixed(1)}%</strong>
                                                    </span>
                                                )}
                                            </div>
                                            {/* Barra visual sexo */}
                                            <div className="flex h-2.5 rounded overflow-hidden mt-1.5 w-full max-w-xs">
                                                <div style={{ width: `${voterLookup.proportions.sex.m}%` }} className="bg-blue-400" />
                                                <div style={{ width: `${voterLookup.proportions.sex.f}%` }} className="bg-pink-400" />
                                                {voterLookup.proportions.sex.n > 0 && (
                                                    <div style={{ width: `${voterLookup.proportions.sex.n}%` }} className="bg-slate-400" />
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-semibold text-violet-800 mb-1.5">Distribuição por Faixa Etária</p>
                                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                {(Object.entries(voterLookup.proportions.age) as [string, number][]).map(([key, pct]) => (
                                                    <div key={key} className="flex items-center gap-1.5">
                                                        <div className="w-20 h-1.5 bg-slate-200 rounded overflow-hidden">
                                                            <div style={{ width: `${Math.min(pct, 100)}%` }} className="h-full bg-violet-500" />
                                                        </div>
                                                        <span className="text-slate-700">{TSE_AGE_LABELS[key] ?? key}: <strong>{pct.toFixed(1)}%</strong></span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-500 pt-1">
                                            Fonte: TSE — Perfil do Eleitorado. As proporções podem ser usadas como referência para cotas de campo na Etapa 4.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <label htmlFor="loc-pop-type" className="text-sm font-medium text-slate-700 block mb-1">Público-alvo</label>
                        <select
                            id="loc-pop-type"
                            value={form.population_type}
                            onChange={(e) => setForm((prev) => ({ ...prev, population_type: e.target.value as Locality['population_type'] }))}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            disabled={specificAudience}
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
                                <Tooltip text="Meta operacional da localidade (pode ser 0 para nível de agrupamento)." helpId="localities-manual-target" />
                            </label>
                            <input
                                id="loc-interviews"
                                type="number"
                                min={0}
                                value={form.interviews_required || ''}
                                onChange={(e) => setForm((prev) => ({ ...prev, interviews_required: parseInt(e.target.value, 10) || 0 }))}
                                className="w-full border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                                placeholder="Ex: 120"
                            />
                        </div>
                    )}
                </div>

                {usesSampling && form.population > 0 && marginOfError > 0 && (
                    <p className="mt-3 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-4 py-2.5">
                        📊 Estimativa: <strong className="text-blue-700">{calcInterviews(form.population, marginOfError, confidenceInterval, forceInfinitePopulation)} entrevistas</strong>
                    </p>
                )}

                {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

                <button
                    type="button"
                    onClick={handleAdd}
                    className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition"
                >
                    <Plus size={18} />
                    Adicionar nível inferior
                </button>
            </div>

            {localities.length > 0 ? (
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-slate-700">
                            {localities.length} item{localities.length > 1 ? 's' : ''} cadastrado{localities.length > 1 ? 's' : ''}
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
                                    <th className="text-left px-4 py-3 font-semibold">Nível</th>
                                    <th className="text-left px-4 py-3 font-semibold">Nome</th>
                                    <th className="text-left px-4 py-3 font-semibold">Hierarquia</th>
                                    <th className="text-left px-4 py-3 font-semibold">Zona</th>
                                    <th className="text-right px-4 py-3 font-semibold">População</th>
                                    <th className="text-right px-4 py-3 font-semibold">Entrevistas</th>
                                    <th className="text-right px-4 py-3 font-semibold">Peso</th>
                                    <th className="px-4 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {localities.map((loc) => (
                                    <tr key={loc.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 text-slate-600">{GEO_LEVEL_LABELS[loc.geo_level]}</td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{loc.name}</td>
                                        <td className="px-4 py-3 text-slate-500 text-xs">
                                            {loc.parent_state_name ? `Estado: ${loc.parent_state_name}` : '—'}
                                            {loc.parent_city_name ? ` | Cidade: ${loc.parent_city_name}` : ''}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{ZONE_LABELS[loc.zone]}</td>
                                        <td className="px-4 py-3 text-right text-slate-600">{loc.population.toLocaleString('pt-BR')}</td>
                                        <td className="px-4 py-3 text-right font-bold text-blue-700">{(loc.interviews_required ?? 0).toLocaleString('pt-BR')}</td>
                                        <td className="px-4 py-3 text-right text-slate-500 text-xs">
                                            {loc.interviews_weight !== undefined ? `${(loc.interviews_weight * 100).toFixed(1)}%` : '—'}
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
                                    <td className="px-4 py-3 font-semibold text-slate-700" colSpan={5}>Total (níveis efetivos)</td>
                                    <td className="px-4 py-3 text-right font-bold text-blue-700 text-base">{totalInterviews.toLocaleString('pt-BR')} entrevistas</td>
                                    <td className="px-4 py-3 text-right text-slate-500 text-xs">100%</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    {usesSampling && (
                        <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Users size={18} className="text-emerald-600 shrink-0" />
                                <div>
                                    <p className="text-xs text-emerald-700 font-semibold uppercase tracking-wide">Universo total pesquisado</p>
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
                                    <p className="text-xs text-blue-700 font-semibold uppercase tracking-wide">Total de entrevistas (Etapa 2)</p>
                                    <p className="text-lg font-extrabold text-blue-800">
                                        {totalInterviews.toLocaleString('pt-BR')}
                                        <span className="text-xs font-normal text-blue-600 ml-1">entrevistas</span>
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-xl">
                    <p className="text-lg mb-1">Nenhum nível territorial cadastrado</p>
                    <p className="text-sm">Defina a abrangência e adicione pelo menos um nível inferior</p>
                </div>
            )}
        </div>
    );
}
