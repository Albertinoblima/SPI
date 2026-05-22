-- Hotfix: garantir existencia de survey_team_members para ambientes sem migration completa
-- Mantem padrao atual do projeto (UUID + tenant_id)

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
CREATE INDEX IF NOT EXISTS idx_survey_team_members_user
    ON public.survey_team_members (user_id);
CREATE INDEX IF NOT EXISTS idx_survey_team_members_tenant
    ON public.survey_team_members (tenant_id);
