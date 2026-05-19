'use client';

import { useState } from 'react';
import { Plus, Trash2, GripVertical, HelpCircle, X, Loader2, Zap } from 'lucide-react';
import Link from 'next/link';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';
import type { Locality } from './Step2Localities';

export interface PremiseOption {
    label: string;
    value: string;
    quota_pct?: number;
}

export interface Premise {
    id: string;
    category: string;
    label: string;
    options: PremiseOption[];
    is_required: boolean;
    allow_multiple: boolean;
    order_index: number;
}

interface Props {
    premises: Premise[];
    onChange: (premises: Premise[]) => void;
    localities?: Locality[];
}

function Tooltip({ text, helpId }: { text: string; helpId?: string }) {
    const topic = helpId ? HELP_TOPICS_BY_ID[helpId] : undefined;
    const href = topic ? `/help?q=${encodeURIComponent(topic.title)}#${topic.id}` : '/help';

    const handleMouseEnter = () => {
        if (typeof window === 'undefined') return;
        window.dispatchEvent(new CustomEvent(HELP_HOVER_EVENT, {
            detail: {
                id: topic?.id,
                title: topic?.title ?? 'Ajuda rapida',
                text: topic?.short ?? text,
                href,
            },
        }));
    };

    return (
        <span className="relative group inline-flex items-center ml-1.5" onMouseEnter={handleMouseEnter}>
            <HelpCircle size={15} className="text-slate-400 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                <span>{text}</span>
                <span className="mt-2 block">
                    <Link href={href} className="text-blue-200 underline underline-offset-2 hover:text-white">
                        Saber mais...
                    </Link>
                </span>
            </span>
        </span>
    );
}

const PRESET_CATEGORIES: Array<{
    label: string;
    category: string;
    allow_multiple: boolean;
    options: PremiseOption[];
}> = [
        {
            label: 'Sexo', category: 'sexo', allow_multiple: false,
            options: [
                { label: 'Masculino', value: 'M', quota_pct: 50 },
                { label: 'Feminino', value: 'F', quota_pct: 50 },
            ],
        },
        {
            label: 'Faixa etária', category: 'faixa_etaria', allow_multiple: false,
            options: [
                { label: '16 a 24 anos', value: '16-24' },
                { label: '25 a 34 anos', value: '25-34' },
                { label: '35 a 44 anos', value: '35-44' },
                { label: '45 a 59 anos', value: '45-59' },
                { label: '60 anos ou mais', value: '60+' },
            ],
        },
        {
            label: 'Escolaridade', category: 'escolaridade', allow_multiple: false,
            options: [
                { label: 'Sem instrução', value: 'sem_instrucao' },
                { label: 'Fundamental incompleto', value: 'fund_inc' },
                { label: 'Fundamental completo', value: 'fund_comp' },
                { label: 'Médio incompleto', value: 'medio_inc' },
                { label: 'Médio completo', value: 'medio_comp' },
                { label: 'Superior ou mais', value: 'superior' },
            ],
        },
        {
            label: 'Renda familiar', category: 'renda', allow_multiple: false,
            options: [
                { label: 'Até 1 salário mínimo', value: 'ate_1sm' },
                { label: '1 a 2 salários mínimos', value: '1_2sm' },
                { label: '2 a 5 salários mínimos', value: '2_5sm' },
                { label: 'Mais de 5 salários mínimos', value: 'mais_5sm' },
            ],
        },
        {
            label: 'Zona de residência', category: 'zona', allow_multiple: false,
            options: [
                { label: 'Urbana', value: 'urban' },
                { label: 'Rural', value: 'rural' },
            ],
        },
        {
            label: 'Bairro / Região', category: 'bairro', allow_multiple: false,
            options: [],
        },
        {
            label: 'Estado Civil', category: 'estado_civil', allow_multiple: false,
            options: [
                { label: 'Solteiro(a)', value: 'solteiro' },
                { label: 'Casado(a)', value: 'casado' },
                { label: 'Divorciado(a)', value: 'divorciado' },
                { label: 'Viúvo(a)', value: 'viuvo' },
                { label: 'União estável', value: 'uniao_estavel' },
            ],
        },
        {
            label: 'Religião', category: 'religiao', allow_multiple: false,
            options: [
                { label: 'Católica', value: 'catolica' },
                { label: 'Evangélica', value: 'evangelica' },
                { label: 'Espírita', value: 'espirita' },
                { label: 'Umbanda / Candomblé', value: 'umbanda_candomble' },
                { label: 'Sem religião', value: 'sem_religiao' },
                { label: 'Outra', value: 'outra' },
            ],
        },
        {
            label: 'Profissão', category: 'profissao', allow_multiple: false,
            options: [
                { label: 'Comerciante', value: 'comerciante' },
                { label: 'Comerciário', value: 'comerciario' },
                { label: 'Industriário', value: 'industriario' },
                { label: 'Funcionário Público', value: 'funcionario_publico' },
                { label: 'Prestador de Serviços', value: 'prestador_servicos' },
                { label: 'Professor(a)', value: 'professor' },
                { label: 'Profissional Liberal', value: 'profissional_liberal' },
                { label: 'Dona de Casa', value: 'dona_de_casa' },
                { label: 'Sindicalista', value: 'sindicalista' },
                { label: 'Outra', value: 'outra' },
            ],
        },
        {
            label: 'Interesse', category: 'interesse', allow_multiple: true,
            options: [
                { label: 'Atividades Sociais', value: 'atividades_sociais' },
                { label: 'Cultura', value: 'cultura' },
                { label: 'Lazer e Entretenimento', value: 'lazer_entretenimento' },
                { label: 'Conhecimento e Desenvolvimento Tecnológico', value: 'conhecimento_tecnologico' },
                { label: 'Economia', value: 'economia' },
                { label: 'Política', value: 'politica' },
                { label: 'Religião', value: 'religiao' },
            ],
        },
    ];

