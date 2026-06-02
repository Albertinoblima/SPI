'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ReportGeneratorPanel } from '@/components/reports/ReportGeneratorPanel';
import { ReportHistoryList } from '@/components/reports/ReportHistoryList';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type ReportType = 'synthetic' | 'analytical' | 'consolidated';

/**
 * Página de Relatórios Profissionais (Físicos)
 * 
 * Completa:
 * - Geração de Sintético / Analítico / Consolidado com gráficos reais, premissas e IA
 * - Histórico completo com auditoria, custo de IA, revogação e re-download seguro
 */
export default function SurveyReportsPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const surveyId = params.id;

  const [hasJobs, setHasJobs] = useState<boolean | null>(null);

  // Suporte para vir do Relatório Dinâmico com contexto
  const fromDynamic = searchParams.get('from') === 'dynamic';
  const initialType = (searchParams.get('type') as ReportType) || undefined;
  const initialPremises = searchParams.get('premises') ? searchParams.get('premises')!.split(',') : undefined;
  const initialUseAI = searchParams.get('useAI') === 'true';

  const contextMessage = fromDynamic
    ? "Esta geração está pré-configurada com os filtros da sua análise dinâmica recente. Ajuste se necessário e gere o relatório físico."
    : undefined;

  const handleReportGenerated = (url: string) => {
    console.log('Relatório gerado:', url);
  };

  // Verifica se já existem relatórios gerados para decidir se mostra orientação de primeiro uso
  useEffect(() => {
    const checkJobs = async () => {
      try {
        const res = await fetch(`/api/reports/${surveyId}/jobs?limit=1`);
        if (res.ok) {
          const data = await res.json();
          setHasJobs((data.jobs || []).length > 0);
        } else {
          setHasJobs(false);
        }
      } catch {
        setHasJobs(false);
      }
    };
    checkJobs();
  }, [surveyId]);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="mb-2">
        <Link
          href={`/dashboard/surveys/${surveyId}`}
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para a Pesquisa
        </Link>

        <h1 className="text-3xl font-semibold tracking-tight">Relatórios Profissionais</h1>
        <p className="text-slate-600 mt-1 max-w-3xl">
          Gere documentos DOCX ou PDF de alta qualidade com identidade visual, gráficos profissionais por pergunta,
          cruzamentos por premissas mapeadas + localidade, e análises profundas por IA (no tipo Consolidado).
        </p>
      </div>

      {/* Geração + Acesso ao Dinâmico */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Gerar Novo Relatório Físico</h2>
            <p className="text-sm text-slate-500">DOCX ou PDF com identidade visual completa, gráficos e insights.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/surveys/${surveyId}`}
              className="text-sm px-3 py-1.5 rounded-lg border hover:bg-slate-50"
            >
              Configurar Premissas
            </Link>
            <Link
              href={`/dashboard/surveys/${surveyId}/dynamic-report`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50"
            >
              Abrir Relatório Dinâmico
            </Link>
          </div>
        </div>
        <ReportGeneratorPanel
          surveyId={surveyId}
          onGenerated={handleReportGenerated}
          initialReportType={initialType}
          {...(initialPremises ? { initialSelectedPremiseIds: initialPremises } : {})}
          initialUseAIInsights={initialUseAI}
          {...(contextMessage ? { contextMessage } : {})}
        />
      </section>

      {/* Quick stats when there are previous reports */}
      {hasJobs === true && (
        <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between">
          <span>Você já gerou relatórios físicos para esta pesquisa. Use o histórico abaixo para gerenciar downloads e revogar links.</span>
          <Link href={`/dashboard/surveys/${surveyId}/dynamic-report`} className="font-medium hover:underline">
            Fazer nova análise dinâmica →
          </Link>
        </div>
      )}

      {/* Histórico — Fechamento profissional do fluxo de relatórios físicos (segurança + auditoria) */}
      <section>
        <ReportHistoryList surveyId={surveyId} />
      </section>

      {/* Experiência de "primeiro uso" profissional quando ainda não há relatórios gerados */}
      {hasJobs === false && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-2xl p-5 text-center">
          <p className="text-sm text-indigo-800 mb-3 font-medium">
            Ainda não gerou nenhum relatório físico?
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href={`/dashboard/surveys/${surveyId}/dynamic-report`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-medium text-sm"
            >
              Começar pelo Relatório Dinâmico →
            </Link>
            <Link
              href={`/dashboard/surveys/${surveyId}`}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-indigo-600 text-indigo-700 rounded-xl hover:bg-indigo-50 transition font-medium text-sm"
            >
              Configurar Premissas primeiro
            </Link>
          </div>
          <p className="text-[11px] text-indigo-600 mt-2">
            Explore com filtros em tempo real e gere o documento físico completo com um clique.
          </p>
        </div>
      )}

      {/* Dica profissional permanente (ótima experiência mesmo em pesquisas em planejamento) */}
      <div className="text-xs text-slate-500 bg-slate-50 border rounded-xl p-4">
        <strong>Dica para máxima qualidade:</strong> Configure as premissas e faça o mapeamento para as perguntas do questionário (em Planejamento → Premissas) antes da coleta.
        Assim, quando as respostas começarem a chegar, você poderá gerar imediatamente relatórios Analíticos e Consolidados completos com cruzamentos reais.
      </div>

      {/* Link final para o Dinâmico (consistência de navegação) */}
      <div className="text-center">
        <Link
          href={`/dashboard/surveys/${surveyId}/dynamic-report`}
          className="text-sm text-indigo-600 hover:underline font-medium"
        >
          Ou explore os dados em tempo real no Relatório Dinâmico →
        </Link>
      </div>

      <div className="text-xs text-slate-500 border-t pt-4 flex items-center justify-between">
        <span>
          Todos os relatórios seguem os requisitos profissionais aprovados: uma seção por pergunta com números + gráfico adequado,
          tabela de cotas, capa com logo, header/footer com paginação, confidencialidade e links de download seguros de curta duração com limite e auditoria completa (incluindo custo de IA).
        </span>
        <Link href={`/dashboard/surveys/${surveyId}/dynamic-report`} className="text-blue-600 hover:underline font-medium ml-4">
          Experimentar Relatório Dinâmico →
        </Link>
      </div>
    </div>
  );
}