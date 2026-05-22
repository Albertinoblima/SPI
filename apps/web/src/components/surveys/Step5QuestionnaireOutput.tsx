'use client';

import { useMemo } from 'react';
import { ExternalLink, Download } from 'lucide-react';
import type { Question } from '@political-research/shared-types';
import type { Premise } from './Step3Premises';

interface Props {
    surveyId?: string;
    surveyTitle?: string;
    questions: Question[];
    premises: Premise[];
}

export function Step5QuestionnaireOutput({ surveyId, surveyTitle, questions, premises }: Props) {
    const canDownload = Boolean(surveyId);

    const previewUrl = useMemo(
        () => (surveyId ? `/api/surveys/${surveyId}/questionnaire/preview` : ''),
        [surveyId],
    );

    const pdfUrl = useMemo(
        () => (surveyId ? `/api/surveys/${surveyId}/questionnaire/download?format=pdf` : ''),
        [surveyId],
    );

    const docxUrl = useMemo(
        () => (surveyId ? `/api/surveys/${surveyId}/questionnaire/download?format=docx` : ''),
        [surveyId],
    );

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-lg font-bold text-slate-900">Etapa 5 (complemento) — Visualizacao e Download</h2>
                <p className="text-sm text-slate-500 mt-1">
                    Revise o questionario no formato final e gere PDF ou DOCX. O bloco de perfil do entrevistado fica sempre ao final.
                </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="font-semibold text-slate-800">Resumo</h3>
                <div className="mt-3 text-sm text-slate-600 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-slate-400 text-xs uppercase tracking-wide">Pesquisa</div>
                        <div className="font-medium text-slate-800">{surveyTitle || '-'}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-slate-400 text-xs uppercase tracking-wide">Questoes</div>
                        <div className="font-medium text-slate-800">{questions.length}</div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <div className="text-slate-400 text-xs uppercase tracking-wide">Premissas</div>
                        <div className="font-medium text-slate-800">{premises.length}</div>
                    </div>
                </div>
            </div>

            {!canDownload && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Salve o rascunho para habilitar visualizacao e download dos documentos.
                </div>
            )}

            <div className="flex flex-wrap gap-3">
                <a
                    href={canDownload ? previewUrl : '#'}
                    target="_blank"
                    rel="noreferrer"
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition ${canDownload
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-slate-200 text-slate-500 pointer-events-none'
                        }`}
                >
                    <ExternalLink size={16} />
                    Visualizar Questionario
                </a>

                <a
                    href={canDownload ? pdfUrl : '#'}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium border transition ${canDownload
                            ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'border-slate-200 text-slate-400 pointer-events-none'
                        }`}
                >
                    <Download size={16} />
                    Download PDF
                </a>

                <a
                    href={canDownload ? docxUrl : '#'}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium border transition ${canDownload
                            ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                            : 'border-slate-200 text-slate-400 pointer-events-none'
                        }`}
                >
                    <Download size={16} />
                    Download DOCX
                </a>
            </div>
        </div>
    );
}