function PremiseCard({ premise, onRemove, onUpdate }: {
    premise: Premise;
    onRemove: () => void;
    onUpdate: (updates: Partial<Premise>) => void;
}) {
    const [newOption, setNewOption] = useState('');

    const addOption = () => {
        if (!newOption.trim()) return;
        const opt: PremiseOption = { label: newOption.trim(), value: newOption.trim().toLowerCase().replace(/\s+/g, '_') };
        onUpdate({ options: [...premise.options, opt] });
        setNewOption('');
    };

    const removeOption = (idx: number) =>
        onUpdate({ options: premise.options.filter((_, i) => i !== idx) });

    const updateOptionLabel = (idx: number, label: string) => {
        const opts = [...premise.options];
        opts[idx] = { ...opts[idx], label };
        onUpdate({ options: opts });
    };

    const updateOptionQuota = (idx: number, quota_pct: number) => {
        const opts = [...premise.options];
        opts[idx] = { ...opts[idx], quota_pct };
        onUpdate({ options: opts });
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-start gap-3 mb-4">
                <div className="mt-1 text-slate-300 cursor-move">
                    <GripVertical size={18} />
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                            Rótulo da premissa
                            <Tooltip text="Nome que aparecerá no questionário e nos relatórios." helpId="premises-label" />
                        </label>
                        <input
                            type="text"
                            value={premise.label}
                            onChange={e => onUpdate({ label: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                            aria-label="Rótulo da premissa"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-1">
                            Categoria (chave interna)
                            <Tooltip text="Identificador tecnico da premissa usado para integracoes e analises." helpId="premises-category-key" />
                        </label>
                        <input
                            type="text"
                            value={premise.category}
                            onChange={e => onUpdate({ category: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 font-mono"
                            placeholder="ex: faixa_etaria"
                        />
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-red-400 hover:text-red-600 mt-1 transition"
                    aria-label="Remover premissa"
                >
                    <Trash2 size={18} />
                </button>
            </div>

            {/* Opções */}
            <div className="ml-7">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Opções de resposta
                        <Tooltip text="Cada opção define um segmento do público-alvo. A cota % é opcional e indica a proporção esperada." helpId="premises-options-quotas" />
                    </span>
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={premise.allow_multiple}
                            onChange={e => onUpdate({ allow_multiple: e.target.checked })}
                            className="accent-blue-600"
                        />
                        Múltipla seleção
                        <Tooltip text="Ative somente quando a regra da premissa permitir resposta em mais de uma opcao." helpId="premises-multi-select" />
                    </label>
                </div>

                <div className="space-y-2 mb-3">
                    {premise.options.map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                            <span className="text-slate-400 text-sm w-4">
                                {premise.allow_multiple ? '☐' : '○'}
                            </span>
                            <input
                                type="text"
                                value={opt.label}
                                onChange={e => updateOptionLabel(idx, e.target.value)}
                                className="flex-1 border border-slate-200 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400"
                                placeholder="Rótulo da opção"
                            />
                            <div className="flex items-center gap-1 shrink-0">
                                <input
                                    type="number"
                                    value={opt.quota_pct ?? ''}
                                    onChange={e => updateOptionQuota(idx, parseFloat(e.target.value) || 0)}
                                    className="w-16 border border-slate-200 rounded px-2 py-1.5 text-sm text-right focus:ring-1 focus:ring-blue-400"
                                    placeholder="Cota"
                                    min={0}
                                    max={100}
                                />
                                <span className="text-xs text-slate-400">%</span>
                                <button
                                    type="button"
                                    onClick={() => removeOption(idx)}
                                    className="text-red-300 hover:text-red-500 transition ml-1"
                                    aria-label="Remover opção"
                                >
                                    <X size={15} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Adicionar opção */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newOption}
                        onChange={e => setNewOption(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addOption()}
                        className="flex-1 border border-dashed border-slate-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-blue-400 text-slate-600"
                        placeholder="+ Nova opção (Enter para confirmar)"
                    />
                    <button
                        type="button"
                        onClick={addOption}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-sm font-medium transition"
                    >
                        Adicionar
                    </button>
                </div>
            </div>
        </div>
    );
}

export function Step3Premises({ premises, onChange, localities = [] }: Props) {
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);
    const [suggestionApplied, setSuggestionApplied] = useState(false);

    const applySuggestedQuotas = async () => {
        if (localities.length === 0) {
            setSuggestionError('Nenhuma localidade selecionada. Retorne à Etapa 2 para selecionar localidades.');
            return;
        }

        setLoadingSuggestions(true);
        setSuggestionError(null);
        setSuggestionApplied(false);

        try {
            const response = await fetch('/api/surveys/stratification-suggestions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ localities }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erro ao gerar sugestões');
            }

            const { suggestions } = await response.json();

            if (!suggestions || suggestions.length === 0) {
                setSuggestionError('Nenhuma sugestão disponível. Verifique se os dados demográficos foram carregados.');
                return;
            }

            const updatedPremises = premises.map((premise) => {
                const suggestion = suggestions.find((s: { category: string }) => s.category === premise.category);
                if (!suggestion) return premise;

                const updatedOptions = premise.options.map((opt) => {
                    const suggestedOption = suggestion.suggestions.find((s: { value: string }) => s.value === opt.value);
                    return suggestedOption ? { ...opt, quota_pct: suggestedOption.quota_pct } : { ...opt, quota_pct: undefined };
                });

                return { ...premise, options: updatedOptions };
            });

            onChange(updatedPremises);
            setSuggestionApplied(true);
            setTimeout(() => setSuggestionApplied(false), 5000);
        } catch (error) {
            setSuggestionError(error instanceof Error ? error.message : 'Erro ao buscar sugestões.');
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const addPreset = (preset: typeof PRESET_CATEGORIES[0]) => {
        if (premises.some(p => p.category === preset.category)) return;
        const newPremise: Premise = {
            id: `prem_${Date.now()}`,
            category: preset.category,
            label: preset.label,
            options: [...preset.options],
            is_required: true,
            allow_multiple: preset.allow_multiple,
            order_index: premises.length,
        };
        onChange([...premises, newPremise]);
    };

    const addCustom = () => {
        const newPremise: Premise = {
            id: `prem_${Date.now()}`,
            category: 'nova_premissa',
            label: 'Nova premissa',
            options: [],
            is_required: true,
            allow_multiple: false,
            order_index: premises.length,
        };
        onChange([...premises, newPremise]);
    };

    const removePremise = (id: string) =>
        onChange(premises.filter(p => p.id !== id).map((p, i) => ({ ...p, order_index: i })));

    const updatePremise = (id: string, updates: Partial<Premise>) =>
        onChange(premises.map(p => p.id === id ? { ...p, ...updates } : p));

    const existingCategories = new Set(premises.map(p => p.category));

    const ESTRATIFICACAO_ALTERNATIVAS = [
        'Aspecto Sócio Econômico da Amostra',
        'Aspecto Sócio Econômico',
        'Perfil do Entrevistado',
        'Base Estrutural da Amostra',
        'Base Sócio Econômica da Amostra',
        'Característica dos Entrevistados',
        'Característica do Perfil da Amostra',
        'Característica do Perfil dos Entrevistados',
        'Estratificação do Perfil Amostral',
        'Estrutura Sócio Econômica da Amostra',
        'Perfil dos Entrevistados',
        'Perfil Estratificado da Amostra',
    ];

    return (
    <div>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 4 — Estratificação da Amostra</h2>
        <p className="text-sm text-slate-500 mb-4">
            Defina o perfil do entrevistado e as cotas esperadas. A estratificação garante que a amostra represente
            adequadamente os diferentes segmentos da população pesquisada.
            <span className="inline-flex ml-1 align-middle">
                <Tooltip text="Use a estratificação para controlar a composição da coleta e manter aderência ao desenho metodológico." helpId="premises-overview" />
            </span>
        </p>

        {/* Seletor de nomenclatura da estratificação */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <label className="text-sm font-semibold text-blue-900 block mb-2">
                Denominação da Estratificação da Amostra
                <Tooltip text="Selecione o nome técnico que será utilizado para identificar este bloco nos relatórios e documentos da pesquisa." helpId="premises-overview" />
            </label>
            <select
                className="w-full border border-blue-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 bg-white text-slate-700 text-sm"
                aria-label="Denominação da estratificação"
                defaultValue=""
            >
                <option value="" disabled>— Selecione uma denominação —</option>
                {ESTRATIFICACAO_ALTERNATIVAS.map(alt => (
                    <option key={alt} value={alt}>{alt}</option>
                ))}
            </select>
        </div>

        {/* Sugestão Automática de Cotas */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-amber-900 mb-1 flex items-center gap-2">
                        <Zap size={16} className="text-amber-600" />
                        Sugerir Cotas com Dados Demográficos IBGE
                    </h3>
                    <p className="text-xs text-amber-700 mb-3">
                        Gera automaticamente cotas proporcionais aos dados do Censo 2022 para: sexo, faixa etária e escolaridade.
                        Se não houver dados, não gera cota para esse critério.
                    </p>
                    {suggestionError && (
                        <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-3">
                            ⚠️ {suggestionError}
                        </div>
                    )}
                    {suggestionApplied && (
                        <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2.5 py-1.5 mb-3">
                            ✓ Cotas sugeridas aplicadas com sucesso!
                        </div>
                    )}
                </div>
                <button
                    type="button"
                    onClick={applySuggestedQuotas}
                    disabled={loadingSuggestions || localities.length === 0}
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 whitespace-nowrap ${loadingSuggestions || localities.length === 0
                            ? 'bg-amber-100 text-amber-500 cursor-not-allowed'
                            : 'bg-amber-600 text-white hover:bg-amber-700'
                        }`}
                >
                    {loadingSuggestions && <Loader2 size={14} className="animate-spin" />}
                    {loadingSuggestions ? 'Gerando...' : 'Sugerir Cotas'}
                </button>
            </div>
        </div>

        {/* Atalhos de premissas comuns */}
        <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                3. Perfil do Entrevistado — Adicionar rapidamente
                <Tooltip text="Adiciona critérios pré-configurados para estratificação. Você poderá editar as opções após adicionar." helpId="premises-overview" />
            </h3>
            <p className="text-xs text-slate-400 mb-3">Clique nos critérios abaixo para incluir na estratificação:</p>
            <div className="flex flex-wrap gap-2">
                {PRESET_CATEGORIES.map(preset => (
                    <button
                        key={preset.category}
                        type="button"
                        onClick={() => addPreset(preset)}
                        disabled={existingCategories.has(preset.category)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition
                                ${existingCategories.has(preset.category)
                                ? 'bg-green-50 border-green-300 text-green-700 cursor-default'
                                : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}
                    >
                        {existingCategories.has(preset.category) ? '✓ ' : '+ '}{preset.label}
                    </button>
                ))}
                <button
                    type="button"
                    onClick={addCustom}
                    className="px-3 py-1.5 rounded-lg text-sm border border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 transition flex items-center gap-1"
                >
                    <Plus size={14} />
                    Personalizada
                </button>
            </div>
        </div>

        {/* Lista de premissas */}
        {premises.length > 0 ? (
            <div className="space-y-4">
                {premises.map(premise => (
                    <PremiseCard
                        key={premise.id}
                        premise={premise}
                        onRemove={() => removePremise(premise.id)}
                        onUpdate={updates => updatePremise(premise.id, updates)}
                    />
                ))}
            </div>
        ) : (
            <div className="text-center text-slate-400 py-10 border-2 border-dashed border-slate-200 rounded-xl">
                <p className="text-lg mb-1">Nenhuma premissa definida</p>
                <p className="text-sm">Use os atalhos acima ou adicione premissas personalizadas</p>
                <p className="text-xs mt-1 text-slate-300">(Esta etapa é opcional)</p>
            </div>
        )}
    </div>
);
}
