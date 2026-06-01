-- ============================================================================
-- RELATÓRIOS PROFISSIONAIS - FUNDAÇÃO (Fase 0)
-- Data: 2026-05-30
-- Autor: Arquitetura Sênior
-- Objetivo:
--   1. Permitir mapeamento explícito de premissas (survey_premises) para perguntas reais do questionário.
--   2. Criar infraestrutura robusta para geração assíncrona de relatórios grandes (.docx/.pdf).
--   3. Garantir segurança, auditabilidade e escalabilidade no download de relatórios pesados.
--   4. Corrigir inconsistências do schema anterior de relatórios.
-- ============================================================================

-- ============================================================================
-- 1. MAPEAMENTO DE PREMISSAS PARA PERGUNTAS (Melhor Prática Profissional)
-- ============================================================================
-- Permite que o pesquisador declare explicitamente:
-- "A premissa 'Sexo' é respondida pela pergunta com id = X"
--
-- Isso é fundamental para cruzamentos profissionais confiáveis,
-- pois os dados demográficos vivem em response_answers.question_id.

ALTER TABLE public.survey_premises
ADD COLUMN IF NOT EXISTS mapped_question_id UUID REFERENCES public.questions (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.survey_premises.mapped_question_id IS
'ID da pergunta do questionário que captura os dados desta premissa (ex: a pergunta "Qual o seu sexo?"). 
Essencial para cruzamentos analíticos profissionais. Pode ser nulo durante planejamento.';

CREATE INDEX IF NOT EXISTS idx_survey_premises_mapped_question 
ON public.survey_premises (survey_id, mapped_question_id) 
WHERE mapped_question_id IS NOT NULL;

-- ============================================================================
-- 2. TABELA DE JOBS DE GERAÇÃO DE RELATÓRIOS (Assíncrono + Seguro)
-- ============================================================================
-- Esta tabela é o coração da estratégia de relatórios profissionais grandes.
-- Permite:
--   - Geração em background (evita timeout e consumo excessivo de memória)
--   - Download seguro via presigned URLs de curta duração
--   - Auditoria completa de geração e downloads
--   - Notificação por e-mail quando relatórios muito grandes ficarem prontos
--   - Controle de expiração e revogação de links

CREATE TABLE IF NOT EXISTS public.report_generation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    report_configuration_id UUID REFERENCES public.report_configurations (id) ON DELETE SET NULL,

    -- Quem solicitou e contexto
    requested_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    report_type TEXT NOT NULL CHECK (report_type IN ('synthetic', 'analytical', 'consolidated')),

    -- Configuração usada na geração (snapshot)
    configuration_snapshot JSONB,

    -- Controle de ciclo de vida do job
    status TEXT NOT NULL DEFAULT 'queued' 
        CHECK (status IN ('queued', 'processing', 'ready', 'failed', 'expired', 'cancelled')),
    progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),

    -- Resultado do arquivo gerado
    file_path TEXT,                    -- caminho no Storage (ex: reports/tenant_id/job_id/relatorio.docx)
    file_size_bytes BIGINT,
    mime_type TEXT DEFAULT 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    storage_bucket TEXT DEFAULT 'reports-generated',

    -- Segurança e expiração
    download_token_hash TEXT,          -- hash do token usado para presigned URL (opcional)
    expires_at TIMESTAMPTZ,            -- quando o link de download expira
    max_downloads INTEGER DEFAULT 10,  -- limite de downloads (proteção)
    download_count INTEGER DEFAULT 0,

    -- Metadados de execução
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_duration_seconds INTEGER,
    error_message TEXT,
    error_code TEXT,

    -- Rastreabilidade
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT report_generation_jobs_file_path_required_when_ready 
        CHECK (status != 'ready' OR file_path IS NOT NULL)
);

