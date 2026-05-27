// Passo 1: Definição Inicial do Planejamento
// Formulário para nome, objetivo, tipo de pesquisa e público-alvo
import React, { useState } from 'react';

interface Step1DefinitionProps {
    initialData?: any;
    onNext: (data: any) => void;
}

const Step1Definition: React.FC<Step1DefinitionProps> = ({ initialData, onNext }) => {
    const [name, setName] = useState(initialData?.name || '');
    const [objective, setObjective] = useState(initialData?.objective || '');
    const [researchType, setResearchType] = useState(initialData?.researchType || '');
    const [targetAudience, setTargetAudience] = useState(initialData?.targetAudience || '');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onNext({ name, objective, researchType, targetAudience });
    };

    return (
        <form onSubmit={handleSubmit}>
            <h2>Definição Inicial</h2>
            <label>Nome do planejamento
                <input value={name} onChange={e => setName(e.target.value)} required />
            </label>
            <label>Objetivo
                <input value={objective} onChange={e => setObjective(e.target.value)} required />
            </label>
            <label>Tipo de pesquisa
                <input value={researchType} onChange={e => setResearchType(e.target.value)} required />
            </label>
            <label>Público-alvo
                <input value={targetAudience} onChange={e => setTargetAudience(e.target.value)} required />
            </label>
            <button type="submit">Próximo</button>
        </form>
    );
};

export default Step1Definition;
