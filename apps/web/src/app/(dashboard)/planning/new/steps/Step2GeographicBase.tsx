// Passo 2: Base Geográfica
// Seleção de municípios que compõem a base da pesquisa
'use client';

import React, { useState } from 'react';
import GeographicBaseSelector from '@/components/planning/GeographicBaseSelector';
import type { GeographicBaseSelection } from '@/components/planning/types';
import type { GeoScope } from '@/lib/survey-decisions';

interface Step2GeographicBaseProps {
    initialData?: any;
    onNext: (data: any) => void;
    onBack: () => void;
}

const Step2GeographicBase: React.FC<Step2GeographicBaseProps> = ({ initialData, onNext, onBack }) => {
    const [geoData, setGeoData] = useState<GeographicBaseSelection>({
        scope: (initialData?.geographicBase?.scope as GeoScope) || 'mixed',
        municipalities: initialData?.geographicBase?.municipalities || [],
        localities: initialData?.geographicBase?.localities || [],
    });

    const handleNext = () => {
        const totalPopulation = geoData.municipalities.reduce((sum, m) => sum + (m.population || 0), 0);

        onNext({ 
            geographicBase: {
                scope: geoData.scope,
                municipalities: geoData.municipalities,
                localities: geoData.localities,
                metadata: {
                    research_type: initialData?.researchType,
                    total_population: totalPopulation,
                    // Preparado para quando integrarmos dados de eleitorado (TSE)
                    estimated_electorate: null, 
                }
            }
        });
    };

    return (
        <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold mb-1">Base Geográfica</h2>
            <p className="text-slate-400 mb-6">
                Defina a abrangência geográfica e selecione os municípios que farão parte da base da pesquisa.
            </p>

            <div className="mb-6">
                <GeographicBaseSelector
                    value={geoData}
                    onChange={setGeoData}
                    researchType={initialData?.researchType}
                />
            </div>

            {geoData.municipalities.length > 0 && (
                <div className="mb-6 p-4 bg-slate-900 border border-slate-600 rounded-2xl text-sm">
                    <div className="font-semibold text-white mb-2">Resumo da Base Geográfica</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="text-slate-400">Municípios:</div>
                        <div className="font-medium text-right text-white">{geoData.municipalities.length}</div>
                        
                        <div className="text-slate-400">População total:</div>
                        <div className="font-semibold text-right text-emerald-400">
                            {geoData.municipalities.reduce((sum, m) => sum + (m.population || 0), 0).toLocaleString('pt-BR')}
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                        Esta base será usada para sugerir a distribuição de entrevistas no próximo passo.
                    </div>
                </div>
            )}

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

export default Step2GeographicBase;
