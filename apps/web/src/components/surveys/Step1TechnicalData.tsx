'use client';

import { HelpCircle } from 'lucide-react';

export interface SurveyTechData {
    title: string;
    description: string;
    survey_type: string;
    margin_of_error: number;
    confidence_interval: number;
    objective: string;
    methodology: string;
    target_audience: string;
    requires_geolocation: boolean;
    requires_photo: boolean;
    requires_signature: boolean;
    allow_offline: boolean;
    started_at: string;
    ended_at: string;
}

interface Props {
    data: SurveyTechData;
    onChange: (data: SurveyTechData) => void;
}

function Tooltip({ text }: { text: string }) {
    return (
        <span className="relative group inline-flex items-center ml-1.5">
            <HelpCircle size={15} className="text-slate-400 cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-slate-800 text-white text-xs rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                {text}
            </span>
        </span>
    );
}

function Label({ htmlFor, children, tooltip }: { htmlFor: string; children: React.ReactNode; tooltip?: string }) {
    return (
        <label htmlFor={htmlFor} className="flex items-center text-sm font-medium text-slate-700 mb-1.5">
            {children}
            {tooltip && <Tooltip text={tooltip} />}
        </label>
    );
}

function Field({ children }: { children: React.ReactNode }) {
    return <div className="flex flex-col">{children}</div>;
}

