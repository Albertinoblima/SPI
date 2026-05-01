'use client';

import React from 'react';
import type { Question, QuestionType } from '@political-research/shared-types';

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
    { value: 'text', label: 'Texto' },
    { value: 'number', label: 'Número' },
    { value: 'single_choice', label: 'Escolha Única' },
    { value: 'multiple_choice', label: 'Múltipla Escolha' },
    { value: 'rating', label: 'Avaliação' },
    { value: 'date', label: 'Data' },
    { value: 'photo', label: 'Foto' },
    { value: 'signature', label: 'Assinatura' },
    { value: 'geolocation', label: 'Geolocalização' },
];

interface QuestionEditorProps {
    question: Question;
    index: number;
    onChange: (question: Question) => void;
    onRemove: () => void;
}

export function QuestionEditor({ question, index, onChange, onRemove }: QuestionEditorProps) {
    return (
        <div className="bg-white border border-slate-200 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
                <span className="text-sm font-medium text-slate-500">
                    Pergunta {index + 1}
                </span>
                <button
                    onClick={onRemove}
                    className="text-red-500 hover:text-red-700 text-sm"
                >
                    Remover
                </button>
            </div>

            <div className="space-y-3">
                <input
                    type="text"
                    value={question.question_text}
                    onChange={(e) => onChange({ ...question, question_text: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2"
                    placeholder="Texto da pergunta"
                />

                <select
                    value={question.question_type}
                    onChange={(e) =>
                        onChange({ ...question, question_type: e.target.value as QuestionType })
                    }
                    className="border border-slate-300 rounded-lg px-3 py-2"
                >
                    {QUESTION_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                            {type.label}
                        </option>
                    ))}
                </select>

                <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input
                        type="checkbox"
                        checked={question.is_required}
                        onChange={(e) =>
                            onChange({
                                ...question,
                                is_required: e.target.checked,
                            })
                        }
                    />
                    Obrigatória
                </label>
            </div>
        </div>
    );
}
