-- ============================================================================
-- MIGRATION: 20260521000001_finalize_survey_workflow.sql
-- Descricao: Fecha fluxo web/mobile das etapas 6, 7, 8 e publicacao da pesquisa
-- Data: 2026-05-21
-- ============================================================================

-- Permite status publicado sem quebrar compatibilidade com status active.
ALTER TABLE public.surveys
    DROP CONSTRAINT IF EXISTS surveys_status_check;

ALTER TABLE public.surveys
    ADD CONSTRAINT surveys_status_check
    CHECK (status IN ('draft', 'active', 'published', 'paused', 'closed'));

ALTER TABLE public.surveys
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- ============================================================================
-- ETAPA 6: equipe por pesquisa
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.survey_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT survey_team_members_role_check
        CHECK (role IN ('coordinator', 'supervisor', 'interviewer')),
    CONSTRAINT survey_team_members_unique_member
        UNIQUE (survey_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_team_members_survey
    ON public.survey_team_members (survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_team_members_tenant
    ON public.survey_team_members (tenant_id);
CREATE INDEX IF NOT EXISTS idx_survey_team_members_role
    ON public.survey_team_members (survey_id, role, is_active);

-- ============================================================================
-- ETAPA 7: rotas e localidades por rota
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.survey_routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    zone VARCHAR(20) NOT NULL,
    route_number INTEGER NOT NULL,
    route_name VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT survey_routes_zone_check
        CHECK (zone IN ('urban', 'rural', 'mixed')),
    CONSTRAINT survey_routes_unique_number
        UNIQUE (survey_id, zone, route_number)
);

CREATE TABLE IF NOT EXISTS public.survey_route_localities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.survey_routes (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    locality_id UUID NOT NULL REFERENCES public.survey_localities (id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT survey_route_localities_unique_locality
        UNIQUE (route_id, locality_id),
    CONSTRAINT survey_route_localities_unique_order
        UNIQUE (route_id, order_index)
);

CREATE INDEX IF NOT EXISTS idx_survey_routes_survey
    ON public.survey_routes (survey_id, zone, route_number);
CREATE INDEX IF NOT EXISTS idx_survey_route_localities_route_order
    ON public.survey_route_localities (route_id, order_index);
CREATE INDEX IF NOT EXISTS idx_survey_route_localities_tenant
    ON public.survey_route_localities (tenant_id);

-- ============================================================================
-- ETAPA 8: distribuicao de cotas por entrevistador
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.survey_distribution_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    locality_id UUID NOT NULL REFERENCES public.survey_localities (id) ON DELETE CASCADE,
    zone VARCHAR(20) NOT NULL,
    gender VARCHAR(10) NOT NULL,
    age_group VARCHAR(20) NOT NULL,
    quota_total INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT survey_distribution_quotas_zone_check
        CHECK (zone IN ('urban', 'rural', 'mixed')),
    CONSTRAINT survey_distribution_quotas_quota_non_negative
        CHECK (quota_total >= 0),
    CONSTRAINT survey_distribution_quotas_unique
        UNIQUE (survey_id, interviewer_id, locality_id, zone, gender, age_group)
);

CREATE INDEX IF NOT EXISTS idx_survey_distribution_quotas_survey_interviewer
    ON public.survey_distribution_quotas (survey_id, interviewer_id);
CREATE INDEX IF NOT EXISTS idx_survey_distribution_quotas_locality
    ON public.survey_distribution_quotas (survey_id, locality_id);

-- ============================================================================
-- MOBILE: entrevistas sincronizaveis
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.interviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
    locality_id UUID REFERENCES public.survey_localities (id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    start_latitude DECIMAL(10, 7),
    start_longitude DECIMAL(10, 7),
    photo_path VARCHAR(500),
    signature_name VARCHAR(200),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    synced BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT interviews_status_check
        CHECK (status IN ('in_progress', 'completed', 'synced')),
    CONSTRAINT interviews_duration_non_negative
        CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

CREATE TABLE IF NOT EXISTS public.interview_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    interview_id UUID NOT NULL REFERENCES public.interviews (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions (id) ON DELETE CASCADE,
    answer_text TEXT,
    answer_option JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_interviews_interviewer_synced
    ON public.interviews (interviewer_id, synced);
CREATE INDEX IF NOT EXISTS idx_interviews_survey_status
    ON public.interviews (survey_id, status);
CREATE INDEX IF NOT EXISTS idx_interview_answers_interview
    ON public.interview_answers (interview_id);

-- ============================================================================
-- RLS basico para novas tabelas
-- ============================================================================
ALTER TABLE public.survey_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_route_localities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_distribution_quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS survey_team_members_tenant_policy ON public.survey_team_members;
CREATE POLICY survey_team_members_tenant_policy
ON public.survey_team_members
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS survey_routes_tenant_policy ON public.survey_routes;
CREATE POLICY survey_routes_tenant_policy
ON public.survey_routes
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS survey_route_localities_tenant_policy ON public.survey_route_localities;
CREATE POLICY survey_route_localities_tenant_policy
ON public.survey_route_localities
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS survey_distribution_quotas_tenant_policy ON public.survey_distribution_quotas;
CREATE POLICY survey_distribution_quotas_tenant_policy
ON public.survey_distribution_quotas
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS interviews_access_policy ON public.interviews;
CREATE POLICY interviews_access_policy
ON public.interviews
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS interview_answers_access_policy ON public.interview_answers;
CREATE POLICY interview_answers_access_policy
ON public.interview_answers
FOR ALL
USING (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
);
