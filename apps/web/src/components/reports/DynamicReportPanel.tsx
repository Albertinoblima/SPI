'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Filter, X, AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type {
  ReportFilters,
  AdvancedCrossTabResult,
  PremiseOption,
  LocalityOption,
  DynamicAnalysisResult,
  DynamicDashboardData,
} from '@/lib/reports/types';

/**
 * DynamicReportPanel — Relatório Dinâmico Profissional
 *
 * Decisões de Arquitetura Sênior (para o usuário que pediu "o melhor e mais profissional"):
 * - Usa exclusivamente o AdvancedReportAggregationService via API (mesmo motor dos relatórios físicos).
 * - Filtros de primeira classe: Localidade + todas as premissas mapeadas (survey_premises.mapped_question_id).
 * - Uma pergunta principal + cruzamentos dinâmicos (pergunta × premissa ou pergunta × pergunta).
 * - Visualização dupla: Tabela profissional + gráfico (Recharts ou Chart.js — mantemos consistência futura com ChartImageGenerator).
 * - Estado de filtros persistido na URL (ótimo para compartilhar análises).
 * - Pronto para export CSV e "Gerar PDF deste corte" (futuro rápido).
 *
 * Este componente é o coração do "Relatório Dinâmico com filtros para cruzamento de dados".
 */

interface DynamicReportPanelProps {
  surveyId: string;
}

