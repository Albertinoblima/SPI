'use client';

import { useParams } from 'next/navigation';
import { DynamicReportPanel } from '@/components/reports/DynamicReportPanel';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

/**
 * Página dedicada ao Relatório Dinâmico (Análise Interativa)
 * 
 * Este é o segundo grande pilar solicitado pelo usuário:
 * - Relatórios Físicos (já concluído com nível profissional)
 * - Relatório Dinâmico com filtros poderosos para cruzamento de dados
 */
export default function DynamicReportPage() {
  const params = useParams<{ id: string }>();
  const surveyId = params.id;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 text-sm mb-2">
          <Link 
            href={`/dashboard/surveys/${surveyId}`} 
            className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para a Pesquisa
          </Link>
          <span className="text-slate-300">•</span>
          <Link 
            href={`/dashboard/surveys/${surveyId}/reports`} 
            className="text-slate-600 hover:text-slate-900"
          >
            Relatórios Físicos
          </Link>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Relatório Dinâmico</h1>
            <p className="text-slate-600 mt-1">Análise interativa em tempo real com filtros por premissas mapeadas e localidade.</p>
          </div>

          <div className="flex gap-2">
            <Link 
              href={`/dashboard/surveys/${surveyId}/reports?from=dynamic`}
              className="text-sm px-4 py-2 rounded-lg border hover:bg-slate-50 font-medium"
            >
              Gerar Relatório Físico
            </Link>
            <Link 
              href={`/dashboard/surveys/${surveyId}/reports`}
              className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-medium"
            >
              Ver Histórico de Relatórios
            </Link>
          </div>
        </div>
      </div>

      <DynamicReportPanel surveyId={surveyId} />
    </div>
  );
}
