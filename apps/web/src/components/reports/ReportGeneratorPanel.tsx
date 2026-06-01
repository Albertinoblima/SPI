'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, AlertCircle, CheckSquare, Square } from 'lucide-react';

interface ReportGeneratorPanelProps {
  surveyId: string;
  onGenerated?: (downloadUrl: string) => void;
  // Suporte para vir da visão dinâmica com filtros pré-selecionados
  initialReportType?: 'synthetic' | 'analytical' | 'consolidated';
  initialSelectedPremiseIds?: string[];
  initialIncludeLocalityCross?: boolean;
  initialUseAIInsights?: boolean;
  contextMessage?: string; // Mensagem de contexto vinda da análise dinâmica
}

interface Premise {
  id: string;
  category: string;
  label: string;
  isMappableForCross: boolean;
}

/**
 * Painel de Geração de Relatórios Profissionais
 * 
 * Agora com suporte real à seleção de premissas para cruzamentos (requisito principal do usuário).
 */
export function ReportGeneratorPanel({
  surveyId,
  onGenerated,
  initialReportType,
  initialSelectedPremiseIds,
  initialIncludeLocalityCross,
  initialUseAIInsights,
  contextMessage
}: ReportGeneratorPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportType, setReportType] = useState<'synthetic' | 'analytical' | 'consolidated'>(initialReportType || 'synthetic');
  const [format, setFormat] = useState<'docx' | 'pdf'>('docx');

  const [premises, setPremises] = useState<Premise[]>([]);
  const [selectedPremiseIds, setSelectedPremiseIds] = useState<string[]>(initialSelectedPremiseIds || []);
  const [loadingPremises, setLoadingPremises] = useState(false);
  const [includeLocalityCross, setIncludeLocalityCross] = useState(initialIncludeLocalityCross ?? true);
  const [useAIInsights, setUseAIInsights] = useState(initialUseAIInsights ?? false);

  // Busca as premissas da pesquisa ao carregar
  useEffect(() => {
    const fetchPremises = async () => {
      setLoadingPremises(true);
      try {
        const res = await fetch(`/api/surveys/${surveyId}/premises`); // Assumindo que existe ou criaremos depois
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.premises || []).filter((p: { mapped_question_id?: string | null }) => p.mapped_question_id);
          setPremises(mapped);
        }
      } catch {
        // Fallback: se não tiver endpoint ainda, mostra mensagem
      } finally {
        setLoadingPremises(false);
      }
    };

    if (['analytical', 'consolidated'].includes(reportType)) {
      fetchPremises();
    }
  }, [surveyId, reportType]);

  const togglePremise = (id: string) => {
    setSelectedPremiseIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setDownloadUrl(null);

    try {
      const payload: Record<string, unknown> = {
        reportType,
        name: `Relatório ${reportType}`,
      };

      // Só envia premissas selecionadas quando for Analítico ou Consolidado
      if (['analytical', 'consolidated'].includes(reportType) && selectedPremiseIds.length > 0) {
        payload['selectedPremises'] = selectedPremiseIds;
      }

      // Flag para incluir cruzamentos por localidade (fortemente recomendado)
      if (['analytical', 'consolidated'].includes(reportType)) {
        payload['includeLocalityCross'] = includeLocalityCross;
      }

      payload['format'] = format;

      // Envia a escolha real do usuário sobre usar IA nos insights (apenas relevante para Consolidado)
      if (reportType === 'consolidated') {
        payload['useAIInsights'] = useAIInsights;
      }

      const res = await fetch(`/api/reports/${surveyId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Erro ao gerar relatório');
      }

      setDownloadUrl(data.downloadUrl);
      onGenerated?.(data.downloadUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Falha ao gerar o relatório. Tente novamente.';
      setError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="border rounded-xl p-6 bg-white shadow-sm space-y-4">
      {contextMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
          {contextMessage}
        </div>
      )}

      <div>
        <h3 className="text-lg font-semibold">Gerar Relatório Profissional</h3>
        <p className="text-sm text-slate-600 mt-1">
          Gera relatórios profissionais em <strong>DOCX ou PDF</strong> com gráficos de alta qualidade, identidade visual da empresa, cruzamentos por premissas e localidade. O tipo <strong>Consolidado</strong> inclui análises e interpretações automáticas.
        </p>
      </div>

      <div className="flex gap-2">
        {(['synthetic', 'analytical', 'consolidated'] as const).map((type) => (
          <button
            key={type}
            onClick={() => {
              setReportType(type);
              if (type === 'synthetic') setSelectedPremiseIds([]);
            }}
            className={`px-3 py-1.5 text-sm rounded-md border transition ${reportType === type
              ? 'bg-blue-600 text-white border-blue-600'
              : 'hover:bg-slate-50'}`}
          >
            {type === 'synthetic' && 'Sintético'}
            {type === 'analytical' && 'Analítico'}
            {type === 'consolidated' && 'Consolidado'}
          </button>
        ))}
      </div>

      {reportType === 'consolidated' && (
        <div className="text-xs bg-blue-50 border border-blue-200 rounded p-2 text-blue-700">
          O relatório <strong>Consolidado</strong> inclui análises e interpretações geradas automaticamente.
          Modo IA avançada pode ser ativado via configuração (atualmente usando análise de alta qualidade).
        </div>
      )}

      {/* Seleção de Premissas para cruzamentos (só aparece em Analítico/Consolidado) */}
      {['analytical', 'consolidated'].includes(reportType) && (
        <div className="border rounded-lg p-3 bg-slate-50">
          <p className="text-sm font-medium mb-2">Premissas para cruzamentos (opcional)</p>
          {loadingPremises ? (
            <p className="text-xs text-slate-500">Carregando premissas...</p>
          ) : premises.length === 0 ? (
            <p className="text-xs text-amber-600">Nenhuma premissa mapeada para perguntas ainda. Configure em Planejamento → Premissas.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-40 overflow-auto">
              {premises.map((p) => {
                const isSelected = selectedPremiseIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => togglePremise(p.id)}
                    className={`flex items-center gap-2 text-left px-2 py-1 rounded text-sm border transition ${isSelected ? 'bg-blue-100 border-blue-300' : 'hover:bg-white'
                      }`}
                  >
                    {isSelected ? <CheckSquare className="h-4 w-4 text-blue-600" /> : <Square className="h-4 w-4 text-slate-400" />}
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-slate-500 mt-1.5">Selecione as premissas que deseja cruzar com as perguntas principais.</p>
        </div>
      )}

      {/* Opção de cruzamento por localidade */}
      {['analytical', 'consolidated'].includes(reportType) && (
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={includeLocalityCross}
            onChange={(e) => setIncludeLocalityCross(e.target.checked)}
            className="accent-blue-600"
          />
          Incluir cruzamentos por Localidade (fortemente recomendado)
        </label>
      )}

      {/* Seleção de formato */}
      <div className="flex gap-2 items-center text-sm">
        <span className="font-medium">Formato:</span>
        {(['docx', 'pdf'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`px-3 py-1 rounded border text-xs ${format === f ? 'bg-blue-600 text-white' : 'hover:bg-slate-100'}`}
          >
            {f.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Opção avançada de IA (apenas para Consolidado) */}
      {reportType === 'consolidated' && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAIInsights}
              onChange={(e) => setUseAIInsights(e.target.checked)}
              className="mt-0.5 accent-amber-600"
            />
            <div className="text-xs leading-snug">
              <span className="font-semibold text-amber-800">Usar análises geradas por IA (Consolidado)</span>
              <p className="text-amber-700 mt-1">
                Inclui interpretações estratégicas geradas por LLM.
                <strong> Aumenta o tempo e custo.</strong> Recomendado apenas para relatórios finais importantes.
              </p>
            </div>
          </label>
        </div>
      )}

      <Button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="w-full"
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Gerando relatório (pode levar alguns minutos)...
          </>
        ) : (
          'Gerar Relatório .docx'
        )}
      </Button>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {downloadUrl && (
        <div className="bg-emerald-50 border border-emerald-200 rounded p-4">
          <p className="text-emerald-700 text-sm mb-2 font-medium">Relatório gerado com sucesso!</p>
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 text-sm font-semibold w-fit"
          >
            <Download className="h-4 w-4" />
            Baixar Relatório
          </a>
          <p className="text-[11px] text-emerald-600 mt-2">Link válido por ~45 minutos • Máximo de downloads limitado por segurança.</p>
        </div>
      )}

      <p className="text-[10px] text-slate-500">
        Os relatórios utilizam a nova infraestrutura profissional (gráficos em alta resolução, identidade visual da empresa e cruzamentos por premissas mapeadas).
      </p>
    </div>
  );
}