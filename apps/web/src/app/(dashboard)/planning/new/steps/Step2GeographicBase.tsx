// Passo 2: Base Geográfica
// Seleção de municípios que compõem a base da pesquisa
'use client';

import React, { useState } from 'react';
import GeographicBaseSelector, { SelectedMunicipality } from '@/components/planning/GeographicBaseSelector';

interface Step2GeographicBaseProps {
    initialData?: any;
    onNext: (data: any) => void;
    onBack: () => void;
}

const Step2GeographicBase: React.FC<Step2GeographicBaseProps> = ({ initialData, onNext, onBack }) => {
    const [geoData, setGeoData] = useState({
        scope: initialData?.geographicBase?.scope || 'mixed',
        municipalities: initialData?.geographicBase?.municipalities || [] as SelectedMunicipality[],
    });

    const handleNext = () => {
        onNext({ geographicBase: geoData });
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
