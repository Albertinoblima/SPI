// Passo 4: Distribuição e Cotas
// Define quantas entrevistas por município com sugestão automática proporcional à população
'use client';

import React, { useState, useMemo } from 'react';

interface Step4DistributionProps {
    initialData?: any;
    onNext: (data: any) => void;
    onBack: () => void;
}

interface Quota {
    name: string;
    uf?: string;
    population: number;
    interviews: number;
    locked?: boolean;   // Novo: permite travar a cota
}

const Step4Distribution: React.FC<Step4DistributionProps> = ({ initialData, onNext, onBack }) => {
    const sampleSize: number = initialData?.sampleSize || 0;
    const municipalities = initialData?.geographicBase?.municipalities || [];

    // Converte municípios selecionados em quotas iniciais
    const initialQuotas: Quota[] = useMemo(() => {
        if (initialData?.distribution?.quotas?.length) {
            return initialData.distribution.quotas;
        }

        if (municipalities.length > 0) {
            const totalPop = municipalities.reduce((sum: number, m: any) => sum + (m.population || 0), 0);

            return municipalities.map((m: any) => {
                const pop = m.population || 0;
                const suggested = totalPop > 0 
                    ? Math.round((pop / totalPop) * sampleSize) 
                    : Math.round(sampleSize / municipalities.length);

                return {
                    name: m.name,
                    uf: m.uf,
                    population: pop,
                    interviews: suggested,
                    locked: false,
                };
            });
        }

        return [{ name: 'Geral', population: 0, interviews: sampleSize, locked: false }];
    }, [municipalities, sampleSize, initialData?.distribution?.quotas]);

    const [quotas, setQuotas] = useState<Quota[]>(initialQuotas);

    const totalAssigned = useMemo(() => 
        quotas.reduce((sum, q) => sum + q.interviews, 0), 
    [quotas]);

    const totalPopulation = useMemo(() =>
        quotas.reduce((sum, q) => sum + (q.population || 0), 0),
    [quotas]);

    // Recebe metadados da base geográfica (vindo do Passo 2)
    const geoMetadata = initialData?.geographicBase?.metadata || {};

    const updateQuota = (index: number, value: number) => {
        if (quotas[index].locked) return; // Não permite editar cotas travadas

        const newQuotas = [...quotas];
        newQuotas[index] = { ...newQuotas[index], interviews: Math.max(0, Math.floor(value)) };
        setQuotas(newQuotas);
    };

    const toggleLock = (index: number) => {
        const newQuotas = [...quotas];
        newQuotas[index] = { 
            ...newQuotas[index], 
            locked: !newQuotas[index].locked 
        };
        setQuotas(newQuotas);
    };

    // Sugere distribuição proporcional à população (respeitando cotas travadas)
    const suggestProportionalDistribution = () => {
        const unlockedQuotas = quotas.filter(q => !q.locked);
        const lockedTotal = quotas
            .filter(q => q.locked)
            .reduce((sum, q) => sum + q.interviews, 0);

        const remainingSample = Math.max(0, sampleSize - lockedTotal);

        if (unlockedQuotas.length === 0) {
            // Tudo travado, não faz nada
            return;
        }

        const unlockedTotalPop = unlockedQuotas.reduce((sum, q) => sum + (q.population || 0), 0);

        if (unlockedTotalPop === 0 || remainingSample === 0) {
            // Distribui igualmente entre as não travadas
            const even = Math.floor(remainingSample / unlockedQuotas.length);
            let remainder = remainingSample % unlockedQuotas.length;

            const newQuotas = quotas.map(q => {
                if (q.locked) return q;

                const idx = unlockedQuotas.findIndex(uq => uq.name === q.name);
                return {
                    ...q,
                    interviews: even + (idx < remainder ? 1 : 0),
                };
            });

            setQuotas(newQuotas);
            return;
        }

        // Distribuição proporcional apenas entre as não travadas
        const newQuotas = quotas.map(q => {
            if (q.locked) return q;

            const proportion = (q.population || 0) / unlockedTotalPop;
            return {
                ...q,
                interviews: Math.round(proportion * remainingSample),
            };
        });

        // Ajuste fino para bater o total
        let currentTotal = newQuotas.reduce((s, q) => s + q.interviews, 0);
        let diff = sampleSize - currentTotal;

        let i = 0;
        while (diff !== 0 && newQuotas.length > 0) {
            const unlockedIndices = newQuotas
                .map((q, idx) => ({ q, idx }))
                .filter(item => !item.q.locked);

            if (unlockedIndices.length === 0) break;

            const target = unlockedIndices[i % unlockedIndices.length];
            const idx = target.idx;

            if (diff > 0) {
                newQuotas[idx].interviews += 1;
                diff--;
            } else {
                if (newQuotas[idx].interviews > 0) {
                    newQuotas[idx].interviews -= 1;
                    diff++;
                }
            }
            i++;
            if (i > 200) break;
        }

        setQuotas(newQuotas);
    };

    const handleNext = () => {
        onNext({
            distribution: {
                quotas,
                totalAssigned,
                sampleSize,
                totalPopulation,
            },
        });
    };

    const difference = totalAssigned - sampleSize;

    return (
        <div className="max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-2xl font-semibold">Distribuição e Cotas</h2>
                    <p className="text-sm text-slate-400">Baseie a distribuição na população dos municípios selecionados.</p>
                </div>
                <button
                    onClick={suggestProportionalDistribution}
                    disabled={totalPopulation === 0}
                    className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg font-medium transition-colors whitespace-nowrap"
                >
                    Sugerir proporcional à população
                </button>
            </div>

            <p className="text-slate-400 mb-1">
                Defina quantas entrevistas em cada município da base geográfica.
            </p>
            <p className="text-sm mb-6">
                Tamanho da amostra: <strong className="text-white">{sampleSize}</strong> entrevistas
                {totalPopulation > 0 && (
                    <> • População total da base: <strong>{totalPopulation.toLocaleString('pt-BR')}</strong></>
                )}
            </p>

            <div className="space-y-3 mb-6">
                {quotas.map((quota, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-4 border border-slate-700 bg-slate-900/60 rounded-xl px-4 py-3"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{quota.name}</div>
                            {quota.uf && <div className="text-xs text-slate-500">{quota.uf}</div>}
                            {quota.population > 0 && (
                                <div className="text-xs text-slate-400 mt-0.5">
                                    População: {quota.population.toLocaleString('pt-BR')}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={quota.interviews}
                                onChange={(e) => updateQuota(index, parseInt(e.target.value) || 0)}
                                disabled={quota.locked}
                                className={`w-24 bg-slate-950 border rounded-lg px-3 py-1.5 text-right text-sm focus:outline-none focus:border-blue-500 ${
                                    quota.locked ? 'border-slate-600 text-slate-400' : 'border-slate-700'
                                }`}
                            />
                            <span className="text-sm text-slate-400 w-20">entrevistas</span>

                            {/* Botão de travar/destravar */}
                            <button
                                type="button"
                                onClick={() => toggleLock(index)}
                                className={`p-1.5 rounded transition-colors ${
                                    quota.locked 
                                        ? 'bg-amber-600 text-white hover:bg-amber-500' 
                                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                                title={quota.locked ? "Destravar cota" : "Travar cota (não será alterada na sugestão)"}
                            >
                                {quota.locked ? '🔒' : '🔓'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mb-6 p-3 rounded-lg bg-slate-900 border border-slate-700 text-sm">
                <span className="text-slate-400">Total distribuído: </span>
                <span className={`font-semibold text-lg ${difference === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {totalAssigned}
                </span>
                <span className="text-slate-400"> / {sampleSize}</span>

                {difference !== 0 && (
                    <span className="ml-3 text-amber-400">
                        ({difference > 0 ? '+' : ''}{difference} entrevistas)
                    </span>
                )}

                {quotas.some(q => q.locked) && (
                    <span className="ml-4 text-xs text-amber-400">
                        • Algumas cotas estão travadas
                    </span>
                )}
            </div>

            <div className="flex justify-between">
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-800 transition-colors"
                >
                    Voltar
                </button>
                <button
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    Próximo passo
                </button>
            </div>
        </div>
    );
};

export default Step4Distribution;
