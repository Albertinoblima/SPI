'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, AlertTriangle, Clock, FileText } from 'lucide-react';

interface ReportJob {
  id: string;
  survey_id: string;
  report_type: 'synthetic' | 'analytical' | 'consolidated';
  status: string;
  file_size_bytes?: number;
  processing_duration_seconds?: number;
  ai_insights_enabled?: boolean;
  ai_model_used?: string;
  ai_tokens_used?: number;
  ai_cost_usd?: number;
  download_count?: number;
  max_downloads?: number;
  expires_at?: string;
  created_at: string;
  completed_at?: string;
}

interface ReportHistoryListProps {
  surveyId: string;
}

export function ReportHistoryList({ surveyId }: ReportHistoryListProps) {
  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchJobs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${surveyId}/jobs?limit=20`);
      if (!res.ok) throw new Error('Falha ao carregar histórico');
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar histórico de relatórios';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [surveyId]);

  const handleDownload = async (job: ReportJob) => {
    try {
      const res = await fetch(`/api/reports/${surveyId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.id, action: 'get-download' }),
      });

      if (!res.ok) throw new Error();
      // The actual download flow goes through the generate endpoint which returns a fresh link.
      // For now we give clear guidance (this can be improved with a dedicated download route later).
      setError('Para baixar novamente, gere um novo link na seção "Gerar Novo Relatório". Os links antigos expiram por segurança.');
    } catch {
      setError('Use a seção de geração para obter um novo link seguro de download.');
    }
  };

  const handleRevoke = async (jobId: string) => {
    if (!confirm('Revogar este link? O relatório não poderá mais ser baixado com o link atual.')) return;

    setRevoking(jobId);
    try {
      const res = await fetch(`/api/reports/${surveyId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke', jobId }),
      });

      if (res.ok) {
        await fetchJobs();
      } else {
        setError('Não foi possível revogar o link.');
      }
    } catch {
      setError('Erro ao revogar.');
    } finally {
      setRevoking(null);
    }
  };

  // Clear transient messages when user interacts
  const clearMessages = () => setError(null);

  const formatType = (type: string) => {
    const map: Record<string, string> = {
      synthetic: 'Sintético',
      analytical: 'Analítico',
      consolidated: 'Consolidado',
    };
    return map[type] || type;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '—';
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="border rounded-xl p-6 bg-white">
        <div className="flex items-center gap-2 text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Carregando histórico de relatórios...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border rounded-xl p-6 bg-white">
        <div className="text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
        <Button onClick={fetchJobs} variant="outline" size="sm" className="mt-3">Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="border rounded-xl bg-white shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Histórico de Relatórios Gerados
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Relatórios físicos (DOCX/PDF) gerados anteriormente. Links são temporários por segurança.</p>
        </div>
        <Button onClick={fetchJobs} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
        </Button>
      </div>

      {jobs.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500">
          Nenhum relatório físico gerado ainda para esta pesquisa.<br /><br />
          <span className="text-slate-600">
            Recomendação: Comece explorando os dados com filtros em tempo real no{' '}
            <a href={`/dashboard/surveys/${surveyId}/dynamic-report`} className="font-semibold text-indigo-600 hover:underline">
              Relatório Dinâmico
            </a>{' '}
            e depois gere o documento físico completo com um clique.
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left">
                <th className="px-6 py-3 font-medium text-slate-600">Tipo</th>
                <th className="px-4 py-3 font-medium text-slate-600">Gerado em</th>
                <th className="px-4 py-3 font-medium text-slate-600">Status</th>
                <th className="px-4 py-3 font-medium text-slate-600">Tamanho</th>
                <th className="px-4 py-3 font-medium text-slate-600">IA / Custo</th>
                <th className="px-4 py-3 font-medium text-slate-600">Downloads</th>
                <th className="px-6 py-3 font-medium text-slate-600 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => {
                const isExpired = job.expires_at && new Date(job.expires_at) < new Date();
                const isReady = job.status === 'ready';

                return (
                  <tr key={job.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium">{formatType(job.report_type)}</td>
                    <td className="px-4 py-4 text-slate-600 text-xs">
                      {formatDate(job.created_at)}
                      {job.processing_duration_seconds && (
                        <span className="block text-[10px] text-slate-400">Processado em {job.processing_duration_seconds}s</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${job.status === 'ready' ? 'bg-emerald-100 text-emerald-700' :
                          job.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                        }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">{formatSize(job.file_size_bytes)}</td>
                    <td className="px-4 py-4 text-xs">
                      {job.ai_insights_enabled ? (
                        <span className="text-amber-700">
                          {job.ai_model_used?.slice(0, 12)} • {job.ai_tokens_used || 0} tokens<br />
                          <span className="text-[10px]">${(job.ai_cost_usd || 0).toFixed(3)}</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-600">
                      {job.download_count || 0} / {job.max_downloads || 8}
                      {isExpired && <span className="ml-1 text-red-500">(expirado)</span>}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {isReady && !isExpired ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(job)}
                            className="text-xs h-7"
                          >
                            <Download className="h-3 w-3 mr-1" /> Baixar
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevoke(job.id)}
                            disabled={revoking === job.id}
                            className="text-xs h-7 text-red-600 hover:text-red-700"
                          >
                            {revoking === job.id ? 'Revogando...' : 'Revogar'}
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-slate-400 flex items-center gap-1 justify-end">
                          <Clock className="h-3 w-3" /> Indisponível
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="px-6 py-3 border-t bg-slate-50 text-[10px] text-slate-500">
        Links de download expiram automaticamente por segurança (máximo 8 downloads por arquivo).
        Relatórios com IA mostram consumo exato de tokens e custo estimado.
      </div>
    </div>
  );
}
