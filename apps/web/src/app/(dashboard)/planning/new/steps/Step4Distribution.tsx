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
                };
            });
        }

        return [{ name: 'Geral', population: 0, interviews: sampleSize }];
    }, [municipalities, sampleSize, initialData?.distribution?.quotas]);

    const [quotas, setQuotas] = useState<Quota[]>(initialQuotas);

    const totalAssigned = useMemo(() => 
        quotas.reduce((sum, q) => sum + q.interviews, 0), 
    [quotas]);

    const totalPopulation = useMemo(() =>
        quotas.reduce((sum, q) => sum + (q.population || 0), 0),
    [quotas]);

    const updateQuota = (index: number, value: number) => {
        const newQuotas = [...quotas];
        newQuotas[index] = { ...newQuotas[index], interviews: Math.max(0, Math.floor(value)) };
        setQuotas(newQuotas);
    };

    // Sugere distribuição proporcional à população
    const suggestProportionalDistribution = () => {
        if (totalPopulation === 0 || sampleSize === 0 || quotas.length === 0) {
            // Fallback: distribute evenly
            const even = Math.floor(sampleSize / quotas.length);
            let remainder = sampleSize % quotas.length;

            const newQuotas = quotas.map((q, idx) => ({
                ...q,
                interviews: even + (idx < remainder ? 1 : 0),
            }));
            setQuotas(newQuotas);
            return;
        }

        const newQuotas = quotas.map(q => {
            const proportion = q.population / totalPopulation;
            return {
                ...q,
                interviews: Math.round(proportion * sampleSize),
            };
        });

        // Ajuste para bater exatamente com o sampleSize
        let currentTotal = newQuotas.reduce((s, q) => s + q.interviews, 0);
        let diff = sampleSize - currentTotal;

        // Distribute the difference
        let i = 0;
        while (diff !== 0 && newQuotas.length > 0) {
            const idx = i % newQuotas.length;
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
            if (i > 100) break; // safety
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
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-2xl font-semibold">Distribuição e Cotas</h2>
                <button
                    onClick={suggestProportionalDistribution}
                    disabled={totalPopulation === 0}
                    className="text-sm px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg transition-colors"
                >
                    Sugerir distribuição proporcional à população
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
                                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-right text-sm focus:outline-none focus:border-blue-500"
                            />
                            <span className="text-sm text-slate-400 w-20">entrevistas</span>
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
