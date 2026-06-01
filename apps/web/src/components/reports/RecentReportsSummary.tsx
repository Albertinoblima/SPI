'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface RecentReportsSummaryProps {
  surveyId: string;
}

export function RecentReportsSummary({ surveyId }: RecentReportsSummaryProps) {
  const [jobs, setJobs] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const fetchRecent = async () => {
      setHasError(false);
      try {
        const res = await fetch(`/api/reports/${surveyId}/jobs?limit=3`);
        if (res.ok) {
          const data = await res.json();
          setJobs(data.jobs || []);
        } else {
          setHasError(true);
        }
      } catch {
        setHasError(true);
      }
      setLoading(false);
    };
    fetchRecent();
  }, [surveyId]);

  if (loading) return null;

  if (hasError) {
    return (
      <div className="mt-3 text-xs text-gray-400">
        Não foi possível carregar o histórico recente de relatórios.
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="mt-3 text-xs flex flex-wrap items-center gap-2 text-gray-500">
        <span>Nenhum relatório gerado ainda.</span>
        <Link
          href={`/dashboard/surveys/${surveyId}/dynamic-report`}
          className="text-indigo-600 hover:underline font-medium"
        >
          Iniciar com Relatório Dinâmico
        </Link>
        <span className="text-gray-300">•</span>
        <Link
          href={`/dashboard/surveys/${surveyId}/reports`}
          className="text-emerald-600 hover:underline font-medium"
        >
          Ir para Relatórios Físicos
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-3 text-xs">
      <div className="flex items-center gap-2 text-gray-500 mb-1.5">
        <span className="font-medium">Relatórios recentes:</span>
        <Link
          href={`/dashboard/surveys/${surveyId}/reports`}
          className="text-emerald-600 hover:underline font-medium"
        >
          Ver histórico completo
        </Link>
        <Link
          href={`/dashboard/surveys/${surveyId}/dynamic-report`}
          className="text-indigo-600 hover:underline font-medium"
        >
          Abrir Dinâmico
        </Link>
        <button
          onClick={() => window.location.reload()}
          className="text-gray-400 hover:text-gray-600 text-[10px] underline"
        >
          Atualizar
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {jobs.map((job: Record<string, unknown>) => {
          const reportType = job['report_type'] as string | undefined;
          const typeLabel = reportType === 'consolidated' ? 'Consolidado'
            : reportType === 'analytical' ? 'Analítico'
              : 'Sintético';
          const createdAtStr = job['created_at'] as string | undefined;
          const isRecent = createdAtStr ? new Date(createdAtStr) > new Date(Date.now() - 1000 * 60 * 60 * 24 * 2) : false;

          return (
            <Link
              key={job['id'] as string}
              href={`/dashboard/surveys/${surveyId}/reports`}
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs transition border ${isRecent ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
              <span className="font-medium">{typeLabel}</span>
              <span className="text-gray-400">•</span>
              <span>{createdAtStr ? new Date(createdAtStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}</span>
              {Boolean(job['ai_insights_enabled']) && <span className="ml-0.5 text-[10px] text-amber-600">+IA</span>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
