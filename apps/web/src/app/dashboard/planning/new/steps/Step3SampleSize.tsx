// Passo 3: Dimensionamento Amostral
// Integra funções de cálculo de packages/shared-utils/src/sampling-utils.ts
import React, { useState } from 'react';
import { calcInterviews, getMethodologyHint } from '@political-research/shared-utils/src/sampling-utils';

interface Step3SampleSizeProps {
    initialData?: Record<string, any>;
    onNext: (data: Record<string, any>) => void;
    onBack: () => void;
}

const Step3SampleSize: React.FC<Step3SampleSizeProps> = ({ initialData, onNext, onBack }) => {
    const [population, setPopulation] = useState(initialData?.population || '');
    const [margin, setMargin] = useState(initialData?.margin || '5');
    const [confidence, setConfidence] = useState(initialData?.confidence || '95');
    const [sampleSize, setSampleSize] = useState<number | null>(null);
    const [hint, setHint] = useState('');

    const handleCalculate = () => {
        const pop = Number(population);
        const mar = Number(margin);
        const conf = Number(confidence);
        if (!isNaN(pop) && !isNaN(mar) && !isNaN(conf)) {
            const result = calcInterviews(pop, mar, conf);
            setSampleSize(result);
            setHint(getMethodologyHint(initialData?.researchType || ''));
        }
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold mb-1">Dimensionamento Amostral</h2>
            <p className="text-slate-400 mb-6">
                Calcule o tamanho da amostra com base na população-alvo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                <div>
                    <label className="block text-sm font-medium mb-1.5">População-alvo *</label>
                    <input
                        type="number"
                        value={population}
                        onChange={(e) => setPopulation(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none"
                        placeholder="Ex: 1500000"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1.5">Margem de erro (%)</label>
                    <input
                        type="number"
                        value={margin}
                        onChange={(e) => setMargin(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1.5">Nível de confiança (%)</label>
                    <input
                        type="number"
                        value={confidence}
                        onChange={(e) => setConfidence(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none"
                    />
                </div>
            </div>

            <div className="mb-6">
                <button
                    onClick={handleCalculate}
                    className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium transition-colors"
                >
                    Calcular Tamanho da Amostra
                </button>
            </div>

            {sampleSize !== null && (
                <div className="mb-6 p-4 bg-slate-900 border border-slate-700 rounded-xl">
                    <p className="text-lg">
                        <strong>Tamanho da amostra sugerido:</strong>{' '}
                        <span className="text-emerald-400 font-semibold text-xl">{sampleSize}</span>
                    </p>
                    {hint && <p className="text-sm text-slate-400 mt-2">{hint}</p>}
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
                    onClick={() => onNext({ population, margin, confidence, sampleSize })}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    Próximo passo
                </button>
            </div>
        </div>
    );
};

export default Step3SampleSize;
