-- ============================================================================
-- RELATÓRIOS PROFISSIONAIS - GOVERNANÇA DE USO DE IA (Fase 4)
-- Data: 2026-06-01
-- Autor: Arquitetura Sênior
-- Objetivo:
--   1. Adicionar colunas de rastreamento de uso de IA nos jobs de relatórios.
--   2. Permitir auditoria completa de custos, tokens e modelo utilizado.
--   3. Preparar para governança forte (política de uso, alertas de custo, relatórios de consumo).
-- ============================================================================

-- ============================================================================
-- ADIÇÃO DE COLUNAS DE GOVERNANÇA DE IA EM report_generation_jobs
-- ============================================================================
-- Estas colunas só são preenchidas quando:
--   - report_type = 'consolidated'  AND
--   - useAIInsights = true no snapshot de configuração
--
-- Mantemos tudo opcional (nullable) para não quebrar jobs existentes.

ALTER TABLE public.report_generation_jobs
  ADD COLUMN IF NOT EXISTS ai_insights_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_model_used TEXT,
  ADD COLUMN IF NOT EXISTS ai_tokens_used INTEGER,
  ADD COLUMN IF NOT EXISTS ai_cost_usd NUMERIC(10, 4),
  ADD COLUMN IF NOT EXISTS ai_generation_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS insights_generated_at TIMESTAMPTZ;

-- Comentários explicativos (profissionalismo e documentação viva)
COMMENT ON COLUMN public.report_generation_jobs.ai_insights_enabled IS
'Flag que indica se o usuário optou por gerar insights com LLM (xAI Grok / OpenAI) no momento da solicitação do relatório Consolidado.';

COMMENT ON COLUMN public.report_generation_jobs.ai_model_used IS
'Modelo efetivamente utilizado para gerar os insights (ex: grok-2-latest, gpt-4o-mini). Importante para reprodutibilidade e auditoria.';

COMMENT ON COLUMN public.report_generation_jobs.ai_tokens_used IS
'Número total de tokens consumidos na chamada(s) ao LLM para este relatório. Usado para cálculo de custo e controle de orçamento.';

COMMENT ON COLUMN public.report_generation_jobs.ai_cost_usd IS
'Custo estimado em USD da geração de insights por IA para este job. Preenchido pelo ReportJobService após a chamada ao LLM.';

COMMENT ON COLUMN public.report_generation_jobs.ai_generation_time_ms IS
'Tempo em milissegundos gasto exclusivamente na geração de insights por IA (excluindo agregação de dados e renderização de gráficos).';

COMMENT ON COLUMN public.report_generation_jobs.insights_generated_at IS
'Timestamp de quando os insights (IA ou fallback) foram gerados. Útil para análise de latência e cache futuro.';

-- Índice parcial para consultas de auditoria de consumo de IA (muito comum em governança)
CREATE INDEX IF NOT EXISTS idx_report_jobs_ai_usage 
ON public.report_generation_jobs (created_at DESC) 
WHERE ai_insights_enabled = true;

-- Índice para análise de custo por tenant (útil para dashboards internos de custo)
CREATE INDEX IF NOT EXISTS idx_report_jobs_ai_cost 
ON public.report_generation_jobs (tenant_id, created_at DESC) 
WHERE ai_insights_enabled = true AND ai_cost_usd IS NOT NULL;

-- ============================================================================
-- TABELA OPCIONAL DE LOGS DETALHADOS DE USO DE IA (Preparação futura)
-- ============================================================================
-- Por enquanto comentada. Pode ser ativada em Fase 5 se o volume de relatórios
-- com IA crescer e precisarmos de granularidade por pergunta (não só por job).

/*
CREATE TABLE IF NOT EXISTS public.report_ai_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_generation_job_id UUID NOT NULL REFERENCES public.report_generation_jobs (id) ON DELETE CASCADE,
    survey_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    question_id UUID,
    model TEXT NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    estimated_cost_usd NUMERIC(10,6),
    latency_ms INTEGER,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_usage_logs_job ON public.report_ai_usage_logs (report_generation_job_id);
CREATE INDEX idx_ai_usage_logs_tenant_date ON public.report_ai_usage_logs (tenant_id, created_at DESC);
*/

-- ============================================================================
-- FIM DA MIGRATION - GOVERNANÇA DE IA PARA RELATÓRIOS PROFISSIONAIS
-- ============================================================================
