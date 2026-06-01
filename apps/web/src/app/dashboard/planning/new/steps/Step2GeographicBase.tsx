// Passo 2: Base Geográfica
// Seleção de municípios que compõem a base da pesquisa
'use client';

import React, { useState } from 'react';
import GeographicBaseSelector from '@/components/planning/GeographicBaseSelector';
import type { GeographicBaseSelection } from '@/components/planning/types';
import type { GeoScope } from '@/lib/survey-decisions';

interface Step2GeographicBaseProps {
    initialData?: {
        geographicBase?: Partial<GeographicBaseSelection>;
        researchType?: string;
    };
    onNext: (data: { geographicBase: any }) => void; // rich structure for downstream
    onBack: () => void;
}

const Step2GeographicBase: React.FC<Step2GeographicBaseProps> = ({ initialData, onNext, onBack }) => {
    const [geoData, setGeoData] = useState<GeographicBaseSelection>({
        scope: (initialData?.geographicBase?.scope as GeoScope) || 'mixed',
        municipalities: initialData?.geographicBase?.municipalities || [],
        localities: initialData?.geographicBase?.localities || [],
    });

    const handleNext = () => {
        const totalPopulation = geoData.municipalities.reduce((sum, m) => sum + (m.population || 0), 0) +
            (geoData.localities || []).reduce((sum, l) => sum + (l.population || 0), 0);

        // Build a clean, rich structure for downstream steps (especially Step 4)
        const richBase = {
            scope: geoData.scope,
            municipalities: geoData.municipalities.map(m => ({
                ...m,
                // Ensure localities are properly attached if any
                localities: m.localities || [],
            })),
            // Flat list of all selected localities (most granular level)
            selectedLocalities: (geoData.localities && geoData.localities.length > 0)
                ? geoData.localities
                : geoData.municipalities.flatMap(m => m.localities || []),
            metadata: {
                research_type: initialData?.researchType,
                total_population: totalPopulation,
                has_specific_localities: (geoData.localities && geoData.localities.length > 0) ||
                    geoData.municipalities.some(m => m.localities && m.localities.length > 0),
            }
        };

        onNext({ geographicBase: richBase });
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
                    {...(initialData?.researchType ? { researchType: initialData.researchType } : {})}
                />
            </div>

            {geoData.municipalities.length > 0 && (
                <div className="mb-6 p-4 bg-slate-900 border border-slate-600 rounded-2xl text-sm">
                    <div className="font-semibold text-white mb-2 flex items-center justify-between">
                        <span>Resumo da Base Geográfica</span>
                        {(() => {
                            const locCount = geoData.municipalities.reduce((s, m) => s + (m.localities?.length || 0), 0);
                            return locCount > 0 ? (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700/40">
                                    {locCount} localidades específicas
                                </span>
                            ) : null;
                        })()}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm">
                        <div className="flex justify-between">
                            <span className="text-slate-400">Municípios:</span>
                            <span className="font-medium text-white">{geoData.municipalities.length}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">População:</span>
                            <span className="font-semibold text-emerald-400">
                                {geoData.municipalities.reduce((sum, m) => sum + (m.population || 0), 0).toLocaleString('pt-BR')}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Granularidade:</span>
                            <span className="font-medium text-amber-300">
                                {geoData.municipalities.some(m => m.localities && m.localities.length > 0) ? 'Localidades' : 'Municipal'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-400">Áreas para cotas:</span>
                            <span className="font-medium text-white">
                                {geoData.municipalities.reduce((s, m) => s + (m.localities?.length || 1), 0)}
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                        A distribuição proporcional no Passo 4 respeitará automaticamente as localidades específicas quando definidas.
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center">
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-800 transition-colors"
                >
                    Voltar
                </button>

                <div className="flex items-center gap-3">
                    {geoData.municipalities.length === 0 && (
                        <span className="text-xs text-amber-400">
                            Recomendamos selecionar pelo menos alguns municípios para uma base mais representativa.
                        </span>
                    )}
                    <button
                        onClick={handleNext}
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                    >
                        Próximo passo
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Step2GeographicBase;
