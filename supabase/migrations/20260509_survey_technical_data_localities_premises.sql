-- ============================================================================
-- MIGRATION: 20260509_survey_technical_data_localities_premises.sql
-- DescriÃ§Ã£o: Campos tÃ©cnicos da pesquisa, tabelas de localidades e premissas
-- Data: 2026-05-09
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PARTE 1: CAMPOS TÃ‰CNICOS NA TABELA SURVEYS
-- ============================================================================

ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS survey_type VARCHAR(50);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS margin_of_error DECIMAL(5, 2);
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS confidence_interval INTEGER;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS methodology TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS target_audience TEXT;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS total_interviews INTEGER;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE public.surveys ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

COMMENT ON COLUMN public.surveys.survey_type IS 'Tipo: eleitoral, satisfacao, censo, opiniao, outros';
COMMENT ON COLUMN public.surveys.margin_of_error IS 'Margem de erro em % (ex: 3.5)';
COMMENT ON COLUMN public.surveys.confidence_interval IS 'Intervalo de confianÃ§a em % (ex: 95)';
COMMENT ON COLUMN public.surveys.total_interviews IS 'Total calculado de entrevistas necessÃ¡rias';

-- ============================================================================
-- PARTE 2: TABELA DE LOCALIDADES DA PESQUISA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.survey_localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    zone VARCHAR(10) NOT NULL CHECK (zone IN ('urban', 'rural', 'mixed')),
    population INTEGER NOT NULL,
    population_type VARCHAR(20) DEFAULT 'voters' CHECK (population_type IN ('voters', 'inhabitants')),
    interviews_required INTEGER,
    interviews_weight DECIMAL(5, 4),

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_localities_survey ON public.survey_localities (survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_localities_tenant ON public.survey_localities (tenant_id);

-- ============================================================================
-- PARTE 3: TABELA DE PREMISSAS DA PESQUISA (PERFIL DO ENTREVISTADO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.survey_premises (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

    category VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    options JSONB NOT NULL DEFAULT '[]',
    is_required BOOLEAN DEFAULT TRUE,
    allow_multiple BOOLEAN DEFAULT FALSE,
    order_index INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_premises_survey ON public.survey_premises (survey_id, order_index);
CREATE INDEX IF NOT EXISTS idx_survey_premises_tenant ON public.survey_premises (tenant_id);

COMMENT ON TABLE public.survey_premises IS 'Premissas/cotas do entrevistado: faixa etÃ¡ria, sexo, escolaridade, etc.';
COMMENT ON COLUMN public.survey_premises.options IS 'Array de opÃ§Ãµes: [{"label":"Masculino","value":"M","quota_pct":50}]';
