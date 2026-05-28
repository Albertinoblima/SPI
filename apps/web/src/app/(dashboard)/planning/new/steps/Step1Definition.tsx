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
        if (!name.trim()) return;
        onNext({ name: name.trim(), objective, researchType, targetAudience });
    };

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold mb-1">Definição Inicial</h2>
            <p className="text-slate-400 mb-6">Preencha as informações básicas do seu planejamento.</p>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium mb-1.5">Nome do Planejamento *</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none"
                        placeholder="Ex: Pesquisa Eleitoral 2026 - Capital"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-1.5">Objetivo da Pesquisa *</label>
                    <textarea
                        value={objective}
                        onChange={(e) => setObjective(e.target.value)}
                        required
                        rows={3}
                        className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none resize-y"
                        placeholder="Descreva o principal objetivo deste planejamento..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Tipo de Pesquisa *</label>
                        <select
                            value={researchType}
                            onChange={(e) => setResearchType(e.target.value)}
                            required
                            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none"
                        >
                            <option value="">Selecione o tipo...</option>
                            <option value="eleitoral">Eleitoral</option>
                            <option value="opiniao_publica">Opinião Pública</option>
                            <option value="satisfacao">Satisfação</option>
                            <option value="avaliacao_servicos">Avaliação de Serviços</option>
                            <option value="mercado_quantitativa">Pesquisa de Mercado</option>
                            <option value="publico_alvo">Público-alvo / Segmentação</option>
                            <option value="censo">Censo</option>
                            <option value="qualitativa_grupo_focal">Qualitativa - Grupo Focal</option>
                            <option value="qualitativa_profundidade">Qualitativa - Entrevista em Profundidade</option>
                            <option value="outros">Outros</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Público-alvo *</label>
                        <input
                            value={targetAudience}
                            onChange={(e) => setTargetAudience(e.target.value)}
                            required
                            className="w-full bg-slate-900 border border-slate-700 focus:border-blue-500 rounded-lg px-4 py-2.5 text-sm outline-none"
                            placeholder="Ex: Eleitores de 18 a 35 anos..."
                        />
                    </div>
                </div>

                <div className="pt-4 flex justify-end">
                    <button
                        type="submit"
                        className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                    >
                        Próximo passo
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Step1Definition;
