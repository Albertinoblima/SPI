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
                <div className="mb-6 p-3 bg-slate-900 border border-slate-700 rounded-xl text-sm text-slate-300">
                    <strong>Base selecionada:</strong> {geoData.municipalities.length} município(s) • 
                    População aproximada: {
                        geoData.municipalities
                            .reduce((sum, m) => sum + (m.population || 0), 0)
                            .toLocaleString('pt-BR')
                    } habitantes
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
