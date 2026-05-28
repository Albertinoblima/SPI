// Passo 4: Distribuição e Cotas
// Define quantas entrevistas por município/localidade com base na amostra
'use client';

import React, { useState, useEffect } from 'react';

interface Step4DistributionProps {
    initialData?: any;
    onNext: (data: any) => void;
    onBack: () => void;
}

interface Quota {
    name: string;
    uf?: string;
    interviews: number;
}

const Step4Distribution: React.FC<Step4DistributionProps> = ({ initialData, onNext, onBack }) => {
    const sampleSize = initialData?.sampleSize || 0;
    const municipalities = initialData?.geographicBase?.municipalities || [];

    const [quotas, setQuotas] = useState<Quota[]>(() => {
        if (initialData?.distribution?.quotas?.length) {
            return initialData.distribution.quotas;
        }
        // Sugestão inicial proporcional simples
        if (municipalities.length > 0 && sampleSize > 0) {
            const perMunicipio = Math.round(sampleSize / municipalities.length);
            return municipalities.map((m: any) => ({
                name: m.name,
                uf: m.uf,
                interviews: perMunicipio,
            }));
        }
        return [{ name: 'Geral', interviews: sampleSize }];
    });

    const totalAssigned = quotas.reduce((sum, q) => sum + q.interviews, 0);

    const updateQuota = (index: number, value: number) => {
        const newQuotas = [...quotas];
        newQuotas[index].interviews = Math.max(0, value);
        setQuotas(newQuotas);
    };

    const handleNext = () => {
        onNext({
            distribution: {
                quotas,
                totalAssigned,
                sampleSize,
            },
        });
    };

    return (
        <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold mb-1">Distribuição e Cotas</h2>
            <p className="text-slate-400 mb-2">
                Defina quantas entrevistas serão realizadas em cada município/localidade.
            </p>
            <p className="text-sm text-emerald-400 mb-6">
                Tamanho total da amostra: <strong>{sampleSize}</strong> entrevistas
            </p>

            <div className="space-y-3 mb-6">
                {quotas.map((quota, index) => (
                    <div
                        key={index}
                        className="flex items-center gap-4 border border-slate-700 bg-slate-900/60 rounded-xl px-4 py-3"
                    >
                        <div className="flex-1">
                            <div className="font-medium">{quota.name}</div>
                            {quota.uf && <div className="text-xs text-slate-500">{quota.uf}</div>}
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={quota.interviews}
                                onChange={(e) => updateQuota(index, parseInt(e.target.value) || 0)}
                                className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-right text-sm"
                            />
                            <span className="text-sm text-slate-400">entrevistas</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mb-6 text-sm">
                <span className="text-slate-400">Total distribuído: </span>
                <span className={`font-semibold ${totalAssigned === sampleSize ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {totalAssigned}
                </span>
                <span className="text-slate-400"> / {sampleSize}</span>
                {totalAssigned !== sampleSize && (
                    <span className="ml-2 text-amber-400 text-xs">(Diferença de {Math.abs(totalAssigned - sampleSize)})</span>
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
