// Passo 3: Dimensionamento Amostral
// Integra funções de cálculo de packages/shared-utils/src/sampling-utils.ts
import React, { useState } from 'react';
import { calcInterviews, getMethodologyHint } from '@political-research/shared-utils/src/sampling-utils';

interface Step3SampleSizeProps {
    initialData?: any;
    onNext: (data: any) => void;
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
        <div>
            <h2>Dimensionamento Amostral</h2>
            <label>População-alvo
                <input type="number" value={population} onChange={e => setPopulation(e.target.value)} />
            </label>
            <label>Margem de erro (%)
                <input type="number" value={margin} onChange={e => setMargin(e.target.value)} />
            </label>
            <label>Nível de confiança (%)
                <input type="number" value={confidence} onChange={e => setConfidence(e.target.value)} />
            </label>
            <button onClick={handleCalculate}>Calcular</button>
            {sampleSize !== null && (
                <div>
                    <p><strong>Tamanho da amostra sugerido:</strong> {sampleSize}</p>
                    <p>{hint}</p>
                </div>
            )}
            <button onClick={onBack}>Voltar</button>
            <button onClick={() => onNext({ population, margin, confidence, sampleSize })}>Próximo</button>
        </div>
    );
};

export default Step3SampleSize;
