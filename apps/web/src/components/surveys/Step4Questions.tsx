'use client';

import { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from 'react-beautiful-dnd';
import { Plus, Trash2, GripVertical, HelpCircle, X, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import type { Question } from '@political-research/shared-types';
import { HELP_HOVER_EVENT, HELP_TOPICS_BY_ID } from '@/lib/help-topics';

interface Props {
    questions: Question[];
    onChange: (questions: Question[]) => void;
    surveyTitle?: string;
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

type QuestionType = Question['question_type'];

const TYPE_OPTIONS: Array<{ value: QuestionType; label: string; icon: string; description: string }> = [
    { value: 'single_choice', label: 'Escolha Única', icon: '⭕', description: 'O entrevistado escolhe apenas uma opção' },
    { value: 'multiple_choice', label: 'Múltipla Escolha', icon: '☑️', description: 'Permite selecionar várias opções' },
    { value: 'text', label: 'Texto livre', icon: '📝', description: 'Resposta aberta em texto' },
    { value: 'number', label: 'Número', icon: '🔢', description: 'Resposta numérica' },
    { value: 'rating', label: 'Avaliação (1-5)', icon: '⭐', description: 'Escala de satisfação de 1 a 5' },
    { value: 'date', label: 'Data', icon: '📅', description: 'Seleção de data' },
    { value: 'photo', label: 'Foto', icon: '📷', description: 'Captura de imagem' },
    { value: 'geolocation', label: 'Geolocalização', icon: '📍', description: 'Coordenadas GPS automáticas' },
];

function QuestionCard({
    question, index, onRemove, onUpdate, onAddOption, onRemoveOption, onUpdateOptionLabel,
}: {
    question: Question;
    index: number;
    onRemove: () => void;
    onUpdate: (updates: Partial<Question>) => void;
    onAddOption: () => void;
    onRemoveOption: (optIdx: number) => void;
    onUpdateOptionLabel: (optIdx: number, label: string) => void;
}) {
    const typeInfo = TYPE_OPTIONS.find(t => t.value === question.question_type);
    const hasOptions = question.question_type === 'single_choice' || question.question_type === 'multiple_choice';

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-start gap-3 p-5">
                {/* Drag handle */}
                <div className="mt-2 text-slate-300 cursor-move shrink-0">
                    <GripVertical size={20} />
                </div>

                {/* Número */}
                <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                </div>

                <div className="flex-1 space-y-3">
                    {/* Tipo + badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">
                            {typeInfo?.icon} {typeInfo?.label}
                        </span>
                        <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={question.is_required}
                                onChange={e => onUpdate({ is_required: e.target.checked })}
                                className="accent-blue-600"
                            />
                            Obrigatória
                            <Tooltip text="Marque como obrigatoria somente quando a resposta for essencial para os indicadores da pesquisa." helpId="question-required" />
                        </label>
                    </div>

                    {/* Texto da pergunta */}
                    <textarea
                        value={question.question_text}
                        onChange={e => onUpdate({ question_text: e.target.value })}
                        rows={2}
                        className="w-full text-slate-800 font-medium border-none outline-none resize-none bg-transparent placeholder:text-slate-400 text-base"
                        placeholder="Digite o texto da pergunta..."
                    />

                    {/* Opções para escolha única/múltipla */}
                    {hasOptions && (
                        <div className="space-y-2 pl-2">
                            {question.options?.map((opt, optIdx) => (
                                <div key={optIdx} className="flex items-center gap-2">
                                    <span className="text-slate-400 shrink-0">
                                        {question.question_type === 'single_choice' ? '○' : '☐'}
                                    </span>
                                    <input
                                        type="text"
                                        value={opt.label}
                                        onChange={e => onUpdateOptionLabel(optIdx, e.target.value)}
                                        className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder={`Opção ${optIdx + 1}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => onRemoveOption(optIdx)}
                                        className="text-red-300 hover:text-red-500 transition shrink-0"
                                        aria-label="Remover opção"
                                    >
                                        <X size={15} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                onClick={onAddOption}
                                className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm transition"
                            >
                                <Plus size={15} />
                                Adicionar opção
                            </button>
                        </div>
                    )}

                    {/* Preview para outros tipos */}
                    {question.question_type === 'rating' && (
                        <div className="flex gap-1 pl-2">
                            {[1, 2, 3, 4, 5].map(i => (
                                <span key={i} className="text-yellow-300 text-2xl">★</span>
                            ))}
                            <span className="text-xs text-slate-400 self-center ml-2">(escala 1 a 5)</span>
                        </div>
                    )}
                    {question.question_type === 'text' && (
                        <div className="pl-2">
                            <div className="border border-dashed border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 bg-slate-50">
                                Campo de texto livre...
                            </div>
                        </div>
                    )}
                    {question.question_type === 'number' && (
                        <div className="pl-2">
                            <div className="border border-dashed border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 bg-slate-50 w-32 text-center">
                                0
                            </div>
                        </div>
                    )}
                    {question.question_type === 'date' && (
                        <div className="pl-2">
                            <div className="border border-dashed border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-400 bg-slate-50 w-48">
                                DD/MM/AAAA
                            </div>
                        </div>
                    )}
                    {question.question_type === 'photo' && (
                        <div className="pl-2 flex items-center gap-2 text-sm text-slate-400">
                            <span>📷</span>
                            <span>Câmera do dispositivo</span>
                        </div>
                    )}
                    {question.question_type === 'geolocation' && (
                        <div className="pl-2 flex items-center gap-2 text-sm text-slate-400">
                            <span>📍</span>
                            <span>GPS capturado automaticamente</span>
                        </div>
                    )}
                </div>

                {/* Remover */}
                <button
                    type="button"
                    onClick={onRemove}
                    className="text-red-400 hover:text-red-600 transition shrink-0 mt-0.5"
                    aria-label={`Remover pergunta ${index + 1}`}
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </div>
    );
}

export function Step4Questions({ questions, onChange, surveyTitle }: Props) {
    const [preview, setPreview] = useState(false);
    const surveyId = 'new';

    const addQuestion = (type: QuestionType) => {
        const now = new Date().toISOString();
        const defaultOptions = (type === 'single_choice' || type === 'multiple_choice')
            ? [
                { id: '1', label: 'Opção 1', value: 'opt1', order: 0 },
                { id: '2', label: 'Opção 2', value: 'opt2', order: 1 },
            ]
            : undefined;

        const newQ: Question = {
            id: `q_${Date.now()}`,
            survey_id: surveyId,
            question_type: type,
            question_text: '',
            is_required: type === 'geolocation' ? true : false,
            order_index: questions.length,
            created_at: now,
            updated_at: now,
            options: defaultOptions,
        };
        onChange([...questions, newQ]);
    };

    const removeQuestion = (id: string) =>
        onChange(questions.filter(q => q.id !== id).map((q, i) => ({ ...q, order_index: i })));

    const updateQuestion = (id: string, updates: Partial<Question>) =>
        onChange(questions.map(q => q.id === id ? { ...q, ...updates } : q));

    const addOption = (id: string) => {
        const q = questions.find(q => q.id === id);
        if (!q?.options) return;
        const next = q.options.length + 1;
        updateQuestion(id, {
            options: [...q.options, { id: String(next), label: `Opção ${next}`, value: `opt${next}`, order: next - 1 }],
        });
    };

    const removeOption = (qId: string, optIdx: number) => {
        const q = questions.find(q => q.id === qId);
        if (!q?.options) return;
        updateQuestion(qId, { options: q.options.filter((_, i) => i !== optIdx) });
    };

    const updateOptionLabel = (qId: string, optIdx: number, label: string) => {
        const q = questions.find(q => q.id === qId);
        if (!q?.options) return;
        const opts = [...q.options];
        opts[optIdx] = { ...opts[optIdx], label };
        updateQuestion(qId, { options: opts });
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(questions);
        const [moved] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, moved);
        onChange(items.map((q, i) => ({ ...q, order_index: i })));
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-slate-900">Etapa 4 — Questionário</h2>
                <button
                    type="button"
                    onClick={() => setPreview(v => !v)}
                    className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 transition"
                >
                    {preview ? <EyeOff size={16} /> : <Eye size={16} />}
                    {preview ? 'Editar' : 'Pré-visualizar'}
                </button>
            </div>
            <p className="text-sm text-slate-500 mb-6">
                Crie as perguntas da pesquisa. Arraste para reordenar. Cada pergunta pode ter condições de exibição configuradas depois.
                <span className="inline-flex ml-1 align-middle">
                    <Tooltip text="A estrutura e a ordem das perguntas influenciam qualidade de resposta e taxa de conclusao." helpId="questionnaire-overview" />
                </span>
            </p>

            {preview ? (
                /* ── Preview Mode ── */
                <div className="max-w-xl mx-auto space-y-5">
                    <div className="bg-blue-600 rounded-xl p-6 text-white">
                        <h3 className="text-xl font-bold mb-1">{surveyTitle || 'Pré-visualização'}</h3>
                        <p className="text-blue-100 text-sm">{questions.length} pergunta{questions.length !== 1 ? 's' : ''}</p>
                    </div>
                    {questions.map((q, i) => (
                        <div key={q.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                            <p className="font-medium text-slate-800 mb-3">
                                {i + 1}. {q.question_text || <em className="text-slate-400">Pergunta sem texto</em>}
                                {q.is_required && <span className="text-red-500 ml-1">*</span>}
                            </p>
                            {(q.question_type === 'single_choice' || q.question_type === 'multiple_choice') && (
                                <div className="space-y-2">
                                    {q.options?.map((opt, oi) => (
                                        <label key={oi} className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                                            <input
                                                type={q.question_type === 'single_choice' ? 'radio' : 'checkbox'}
                                                name={q.id}
                                                disabled
                                                className="accent-blue-600"
                                            />
                                            {opt.label}
                                        </label>
                                    ))}
                                </div>
                            )}
                            {q.question_type === 'text' && (
                                <textarea disabled rows={2} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 resize-none" placeholder="Resposta..." />
                            )}
                            {q.question_type === 'number' && (
                                <input disabled type="number" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50 w-32" placeholder="0" />
                            )}
                            {q.question_type === 'rating' && (
                                <div className="flex gap-2">
                                    {[1, 2, 3, 4, 5].map(i => (
                                        <button key={i} type="button" disabled className="text-2xl text-slate-300">★</button>
                                    ))}
                                </div>
                            )}
                            {q.question_type === 'date' && (
                                <input disabled type="date" aria-label="Campo de data" className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-slate-50" />
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                /* ── Edit Mode ── */
                <div className="space-y-6">
                    {/* Paleta de tipos */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">
                            Adicionar pergunta
                            <Tooltip text="Clique em um tipo de pergunta para adicioná-la ao final do questionário." helpId="question-type" />
                        </h3>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {TYPE_OPTIONS.map(type => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => addQuestion(type.value)}
                                    title={type.description}
                                    className="flex items-center gap-2 px-3 py-2.5 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 text-sm text-slate-600 hover:text-blue-700 transition group"
                                >
                                    <span>{type.icon}</span>
                                    <span className="font-medium">{type.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Lista drag & drop */}
                    {questions.length > 0 ? (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="survey-questions">
                                {provided => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                                        {questions.map((q, index) => (
                                            <Draggable key={q.id} draggableId={q.id} index={index}>
                                                {(provided, snapshot) => (
                                                    <div
                                                        ref={provided.innerRef}
                                                        {...provided.draggableProps}
                                                        {...provided.dragHandleProps}
                                                        className={snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-400 rounded-xl' : ''}
                                                    >
                                                        <QuestionCard
                                                            question={q}
                                                            index={index}
                                                            onRemove={() => removeQuestion(q.id)}
                                                            onUpdate={updates => updateQuestion(q.id, updates)}
                                                            onAddOption={() => addOption(q.id)}
                                                            onRemoveOption={optIdx => removeOption(q.id, optIdx)}
                                                            onUpdateOptionLabel={(optIdx, label) => updateOptionLabel(q.id, optIdx, label)}
                                                        />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    ) : (
                        <div className="text-center text-slate-400 py-12 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-lg mb-1">Questionário vazio</p>
                            <p className="text-sm">Clique em um tipo de pergunta acima para começar</p>
                        </div>
                    )}

                    {questions.length > 0 && (
                        <div className="text-sm text-slate-500 text-center">
                            {questions.length} pergunta{questions.length !== 1 ? 's' : ''} •{' '}
                            {questions.filter(q => q.is_required).length} obrigatória{questions.filter(q => q.is_required).length !== 1 ? 's' : ''}
                            <span className="inline-flex ml-1 align-middle">
                                <Tooltip text="Revise a ordem final para evitar vies de priming e manter fluxo logico da entrevista." helpId="question-order" />
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
