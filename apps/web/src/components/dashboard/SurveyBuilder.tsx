'use client';

import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from 'react-beautiful-dnd';
import { Trash2, GripVertical, Plus, Eye, Save } from 'lucide-react';
import type { Question, QuestionType } from '@political-research/shared-types';

interface SurveyState {
    title: string;
    description: string;
    questions: Question[];
}

const QUESTION_TEMPLATES: Record<QuestionType, Partial<Question>> = {
    text: { question_text: 'Nova pergunta de texto', is_required: false },
    number: { question_text: 'Nova pergunta numérica', is_required: false },
    single_choice: { question_text: 'Escolha única', is_required: false, options: [{ id: '1', label: 'Opção 1', value: 'opt1', order: 0 }, { id: '2', label: 'Opção 2', value: 'opt2', order: 1 }] },
    multiple_choice: { question_text: 'Múltipla escolha', is_required: false, options: [{ id: '1', label: 'Opção 1', value: 'opt1', order: 0 }, { id: '2', label: 'Opção 2', value: 'opt2', order: 1 }] },
    rating: { question_text: 'Avaliação', is_required: false },
    date: { question_text: 'Data', is_required: false },
    photo: { question_text: 'Foto', is_required: false },
    signature: { question_text: 'Assinatura', is_required: false },
    geolocation: { question_text: 'Localização', is_required: true },
};

const TYPE_LABELS: Record<QuestionType, string> = {
    text: '📝 Texto',
    number: '🔢 Número',
    single_choice: '⭕ Escolha Única',
    multiple_choice: '☑️ Múltipla Escolha',
    rating: '⭐ Avaliação',
    date: '📅 Data',
    photo: '📷 Foto',
    signature: '✍️ Assinatura',
    geolocation: '📍 Localização',
};

interface SurveyBuilderProps {
    initialTitle?: string;
    initialDescription?: string;
    initialQuestions?: Question[];
    surveyId?: string;
    onSave: (data: { title: string; description: string; questions: Question[] }) => Promise<void>;
}

