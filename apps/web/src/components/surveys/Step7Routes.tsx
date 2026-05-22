'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, ArrowUp, ArrowDown } from 'lucide-react';
import type { Locality } from './Step2Localities';

type Zone = 'urban' | 'rural' | 'mixed';

type RouteCard = {
    id: string;
    numero: number;
    nome: string;
    localityIds: string[];
    freeLocalityName: string;
};

type ZoneRoutes = {
    zone: Zone;
    routes: RouteCard[];
};

interface Props {
    surveyId?: string;
    localities: Locality[];
}

const ZONE_LABELS: Record<Zone, string> = {
    urban: 'Urbana',
    rural: 'Rural',
    mixed: 'Mista',
};

const FREE_LOCALITY_PREFIX = 'free::';

function normalizeFreeLocalityName(name: string) {
    return name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
}

function isFreeLocality(id: string) {
    return id.startsWith(FREE_LOCALITY_PREFIX);
}

function getFreeLocalityName(id: string) {
    return id
        .replace(FREE_LOCALITY_PREFIX, '')
        .replace(/-/g, ' ')
        .trim();
}

export function Step7Routes({ surveyId, localities }: Props) {
    const [zonesState, setZonesState] = useState<ZoneRoutes[]>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const zones = useMemo<Zone[]>(() => {
        const unique = Array.from(new Set(localities.map((l) => l.zone))) as Zone[];
        return unique.length > 0 ? unique : (['urban'] as Zone[]);
    }, [localities]);

    useEffect(() => {
        setZonesState((prev) => {
            if (prev.length > 0) return prev;
            return zones.map((zone): ZoneRoutes => ({
                zone,
                routes: [{ id: `${zone}-1`, numero: 1, nome: 'Primeira Rota', localityIds: [], freeLocalityName: '' }],
            }));
        });
    }, [zones]);

    const localityById = useMemo(() => {
        const map = new Map<string, Locality>();
        localities.forEach((locality) => map.set(locality.id, locality));
        return map;
    }, [localities]);

    const assignedIds = useMemo(() => {
        const ids = new Set<string>();
        zonesState.forEach((zone) => {
            zone.routes.forEach((route) => {
                route.localityIds.forEach((id) => {
                    if (!isFreeLocality(id)) ids.add(id);
                });
            });
        });
        return ids;
    }, [zonesState]);

    const addRoute = (zone: Zone) => {
        setZonesState((prev) =>
            prev.map((item) => {
                if (item.zone !== zone) return item;
                const nextNumber = item.routes.length + 1;
                return {
                    ...item,
                    routes: [...item.routes, { id: `${zone}-${nextNumber}-${Date.now()}`, numero: nextNumber, nome: `Rota ${nextNumber}`, localityIds: [], freeLocalityName: '' }],
                };
            }),
        );
    };

    const addFreeLocality = (zone: Zone, routeId: string) => {
        setZonesState((prev) =>
            prev.map((zoneItem) => {
                if (zoneItem.zone !== zone) return zoneItem;

                return {
                    ...zoneItem,
                    routes: zoneItem.routes.map((route) => {
                        if (route.id !== routeId) return route;

                        const normalized = normalizeFreeLocalityName(route.freeLocalityName);
                        if (!normalized) return route;

                        const encodedId = `${FREE_LOCALITY_PREFIX}${normalized}`;
                        if (route.localityIds.includes(encodedId)) {
                            return { ...route, freeLocalityName: '' };
                        }

                        return {
                            ...route,
                            localityIds: [...route.localityIds, encodedId],
                            freeLocalityName: '',
                        };
                    }),
                };
            }),
        );
    };

    const toggleLocalityInRoute = (zone: Zone, routeId: string, localityId: string) => {
        setZonesState((prev) =>
            prev.map((zoneItem) => {
                if (zoneItem.zone !== zone) return zoneItem;
                return {
                    ...zoneItem,
                    routes: zoneItem.routes.map((route) => {
                        if (route.id !== routeId) return route;
                        if (route.localityIds.includes(localityId)) {
                            return { ...route, localityIds: route.localityIds.filter((id) => id !== localityId) };
                        }
                        return { ...route, localityIds: [...route.localityIds, localityId] };
                    }),
                };
            }),
        );
    };

    const moveLocalityOrder = (zone: Zone, routeId: string, localityId: string, direction: 'up' | 'down') => {
        setZonesState((prev) =>
            prev.map((zoneItem) => {
                if (zoneItem.zone !== zone) return zoneItem;
                return {
                    ...zoneItem,
                    routes: zoneItem.routes.map((route) => {
                        if (route.id !== routeId) return route;
                        const index = route.localityIds.indexOf(localityId);
                        if (index < 0) return route;

                        const targetIndex = direction === 'up' ? index - 1 : index + 1;
                        if (targetIndex < 0 || targetIndex >= route.localityIds.length) return route;

                        const copy = [...route.localityIds];
                        [copy[index], copy[targetIndex]] = [copy[targetIndex], copy[index]];
                        return { ...route, localityIds: copy };
                    }),
                };
            }),
        );
    };

    const save = async () => {
        if (!surveyId) return;

        const hasEmptyRoute = zonesState.some((zone) => zone.routes.some((route) => route.localityIds.length === 0));
        if (hasEmptyRoute) {
            setMessage('Nenhuma rota pode ficar vazia.');
            return;
        }

        if (assignedIds.size !== localities.length) {
            setMessage('Todas as localidades cadastradas devem ser alocadas em alguma rota.');
            return;
        }

        setSaving(true);
        setMessage(null);
        try {
            const zonas = zonesState.map((zone) => ({
                zona: zone.zone,
                rotas: zone.routes.map((route, index) => ({
                    numero: route.numero || index + 1,
                    nome: route.nome,
                    localidades: route.localityIds.map((localityId, orderIndex) =>
                        isFreeLocality(localityId)
                            ? {
                                locality_id: null,
                                locality_name: getFreeLocalityName(localityId),
                                ordem: orderIndex + 1,
                            }
                            : {
                                locality_id: localityId,
                                locality_name: null,
                                ordem: orderIndex + 1,
                            },
                    ),
                })),
            }));

            const res = await fetch(`/api/surveys/${surveyId}/routes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ zonas }),
            });
            const json = await res.json();
            if (!res.ok) {
                setMessage(json.error ?? 'Falha ao salvar rotas.');
                return;
            }
            setMessage('Rotas salvas com sucesso.');
        } catch {
            setMessage('Falha de conexao ao salvar rotas.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-900">Etapa 7 — Configuracao de Rotas por Zona</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Organize as localidades dentro das rotas de cada zona e ajuste a ordem de coleta.
                </p>
            </div>

            {!surveyId && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Salve o rascunho para habilitar persistencia das rotas.
                </div>
            )}

            {zonesState.map((zoneState) => {
                const zoneLocalities = localities.filter((l) => l.zone === zoneState.zone);
                const unassigned = zoneLocalities.filter((locality) => !assignedIds.has(locality.id));

                return (
                    <section key={zoneState.zone} className="rounded-xl border border-slate-200 p-4 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-slate-800">Zona {ZONE_LABELS[zoneState.zone]}</h3>
                            <button
                                type="button"
                                onClick={() => addRoute(zoneState.zone)}
                                className="inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50"
                            >
                                <Plus size={14} />
                                Nova Rota
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {zoneState.routes.map((route) => (
                                <div key={route.id} className="rounded-lg border border-slate-200 p-3 bg-slate-50">
                                    <div className="flex gap-2 mb-3">
                                        <input
                                            type="number"
                                            value={route.numero}
                                            onChange={(event) => {
                                                const value = Math.max(1, Number(event.target.value || 1));
                                                setZonesState((prev) =>
                                                    prev.map((zone) =>
                                                        zone.zone !== zoneState.zone
                                                            ? zone
                                                            : {
                                                                ...zone,
                                                                routes: zone.routes.map((item) =>
                                                                    item.id === route.id ? { ...item, numero: value } : item,
                                                                ),
                                                            },
                                                    ),
                                                );
                                            }}
                                            className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                                            aria-label="Numero da rota"
                                        />
                                        <input
                                            type="text"
                                            value={route.nome}
                                            onChange={(event) => {
                                                const value = event.target.value;
                                                setZonesState((prev) =>
                                                    prev.map((zone) =>
                                                        zone.zone !== zoneState.zone
                                                            ? zone
                                                            : {
                                                                ...zone,
                                                                routes: zone.routes.map((item) =>
                                                                    item.id === route.id ? { ...item, nome: value } : item,
                                                                ),
                                                            },
                                                    ),
                                                );
                                            }}
                                            className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm"
                                            placeholder="Nome da rota"
                                        />
                                    </div>

                                    <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Localidades da rota</div>
                                    <div className="space-y-2">
                                        {route.localityIds.map((localityId, idx) => {
                                            const locality = localityById.get(localityId);
                                            const localityLabel = locality ? locality.name : getFreeLocalityName(localityId);
                                            if (!localityLabel) return null;
                                            return (
                                                <div key={localityId} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm">
                                                    <span className="w-5 text-slate-400">{idx + 1}</span>
                                                    <span className="flex-1 text-slate-700">{localityLabel}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveLocalityOrder(zoneState.zone, route.id, localityId, 'up')}
                                                        aria-label={`Mover ${localityLabel} para cima`}
                                                        title={`Mover ${localityLabel} para cima`}
                                                        className="p-1 text-slate-500 hover:text-slate-700"
                                                    >
                                                        <ArrowUp size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => moveLocalityOrder(zoneState.zone, route.id, localityId, 'down')}
                                                        aria-label={`Mover ${localityLabel} para baixo`}
                                                        title={`Mover ${localityLabel} para baixo`}
                                                        className="p-1 text-slate-500 hover:text-slate-700"
                                                    >
                                                        <ArrowDown size={14} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleLocalityInRoute(zoneState.zone, route.id, localityId)}
                                                        className="text-xs px-2 py-1 rounded bg-red-50 text-red-700"
                                                    >
                                                        Remover
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3 border-t border-slate-200 pt-3">
                                        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Pool nao alocado</div>
                                        <div className="flex flex-wrap gap-2">
                                            {unassigned.map((locality) => (
                                                <button
                                                    key={locality.id}
                                                    type="button"
                                                    onClick={() => toggleLocalityInRoute(zoneState.zone, route.id, locality.id)}
                                                    className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50"
                                                >
                                                    + {locality.name}
                                                </button>
                                            ))}
                                            {unassigned.length === 0 && (
                                                <span className="text-xs text-slate-400">Sem pendencias nesta zona.</span>
                                            )}
                                        </div>

                                        <div className="mt-3 flex gap-2">
                                            <input
                                                type="text"
                                                value={route.freeLocalityName}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setZonesState((prev) =>
                                                        prev.map((zone) =>
                                                            zone.zone !== zoneState.zone
                                                                ? zone
                                                                : {
                                                                    ...zone,
                                                                    routes: zone.routes.map((item) =>
                                                                        item.id === route.id
                                                                            ? { ...item, freeLocalityName: value }
                                                                            : item,
                                                                    ),
                                                                },
                                                        ),
                                                    );
                                                }}
                                                placeholder="Localidade livre (texto)"
                                                className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => addFreeLocality(zoneState.zone, route.id)}
                                                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs hover:bg-slate-50"
                                            >
                                                Adicionar livre
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                );
            })}

            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={save}
                    disabled={!surveyId || saving}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-70"
                >
                    {saving ? 'Salvando...' : 'Salvar Rotas'}
                </button>
                {message && <span className="text-sm text-slate-600">{message}</span>}
            </div>
        </div>
    );
}