export function Step1TechnicalData({ data, onChange }: Props) {
    const set = (key: keyof SurveyTechData, value: string | number | boolean) =>
        onChange({ ...data, [key]: value });

    return (
        <div>
            <h2 className="text-lg font-bold text-slate-900 mb-1">Etapa 1 — Dados Técnicos</h2>
            <p className="text-sm text-slate-500 mb-6">
                Informe os dados de identificação e os parâmetros estatísticos que aparecerão no cabeçalho do relatório.
            </p>

            <div className="grid grid-cols-1 gap-5">
                {/* Título */}
                <Field>
                    <Label htmlFor="title" tooltip="Nome oficial da pesquisa. Aparecerá em todos os relatórios e na capa.">
                        Título da Pesquisa <span className="text-red-500">*</span>
                    </Label>
                    <input
                        id="title"
                        type="text"
                        value={data.title}
                        onChange={e => set('title', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Ex: Pesquisa Eleitoral Municipal — 2026"
                        maxLength={500}
                    />
                </Field>

                {/* Tipo + Objetivo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field>
                        <Label htmlFor="survey_type" tooltip="Classifica a natureza da pesquisa para fins de relatório e análise.">
                            Tipo de Pesquisa
                        </Label>
                        <select
                            id="survey_type"
                            value={data.survey_type}
                            onChange={e => set('survey_type', e.target.value)}
                            aria-label="Tipo de pesquisa"
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Selecione...</option>
                            <option value="eleitoral">Eleitoral</option>
                            <option value="satisfacao">Satisfação com gestão</option>
                            <option value="opiniao">Opinião pública</option>
                            <option value="censo">Censo / Cadastro</option>
                            <option value="avaliacao">Avaliação de serviços</option>
                            <option value="outros">Outros</option>
                        </select>
                    </Field>

                    <Field>
                        <Label htmlFor="target_audience" tooltip="Quem são os entrevistados? Ex: Eleitores com título ativo no município.">
                            Público-alvo
                        </Label>
                        <input
                            id="target_audience"
                            type="text"
                            value={data.target_audience}
                            onChange={e => set('target_audience', e.target.value)}
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Eleitores registrados no município"
                        />
                    </Field>
                </div>

                {/* Margem de erro + Intervalo de confiança */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field>
                        <Label
                            htmlFor="margin_of_error"
                            tooltip="Margem de erro aceitável na pesquisa. Quanto menor, maior a amostra necessária. Valores comuns: 3% a 5%."
                        >
                            Margem de Erro (%)
                        </Label>
                        <div className="flex items-center gap-4">
                            <input
                                id="margin_of_error"
                                type="range"
                                min={1}
                                max={10}
                                step={0.5}
                                value={data.margin_of_error}
                                onChange={e => set('margin_of_error', parseFloat(e.target.value))}
                                className="flex-1 accent-blue-600"
                                aria-label="Margem de erro em porcentagem"
                            />
                            <span className="w-14 text-center border border-slate-300 rounded-lg px-2 py-1 text-sm font-bold text-blue-700">
                                {data.margin_of_error}%
                            </span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-400 mt-1">
                            <span>1% (precisão alta, amostra maior)</span>
                            <span>10% (amostra menor)</span>
                        </div>
                    </Field>

                    <Field>
                        <Label
                            htmlFor="confidence_interval"
                            tooltip="Probabilidade de que o intervalo de confiança contém o valor real. 95% é o padrão na maioria das pesquisas."
                        >
                            Intervalo de Confiança
                        </Label>
                        <div className="flex flex-wrap gap-2 mt-1">
                            {[90, 95, 99].map(ic => (
                                <button
                                    key={ic}
                                    type="button"
                                    onClick={() => set('confidence_interval', ic)}
                                    className={`px-4 py-2 rounded-lg text-sm font-semibold border transition
                                        ${data.confidence_interval === ic
                                            ? 'bg-blue-600 text-white border-blue-600'
                                            : 'border-slate-300 text-slate-600 hover:border-blue-400 hover:text-blue-600'}`}
                                >
                                    {ic}%
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-2">
                            Z: {data.confidence_interval === 90 ? '1,645' : data.confidence_interval === 95 ? '1,960' : '2,576'} (normal padrão)
                        </p>
                    </Field>
                </div>

                {/* Período */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <Field>
                        <Label htmlFor="started_at" tooltip="Data de início prevista para a coleta de dados em campo.">
                            Início da Coleta
                        </Label>
                        <input
                            id="started_at"
                            type="date"
                            value={data.started_at}
                            onChange={e => set('started_at', e.target.value)}
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            aria-label="Data de início da coleta"
                        />
                    </Field>
                    <Field>
                        <Label htmlFor="ended_at" tooltip="Data de encerramento prevista para a coleta de dados.">
                            Fim da Coleta
                        </Label>
                        <input
                            id="ended_at"
                            type="date"
                            value={data.ended_at}
                            onChange={e => set('ended_at', e.target.value)}
                            className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500"
                            aria-label="Data de encerramento da coleta"
                        />
                    </Field>
                </div>

                {/* Objetivo */}
                <Field>
                    <Label htmlFor="objective" tooltip="Descreva o objetivo principal da pesquisa. Consta no relatório como apresentação.">
                        Objetivo da Pesquisa
                    </Label>
                    <textarea
                        id="objective"
                        rows={3}
                        value={data.objective}
                        onChange={e => set('objective', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Descreva o objetivo principal da pesquisa..."
                    />
                </Field>

                {/* Metodologia */}
                <Field>
                    <Label htmlFor="methodology" tooltip="Ex: Entrevista domiciliar face-a-face com questionário estruturado.">
                        Metodologia
                    </Label>
                    <textarea
                        id="methodology"
                        rows={2}
                        value={data.methodology}
                        onChange={e => set('methodology', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Ex: Entrevista domiciliar face-a-face com questionário estruturado."
                    />
                </Field>

                {/* Opções da coleta */}
                <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <p className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-1">
                        Recursos da coleta
                        <Tooltip text="Define quais dados adicionais serão coletados durante as entrevistas pelo app mobile." />
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                            { key: 'requires_geolocation', label: '📍 Geolocalização', tip: 'Captura as coordenadas GPS no momento da entrevista.' },
                            { key: 'requires_photo', label: '📷 Foto', tip: 'Permite tirar foto do entrevistado ou local.' },
                            { key: 'requires_signature', label: '✍️ Assinatura', tip: 'Coleta assinatura digital do entrevistado.' },
                            { key: 'allow_offline', label: '📵 Modo offline', tip: 'Permite coletar sem internet e sincronizar depois.' },
                        ].map(({ key, label, tip }) => (
                            <label key={key} className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 cursor-pointer hover:border-blue-300 transition">
                                <input
                                    type="checkbox"
                                    checked={data[key as keyof SurveyTechData] as boolean}
                                    onChange={e => set(key as keyof SurveyTechData, e.target.checked)}
                                    className="accent-blue-600 w-4 h-4"
                                />
                                <span className="text-sm text-slate-700">{label}</span>
                                <Tooltip text={tip} />
                            </label>
                        ))}
                    </div>
                </div>

                {/* Descrição */}
                <Field>
                    <Label htmlFor="description" tooltip="Descrição adicional ou observações internas. Não aparece no relatório final.">
                        Observações internas
                    </Label>
                    <textarea
                        id="description"
                        rows={2}
                        value={data.description}
                        onChange={e => set('description', e.target.value)}
                        className="border border-slate-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Observações internas (não aparecem no relatório)..."
                    />
                </Field>
            </div>
        </div>
    );
}