export function SurveyBuilder({ initialTitle, initialDescription, initialQuestions, surveyId, onSave }: SurveyBuilderProps) {
    const [survey, setSurvey] = useState<SurveyState>({
        title: initialTitle ?? 'Nova Pesquisa',
        description: initialDescription ?? '',
        questions: initialQuestions ?? [],
    });
    const [previewMode, setPreviewMode] = useState(false);
    const [showSaveNotification, setShowSaveNotification] = useState(false);
    const [saving, setSaving] = useState(false);

    const addQuestion = (type: QuestionType) => {
        const now = new Date().toISOString();
        const newQuestion: Question = {
            id: `q_${Date.now()}`,
            survey_id: surveyId ?? '',
            question_type: type,
            question_text: '',
            is_required: false,
            order_index: survey.questions.length,
            created_at: now,
            updated_at: now,
            ...QUESTION_TEMPLATES[type],
        };

        setSurvey(prev => ({
            ...prev,
            questions: [...prev.questions, newQuestion],
        }));
    };

    const removeQuestion = (id: string) => {
        setSurvey(prev => ({
            ...prev,
            questions: prev.questions.filter(q => q.id !== id),
        }));
    };

    const updateQuestion = (id: string, updates: Partial<Question>) => {
        setSurvey(prev => ({
            ...prev,
            questions: prev.questions.map(q =>
                q.id === id ? { ...q, ...updates } : q
            ),
        }));
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;

        const items = Array.from(survey.questions);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);

        const reindexed = items.map((q, i) => ({ ...q, order_index: i }));
        setSurvey(prev => ({ ...prev, questions: reindexed }));
    };

    const addOption = (questionId: string) => {
        const question = survey.questions.find(q => q.id === questionId);
        if (question?.options) {
            const nextOrder = question.options.length;
            updateQuestion(questionId, {
                options: [...question.options, { id: String(nextOrder + 1), label: `Opção ${nextOrder + 1}`, value: `opt${nextOrder + 1}`, order: nextOrder }],
            });
        }
    };

    const removeOption = (questionId: string, optionIndex: number) => {
        const question = survey.questions.find(q => q.id === questionId);
        if (question?.options) {
            updateQuestion(questionId, {
                options: question.options.filter((_, i) => i !== optionIndex),
            });
        }
    };

    const updateOptionLabel = (questionId: string, optionIndex: number, label: string) => {
        const question = survey.questions.find(q => q.id === questionId);
        if (question?.options) {
            const newOptions = [...question.options];
            newOptions[optionIndex] = { ...newOptions[optionIndex], label };
            updateQuestion(questionId, { options: newOptions });
        }
    };

    const saveSurvey = async () => {
        setSaving(true);
        try {
            await onSave(survey);
            setShowSaveNotification(true);
            setTimeout(() => setShowSaveNotification(false), 3000);
        } finally {
            setSaving(false);
        }
    };

    if (previewMode) {
        return <SurveyPreview survey={survey} onClose={() => setPreviewMode(false)} />;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <input
                        type="text"
                        value={survey.title}
                        onChange={(e) => setSurvey(prev => ({ ...prev, title: e.target.value }))}
                        className="text-3xl font-bold w-full border-none outline-none mb-2"
                        placeholder="Título da Pesquisa"
                    />
                    <textarea
                        value={survey.description}
                        onChange={(e) => setSurvey(prev => ({ ...prev, description: e.target.value }))}
                        className="text-gray-600 w-full border-none outline-none resize-none"
                        placeholder="Descrição (opcional)"
                        rows={2}
                    />

                    <div className="flex gap-3 mt-4">
                        <button
                            onClick={saveSurvey}
                            disabled={saving}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition"
                        >
                            <Save size={18} />
                            {saving ? 'Salvando...' : 'Salvar'}
                        </button>
                        <button
                            onClick={() => setPreviewMode(true)}
                            className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition"
                        >
                            <Eye size={18} />
                            Preview
                        </button>
                    </div>
                </div>

                {/* Question Palette */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <h3 className="font-semibold mb-3 text-gray-700">Adicionar Pergunta</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(QUESTION_TEMPLATES) as QuestionType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => addQuestion(type)}
                                className="p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-sm"
                            >
                                {TYPE_LABELS[type]}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Questions List (Drag & Drop) */}
                <DragDropContext onDragEnd={onDragEnd}>
                    <Droppable droppableId="questions">
                        {(provided) => (
                            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                                {survey.questions.map((question, index) => (
                                    <Draggable key={question.id} draggableId={question.id} index={index}>
                                        {(provided, snapshot) => (
                                            <div
                                                ref={provided.innerRef}
                                                {...provided.draggableProps}
                                                className={`bg-white rounded-lg shadow-sm p-6 ${snapshot.isDragging ? 'shadow-lg ring-2 ring-blue-500' : ''}`}
                                            >
                                                {/* Question Header */}
                                                <div className="flex items-start gap-3 mb-4">
                                                    <div {...provided.dragHandleProps} className="mt-2 cursor-move">
                                                        <GripVertical size={20} className="text-gray-400" />
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                                                {TYPE_LABELS[question.question_type]}
                                                            </span>
                                                            <label className="flex items-center gap-1 text-sm">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={question.is_required}
                                                                    onChange={(e) => updateQuestion(question.id, { is_required: e.target.checked })}
                                                                />
                                                                Obrigatória
                                                            </label>
                                                        </div>

                                                        <input
                                                            type="text"
                                                            value={question.question_text}
                                                            onChange={(e) => updateQuestion(question.id, { question_text: e.target.value })}
                                                            className="text-lg font-medium w-full border-none outline-none"
                                                            placeholder="Texto da pergunta"
                                                        />
                                                    </div>

                                                    <button
                                                        onClick={() => removeQuestion(question.id)}
                                                        className="text-red-500 hover:text-red-700 transition"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>

                                                {/* Options for choice questions */}
                                                {(question.question_type === 'single_choice' || question.question_type === 'multiple_choice') && (
                                                    <div className="ml-8 space-y-2">
                                                        {question.options?.map((option, optIndex) => (
                                                            <div key={optIndex} className="flex items-center gap-2">
                                                                <span className="text-gray-400">
                                                                    {question.question_type === 'single_choice' ? '○' : '☐'}
                                                                </span>
                                                                <input
                                                                    type="text"
                                                                    value={option.label}
                                                                    onChange={(e) => updateOptionLabel(question.id, optIndex, e.target.value)}
                                                                    className="flex-1 px-3 py-2 border border-gray-300 rounded"
                                                                    placeholder="Opção"
                                                                />
                                                                <button
                                                                    onClick={() => removeOption(question.id, optIndex)}
                                                                    className="text-red-500 hover:text-red-700"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        ))}
                                                        <button
                                                            onClick={() => addOption(question.id)}
                                                            className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm"
                                                        >
                                                            <Plus size={16} />
                                                            Adicionar opção
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Rating preview */}
                                                {question.question_type === 'rating' && (
                                                    <div className="ml-8 flex items-center gap-2">
                                                        <span className="text-sm text-gray-600">Escala:</span>
                                                        {Array.from({ length: 5 }, (_, i) => (
                                                            <span key={i} className="text-yellow-400 text-xl">⭐</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </DragDropContext>

                {survey.questions.length === 0 && (
                    <div className="bg-white rounded-lg shadow-sm p-12 text-center text-gray-400">
                        <p className="text-lg">Adicione perguntas usando os botões acima</p>
                    </div>
                )}

                {/* Save Notification */}
                {showSaveNotification && (
                    <div className="fixed bottom-6 right-6 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
                        ✅ Pesquisa salva com sucesso!
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Preview ─── */

function SurveyPreview({ survey, onClose }: { survey: SurveyState; onClose: () => void }) {
    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-lg shadow-sm p-6 mb-4">
                    <button onClick={onClose} className="text-blue-600 mb-4">← Voltar para edição</button>
                    <h1 className="text-3xl font-bold mb-2">{survey.title}</h1>
                    <p className="text-gray-600">{survey.description}</p>
                </div>

                {survey.questions.map((question, index) => (
                    <div key={question.id} className="bg-white rounded-lg shadow-sm p-6 mb-4">
                        <div className="flex items-start gap-2 mb-3">
                            <span className="font-bold text-gray-700">{index + 1}.</span>
                            <div className="flex-1">
                                <p className="font-medium">
                                    {question.question_text}
                                    {question.is_required && <span className="text-red-500 ml-1">*</span>}
                                </p>
                            </div>
                        </div>

                        {question.question_type === 'text' && (
                            <input type="text" disabled className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50" placeholder="Sua resposta" />
                        )}

                        {question.question_type === 'number' && (
                            <input type="number" disabled className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50" placeholder="Número" />
                        )}

                        {question.question_type === 'single_choice' && (
                            <div className="space-y-2">
                                {question.options?.map((option, i) => (
                                    <label key={i} className="flex items-center gap-2">
                                        <input type="radio" name={question.id} disabled />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {question.question_type === 'multiple_choice' && (
                            <div className="space-y-2">
                                {question.options?.map((option, i) => (
                                    <label key={i} className="flex items-center gap-2">
                                        <input type="checkbox" disabled />
                                        <span>{option.label}</span>
                                    </label>
                                ))}
                            </div>
                        )}

                        {question.question_type === 'rating' && (
                            <div className="flex gap-2">
                                {Array.from({ length: 5 }, (_, i) => (
                                    <span key={i} className="text-2xl text-gray-300">⭐</span>
                                ))}
                            </div>
                        )}

                        {question.question_type === 'date' && (
                            <input type="date" disabled className="px-3 py-2 border border-gray-300 rounded bg-gray-50" />
                        )}

                        {question.question_type === 'photo' && (
                            <div className="px-4 py-2 bg-gray-200 rounded inline-block">📷 Tirar Foto</div>
                        )}

                        {question.question_type === 'signature' && (
                            <div className="border-2 border-dashed border-gray-300 rounded h-32 flex items-center justify-center text-gray-400">
                                ✍️ Área de Assinatura
                            </div>
                        )}

                        {question.question_type === 'geolocation' && (
                            <div className="border-2 border-dashed border-gray-300 rounded h-32 flex items-center justify-center text-gray-400">
                                📍 Localização será capturada automaticamente
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