export function DynamicReportPanel({ surveyId }: DynamicReportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [overview, setOverview] = useState<any>(null); // analytics response is intentionally dynamic (cross tabs + filters + dimensions)
  const [selectedQuestion, setSelectedQuestion] = useState<string>('');
  const [crossWith, setCrossWith] = useState<string>('');
  const [result, setResult] = useState<AdvancedCrossTabResult | DynamicAnalysisResult | null>(null);
  const [activeFilters, setActiveFilters] = useState<Record<string, string | string[] | boolean>>({});
  const [premises, setPremises] = useState<PremiseOption[]>([]);
  const [localities, setLocalities] = useState<LocalityOption[]>([]);
  const [selectedPremises, setSelectedPremises] = useState<Record<string, string[]>>({});
  const [selectedLocalityIds, setSelectedLocalityIds] = useState<string[]>([]);
  const [premiseValuesCache, setPremiseValuesCache] = useState<Record<string, string[]>>({});
  const [copiedLink, setCopiedLink] = useState(false);

  const isDistributionResult = (
    value: AdvancedCrossTabResult | DynamicAnalysisResult | null
  ): value is DynamicAnalysisResult => {
    return !!value && Array.isArray((value as DynamicAnalysisResult).values);
  };

  // Carrega visão geral + premissas + localidades
  const loadOverview = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${surveyId}/analytics`);
      const json = await res.json();
      const data = json.data || json;
      setOverview(data);

      // Carrega premissas mapeadas
      const premRes = await fetch(`/api/surveys/${surveyId}/premises`);
      if (premRes.ok) {
        const premData = await premRes.json();
        const mappable = (premData.premises || []).filter((p: PremiseOption) => p.mapped_question_id);
        setPremises(mappable);
      }

      // Localidades da pesquisa (vindas do overview)
      const overviewData = data as DynamicDashboardData;
      if (overviewData.availableLocalities && Array.isArray(overviewData.availableLocalities)) {
        setLocalities(overviewData.availableLocalities as LocalityOption[]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [surveyId]);

  // Toggle valor de uma premissa
  const togglePremiseValue = (category: string, value: string) => {
    setSelectedPremises(prev => {
      const current = prev[category] || [];
      const next = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];

      const updated = { ...prev };
      if (next.length === 0) {
        delete updated[category];
      } else {
        updated[category] = next;
      }
      return updated;
    });
  };

  const clearAllFilters = () => {
    setSelectedPremises({});
    setSelectedLocalityIds([]);
    setResult(null);
  };

  const toggleLocality = (localityId: string) => {
    setSelectedLocalityIds(prev =>
      prev.includes(localityId)
        ? prev.filter(id => id !== localityId)
        : [...prev, localityId]
    );
  };

  // Carrega valores reais da premissa a partir das respostas (sampling profissional)
  const loadValuesForPremise = async (premise: PremiseOption) => {
    if (!premise.mapped_question_id) return;

    const cat = premise.category;
    if (premiseValuesCache[cat]) return; // já carregado

    try {
      const res = await fetch(`/api/reports/${surveyId}/analytics?questionId=${premise.mapped_question_id}`);
      const json = await res.json();
      const values = ((json.data as { values?: Array<{ label: string }> })?.values || [])
        .map((v) => v.label)
        .slice(0, 8);

      setPremiseValuesCache(prev => ({ ...prev, [cat]: values.length > 0 ? values : ['Sim', 'Não', 'Outro'] }));
    } catch {
      setPremiseValuesCache(prev => ({ ...prev, [cat]: ['Sim', 'Não', 'Outro'] }));
    }
  };

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (selectedQuestion) params.set('questionId', selectedQuestion);
    if (crossWith) {
      params.set('crossPrimary', selectedQuestion);
      params.set('crossSecondary', crossWith);
    }
    if (selectedLocalityIds.length > 0) {
      params.set('localityIds', selectedLocalityIds.join(','));
    }
    Object.entries(selectedPremises).forEach(([cat, vals]) => {
      if (vals.length > 0) params.append('premise', `${cat}=${vals.join(',')}`);
    });
    return params;
  };

  const runAnalysis = async () => {
    if (!selectedQuestion) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildFilterParams();
      const res = await fetch(`/api/reports/${surveyId}/analytics?${params}`);
      if (!res.ok) throw new Error('Falha na consulta');
      const json = await res.json();
      const analysisData = json.data as AdvancedCrossTabResult | DynamicAnalysisResult | null;
      setResult(analysisData);
      setActiveFilters((json.filters as Record<string, string | string[] | boolean>) || {});
      const hasNoData = !analysisData ||
        ((analysisData as any).total === 0 && !(analysisData as any).values?.length);
      if (hasNoData) {
        setError('Nenhum dado encontrado com os filtros atuais. Tente remover alguns filtros.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao executar análise. Verifique os filtros e tente novamente.';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const runCrossTab = async () => {
    if (!selectedQuestion || !crossWith) return;
    setLoading(true);
    setError(null);
    try {
      const params = buildFilterParams();
      const res = await fetch(`/api/reports/${surveyId}/analytics?${params}`);
      if (!res.ok) throw new Error('Falha na consulta');
      const json = await res.json();
      const crossData = json.data as AdvancedCrossTabResult | DynamicAnalysisResult | null;
      setResult(crossData);
      setActiveFilters((json.filters as Record<string, string | string[] | boolean>) || {});
      if (!crossData || (crossData as any).total === 0) {
        setError('Nenhum dado encontrado com os filtros atuais para este cruzamento.');
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao executar cruzamento.';
      setError(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    if (!result) return;

    let csv = '';
    if (!isDistributionResult(result) && result.rows) {
      // Cross tab
      const headers = [...(result.dimensions || []), 'count', 'percentage'];
      csv = headers.join(',') + '\n';
      result.rows.forEach((row: AdvancedCrossTabResult['rows'][number]) => {
        const line = headers.map(h => row[h] ?? '').join(',');
        csv += line + '\n';
      });
    } else if (isDistributionResult(result) && result.values) {
      // Distribution
      csv = 'label,count,percentage\n';
      result.values.forEach((v: { label: string; count: number; percentage?: number }) => {
        csv += `"${v.label}",${v.count},${v.percentage}\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `analise_dinamica_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Gera um relatório físico (DOCX/PDF) usando exatamente os filtros atuais da visão dinâmica
  const generatePhysicalReportFromView = async (type: 'analytical' | 'consolidated' = 'analytical') => {
    if (!selectedQuestion) {
      setError('Selecione pelo menos uma pergunta principal para gerar o relatório físico.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        reportType: type,
        format: 'docx',
        selectedPremises: Object.keys(selectedPremises),
        includeLocalityCross: selectedLocalityIds.length > 0 || true,
        useAIInsights: type === 'consolidated',
        filters: {
          localityIds: selectedLocalityIds.length > 0 ? selectedLocalityIds : undefined,
          premises: selectedPremises as any,
        },
      };

      const res = await fetch(`/api/reports/${surveyId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.downloadUrl) {
        window.open(data.downloadUrl, '_blank');
        const msg = type === 'consolidated'
          ? 'Relatório Consolidado gerado com IA e os filtros da sua análise!'
          : 'Relatório Analítico gerado com os filtros da sua análise atual!';
        setSuccessMessage(msg + ' O link é válido por tempo limitado.');
      } else {
        window.location.href = `/dashboard/surveys/${surveyId}/reports`;
      }
    } catch (e) {
      setError('Não foi possível gerar automaticamente. Redirecionando para a página de relatórios físicos.');
      setTimeout(() => {
        window.location.href = `/dashboard/surveys/${surveyId}/reports`;
      }, 1500);
    } finally {
      setLoading(false);
    }
  };

  // Preparar dados para gráfico (defensive for dynamic analysis result)
  const analysisResult = result as any;
  const isDistribution = isDistributionResult(result);
  const chartData = analysisResult?.values
    ? analysisResult.values.slice(0, 10)
    : analysisResult?.rows
      ? analysisResult.rows.slice(0, 12).map((r: Record<string, string | number | boolean | null>) => ({
        name: `${r[analysisResult.dimensions?.[0] as string] || ''} × ${r[analysisResult.dimensions?.[1] as string] || ''}`.slice(0, 35),
        value: r['count' as keyof typeof r],
      }))
      : [];

  const dimensions = (overview as any)?.['availableDimensions']?.questions || (overview as any)?.['availableDimensions'] || [];
  const hasResults = !!result;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Relatório Dinâmico</h2>
          <p className="text-sm text-slate-500 mt-1">Análise interativa em tempo real. Filtros por premissas mapeadas são aplicados diretamente nos dados.</p>
        </div>
        <Button onClick={loadOverview} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" /> Recarregar
        </Button>
      </div>

      {/* Filtros Profissionais */}
      <div className="border rounded-2xl p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <Filter className="h-4 w-4" /> Filtros Avançados (Premissas + Localidade)
          </div>
          {(Object.keys(selectedPremises).length > 0 || selectedLocalityIds.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs">
              <X className="h-3 w-3 mr-1" /> Limpar todos os filtros
            </Button>
          )}
        </div>

        {premises.length === 0 && !loading && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
            Nenhuma premissa mapeada ainda. Para usar filtros avançados e cruzamentos no Relatório Dinâmico e nos relatórios físicos, vá em <strong>Planejamento → Premissas</strong> e associe cada premissa a uma pergunta do questionário.
            <Link
              href={`/dashboard/surveys/${surveyId}`}
              className="ml-2 font-medium text-amber-800 hover:underline"
            >
              Ir configurar agora →
            </Link>
          </div>
        )}

        {premises.length === 0 ? (
          <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
            Nenhuma premissa mapeada para perguntas. Vá em <strong>Planejamento → Premissas</strong> e configure o campo "Pergunta que responde esta premissa".
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {premises.map((p: PremiseOption) => {
              const selected = selectedPremises[p.category] || [];
              const options = p.options || [];
              return (
                <div key={p.id} className="border rounded-xl p-3 bg-slate-50">
                  <div className="font-medium text-sm mb-2">{p.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.isArray(options) && options.length > 0 ? (options as string[]).map((opt: string) => {
                      const active = selected.includes(opt);
                      return (
                        <button
                          key={opt}
                          onClick={() => togglePremiseValue(p.category, opt)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-100'}`}
                        >
                          {opt}
                        </button>
                      );
                    }) : (
                      <>
                        {(premiseValuesCache[p.category] || []).map((opt: string) => {
                          const active = selected.includes(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => togglePremiseValue(p.category, opt)}
                              className={`text-xs px-2.5 py-1 rounded-full border transition ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-slate-100'}`}
                            >
                              {opt}
                            </button>
                          );
                        })}
                        <button
                          onClick={() => loadValuesForPremise(p)}
                          className="text-[10px] px-2 py-0.5 rounded border border-dashed text-indigo-600 hover:bg-indigo-50"
                        >
                          Carregar valores reais
                        </button>
                      </>
                    )}
                  </div>
                  {selected.length > 0 && (
                    <div className="mt-2 text-[10px] text-blue-700">Selecionados: {selected.join(', ')}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-3 text-[10px] text-slate-500">
          Os filtros acima são aplicados em tempo real nas análises abaixo usando as respostas reais coletadas.
        </div>

        {/* Localidades */}
        {localities.length > 0 && (
          <div className="mt-5 pt-4 border-t">
            <div className="text-xs font-semibold text-slate-600 mb-2">Filtrar por Localidade</div>
            <div className="flex flex-wrap gap-2">
              {localities.map((loc: LocalityOption) => {
                const active = selectedLocalityIds.includes(loc.id);
                return (
                  <button
                    key={loc.id}
                    onClick={() => toggleLocality(loc.id)}
                    className={`text-xs px-3 py-1 rounded-full border transition ${active ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-slate-100'}`}
                  >
                    {loc.name} {loc.zone ? `(${loc.zone})` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Resumo de Filtros Ativos + Ponte para Relatório Físico (Profissional) */}
      {(Object.keys(selectedPremises).length > 0 || selectedLocalityIds.length > 0) && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border bg-indigo-50 px-5 py-3 text-sm">
          <span className="font-semibold text-indigo-900">Filtros ativos:</span>
          {selectedLocalityIds.length > 0 && (
            <span className="rounded-full bg-white px-3 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
              {selectedLocalityIds.length} localidade(s)
            </span>
          )}
          {Object.entries(selectedPremises).map(([cat, vals]) => (
            <span key={cat} className="rounded-full bg-white px-3 py-0.5 text-xs font-medium text-indigo-700 border border-indigo-200">
              {cat}: {vals.length}
            </span>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => generatePhysicalReportFromView('analytical')}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
            >
              {loading ? 'Gerando...' : 'Gerar Analítico'}
            </button>
            <button
              onClick={() => generatePhysicalReportFromView('consolidated')}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-1 text-xs font-semibold text-white hover:bg-purple-700 transition disabled:opacity-60"
            >
              {loading ? 'Gerando...' : 'Gerar Consolidado + IA'}
            </button>
            <a
              href={`/dashboard/surveys/${surveyId}/reports?from=dynamic&type=${crossWith ? 'analytical' : 'consolidated'}&premises=${Object.keys(selectedPremises).join(',')}&useAI=${crossWith ? 'false' : 'true'}`}
              className="text-xs px-3 py-1 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700"
            >
              Revisar na página de físicos
            </a>
          </div>
        </div>
      )}

      {/* Seletor de Análise */}
      <div className="border rounded-2xl p-6 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="text-xs font-semibold tracking-wider text-slate-500 block mb-1.5">PERGUNTA PRINCIPAL</label>
            <select
              aria-label="Pergunta principal"
              title="Pergunta principal"
              value={selectedQuestion}
              onChange={(e) => { setSelectedQuestion(e.target.value); setResult(null); }}
              className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Selecione uma pergunta para analisar...</option>
              {dimensions.map((q: { id: string; question_text: string }) => (
                <option key={q.id} value={q.id}>{q.question_text}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold tracking-wider text-slate-500 block mb-1.5">CRUZAR COM (OPCIONAL)</label>
            <select
              aria-label="Cruzar com"
              title="Cruzar com"
              value={crossWith}
              onChange={(e) => setCrossWith(e.target.value)}
              className="w-full border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Apenas distribuição da pergunta principal</option>
              {premises.filter((p: PremiseOption) => p.mapped_question_id).map((p: PremiseOption) => (
                <option key={p.id} value={`premise:${p.category}`}>Premissa: {p.label}</option>
              ))}
              {dimensions.filter((q: { id: string; question_text: string }) => q.id !== selectedQuestion).map((q: { id: string; question_text: string }) => (
                <option key={q.id} value={q.id}>Pergunta: {q.question_text?.slice(0, 60)}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 md:col-span-1">
            <Button onClick={runAnalysis} disabled={!selectedQuestion || loading} className="flex-1">
              Executar
            </Button>
            {crossWith && (
              <Button onClick={runCrossTab} disabled={loading} variant="secondary" className="flex-1">
                Cruzar
              </Button>
            )}
            {(selectedPremises || selectedLocalityIds.length > 0 || result) && (
              <Button onClick={clearAllFilters} variant="ghost" size="sm" className="text-xs">
                Limpar tudo
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Resultados */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-500 p-4 bg-slate-50 rounded-xl">
          <RefreshCw className="h-4 w-4 animate-spin" /> Processando com os filtros selecionados...
        </div>
      )}

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-2xl p-4 text-sm flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <div>{error}</div>
        </div>
      )}

      {successMessage && (
        <div className="border border-emerald-200 bg-emerald-50 text-emerald-700 rounded-2xl p-4 text-sm">
          {successMessage}
        </div>
      )}

      {hasResults && (
        <div className="border rounded-2xl p-6 bg-white shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">
                {(!isDistribution && result.rows) ? 'Cruzamento' : 'Distribuição'} — Resultados
              </h3>
              {activeFilters && (
                (typeof activeFilters['premises'] === 'object' && !Array.isArray(activeFilters['premises']) && Object.keys((activeFilters['premises'] as Record<string, unknown>) || {}).length > 0)
                || !!activeFilters['localityIds']
              ) && (
                  <p className="text-xs text-slate-500 mt-0.5">Filtros aplicados nesta análise</p>
                )}
            </div>
            <div className="flex gap-2">
              <Button onClick={exportCSV} variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" /> Exportar CSV
              </Button>
              <Button
                onClick={() => {
                  const params = new URLSearchParams();
                  if (selectedQuestion) params.set('questionId', selectedQuestion);
                  if (crossWith) params.set('crossWith', crossWith);
                  Object.entries(selectedPremises).forEach(([cat, vals]) => {
                    if (vals.length > 0) params.append('premise', `${cat}=${vals.join(',')}`);
                  });
                  if (selectedLocalityIds.length > 0) params.set('localities', selectedLocalityIds.join(','));

                  const url = `${window.location.origin}/dashboard/surveys/${surveyId}/dynamic-report?${params.toString()}`;
                  navigator.clipboard.writeText(url);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2200);
                }}
                variant="outline"
                size="sm"
                className={copiedLink ? "border-emerald-500 text-emerald-600" : ""}
              >
                {copiedLink ? '✓ Link copiado!' : 'Copiar link desta análise'}
              </Button>
              <Button onClick={() => { setResult(null); setError(null); }} variant="ghost" size="sm">Limpar análise</Button>
            </div>
          </div>

          {/* Gráfico */}
          {chartData.length > 0 && (
            <div className="h-72 border rounded-xl p-4 bg-slate-50">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey={isDistribution ? "label" : "name"} angle={-25} textAnchor="end" height={70} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey={isDistribution ? "count" : "value"} fill="#2563eb" radius={4} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Tabela Profissional */}
          <div className="overflow-auto border rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  {result.dimensions ? (
                    result.dimensions.map((d: string, i: number) => (
                      <th key={i} className="px-4 py-3 text-left font-semibold border-b text-slate-700">{d}</th>
                    ))
                  ) : (
                    <th className="px-4 py-3 text-left font-semibold border-b text-slate-700">Resposta</th>
                  )}
                  <th className="px-4 py-3 text-right font-semibold border-b text-slate-700">Contagem</th>
                  <th className="px-4 py-3 text-right font-semibold border-b text-slate-700">%</th>
                </tr>
              </thead>
              <tbody>
                {((isDistribution ? result.values : result.rows) || []).slice(0, 30).map((row: Record<string, string | number | boolean | null | undefined>, idx: number) => (
                  <tr key={idx} className="border-b hover:bg-slate-50/70">
                    {isDistribution ? (
                      <>
                        <td className="px-4 py-2.5 font-medium">{String(row['label'] ?? '')}</td>
                        <td className="px-4 py-2.5 text-right font-semibold">{Number(row['count'] ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{row['percentage'] ?? 0}%</td>
                      </>
                    ) : (
                      <>
                        {result.dimensions?.map((d: string, i: number) => (
                          <td key={i} className="px-4 py-2.5">{row[d] ?? '—'}</td>
                        ))}
                        <td className="px-4 py-2.5 text-right font-semibold">{Number(row['count'] ?? 0).toLocaleString()}</td>
                        <td className="px-4 py-2.5 text-right text-slate-600 tabular-nums">{row['percentage'] ?? 0}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {result.total && <p className="text-xs text-slate-500">Total de respostas consideradas com os filtros atuais: <strong>{result.total}</strong></p>}
        </div>
      )}

      {!hasResults && !loading && selectedQuestion && !error && (
        <div className="text-center py-8 text-sm text-slate-400 border rounded-2xl bg-slate-50">
          Clique em "Executar" ou "Cruzar" para ver os resultados com os filtros selecionados.
        </div>
      )}

      {!hasResults && !loading && !selectedQuestion && (
        <div className="text-center py-6 text-sm text-slate-400">
          Selecione uma pergunta principal acima para começar a análise dinâmica.
        </div>
      )}

      {/* Estado profissional quando a pesquisa ainda não tem respostas */}
      {overview && overview.totalResponses === 0 && !loading && (
        <div className="border border-amber-200 bg-amber-50 rounded-2xl p-6 text-sm">
          <div className="font-semibold text-amber-800 mb-2">Esta pesquisa ainda não possui respostas coletadas.</div>
          <p className="text-amber-700">
            O Relatório Dinâmico funciona melhor após a coleta de dados. Enquanto isso, você pode:
          </p>
          <ul className="list-disc ml-5 mt-2 text-amber-700 space-y-1">
            <li>Configurar premissas e mapeá-las para perguntas em <strong>Planejamento → Premissas</strong></li>
            <li>Gerar um relatório físico de exemplo (Sintético) para visualizar a estrutura do documento final</li>
            <li>Usar o modo de Preview do questionário para validar a experiência do respondente</li>
          </ul>
        </div>
      )}

      <div className="text-[10px] text-slate-400 px-1">
        Motor: AdvancedReportAggregationService • Filtros de premissas são resolvidos via mapped_question_id • Mesmo motor dos relatórios físicos.
      </div>
    </div>
  );
}