-- Índices estratégicos para performance e consultas comuns
CREATE INDEX IF NOT EXISTS idx_report_jobs_tenant_status ON public.report_generation_jobs (tenant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_jobs_survey ON public.report_generation_jobs (survey_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_report_jobs_requested_by ON public.report_generation_jobs (requested_by);
CREATE INDEX IF NOT EXISTS idx_report_jobs_expires_at ON public.report_generation_jobs (expires_at) WHERE status = 'ready';
CREATE INDEX IF NOT EXISTS idx_report_jobs_status ON public.report_generation_jobs (status);

COMMENT ON TABLE public.report_generation_jobs IS 
'Tabela central para geração assíncrona de relatórios profissionais. 
Permite criar documentos grandes sem bloquear o usuário, com download seguro via Storage + presigned URLs de curta duração.';

COMMENT ON COLUMN public.report_generation_jobs.configuration_snapshot IS 
'Foto da configuração usada na geração (selectedCrossings, filtros, premissas escolhidas, etc). Importante para reprodutibilidade e auditoria.';

COMMENT ON COLUMN public.report_generation_jobs.max_downloads IS 
'Limite de downloads permitidos para este arquivo gerado. Proteção contra compartilhamento indevido.';

-- Trigger para updated_at (reutiliza função existente do projeto)
CREATE TRIGGER update_report_generation_jobs_updated_at 
    BEFORE UPDATE ON public.report_generation_jobs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. CORREÇÕES E MELHORIAS NO SCHEMA DE RELATÓRIOS EXISTENTE
-- ============================================================================

-- 3.1 Tornar report_configuration_id nullable em report_shares
-- Motivo: O código atual permite criar shares sem uma configuração salva.
-- O schema original tinha NOT NULL, gerando inconsistência.
ALTER TABLE public.report_shares 
ALTER COLUMN report_configuration_id DROP NOT NULL;

COMMENT ON COLUMN public.report_shares.report_configuration_id IS 
'Referência opcional à configuração salva do relatório. 
Pode ser nulo quando o share é criado diretamente sem configuração persistida.';

-- 3.2 Adicionar colunas úteis para rastreamento de downloads em report_shares
ALTER TABLE public.report_shares 
ADD COLUMN IF NOT EXISTS last_downloaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_report_shares_last_downloaded 
ON public.report_shares (last_downloaded_at DESC) WHERE is_active = true;

-- 3.3 Melhorias na tabela report_access_logs (já existia, mas vamos enriquecer)
ALTER TABLE public.report_access_logs 
ADD COLUMN IF NOT EXISTS report_generation_job_id UUID REFERENCES public.report_generation_jobs (id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
ADD COLUMN IF NOT EXISTS download_method TEXT; -- 'direct', 'presigned_url', 'email_link'

CREATE INDEX IF NOT EXISTS idx_report_access_logs_job 
ON public.report_access_logs (report_generation_job_id);

-- ============================================================================
-- 4. ÍNDICES ADICIONAIS DE PERFORMANCE PARA AGREGACÕES DE RELATÓRIOS
-- ============================================================================

-- Facilita queries de cruzamentos filtrados por survey
CREATE INDEX IF NOT EXISTS idx_response_answers_survey_question 
ON public.response_answers (survey_id, question_id);

-- Útil para filtros por data de resposta (comum em relatórios)
CREATE INDEX IF NOT EXISTS idx_responses_survey_completed_at 
ON public.responses (survey_id, completed_at) 
WHERE is_complete = true AND deleted_at IS NULL;

-- ============================================================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO DE SCHEMA
-- ============================================================================

COMMENT ON TABLE public.report_generation_jobs IS 
'Jobs de geração assíncrona de relatórios. 
Permite que relatórios grandes (com dezenas de gráficos em alta resolução) sejam gerados em background 
e entregues via links seguros de curta duração. Essencial para experiência profissional.';

COMMENT ON COLUMN public.survey_premises.mapped_question_id IS 
'Mapeamento explícito: qual pergunta do questionário representa esta premissa para fins de cruzamento.
Esta é a abordagem profissional recomendada para garantir que os cruzamentos usem os dados reais coletados.';

-- ============================================================================
-- FIM DA MIGRATION - FASE 0 DE RELATÓRIOS PROFISSIONAIS
-- ============================================================================