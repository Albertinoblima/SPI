'use client';

import { useMemo, useState } from 'react';
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
    const [downloadingFormat, setDownloadingFormat] = useState<'pdf' | 'docx' | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

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

    const handleDownload = async (format: 'pdf' | 'docx') => {
        if (!surveyId) return;

        setDownloadingFormat(format);
        setErrorMessage(null);

        try {
            const url = format === 'pdf' ? pdfUrl : docxUrl;
            const response = await fetch(url);
            if (!response.ok) {
                const json = await response.json().catch(() => null);
                setErrorMessage(json?.error ?? `Falha ao gerar ${format.toUpperCase()}.`);
                return;
            }

            const blob = await response.blob();
            const extension = format === 'pdf' ? 'pdf' : 'docx';
            const objectUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = `questionario-${surveyId}.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(objectUrl);
        } catch {
            setErrorMessage(`Falha de conexao ao baixar ${format.toUpperCase()}.`);
        } finally {
            setDownloadingFormat(null);
        }
    };

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

                <button
                    type="button"
                    onClick={() => handleDownload('pdf')}
                    disabled={!canDownload || downloadingFormat !== null}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium border transition disabled:opacity-60 ${canDownload
                        ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                        : 'border-slate-200 text-slate-400 pointer-events-none'
                        }`}
                >
                    <Download size={16} />
                    {downloadingFormat === 'pdf' ? 'Gerando PDF...' : 'Download PDF'}
                </button>

                <button
                    type="button"
                    onClick={() => handleDownload('docx')}
                    disabled={!canDownload || downloadingFormat !== null}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium border transition disabled:opacity-60 ${canDownload
                        ? 'border-slate-300 text-slate-700 hover:bg-slate-50'
                        : 'border-slate-200 text-slate-400 pointer-events-none'
                        }`}
                >
                    <Download size={16} />
                    {downloadingFormat === 'docx' ? 'Gerando DOCX...' : 'Download DOCX'}
                </button>
            </div>

            {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {errorMessage}
                </div>
            )}
        </div>
    );
}
