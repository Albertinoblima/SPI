-- ============================================================================
-- MIGRATION: 20260517000002_rls_policies_survey_localities_premises.sql
-- Descrição: Cria políticas RLS para survey_localities e survey_premises.
--            Ambas as tabelas têm RLS habilitado, mas estavam sem policies,
--            o que bloqueava silenciosamente o SELECT via cliente autenticado.
-- ============================================================================

-- survey_localities: isolamento por tenant (leitura, escrita e exclusão)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'survey_localities'
          AND policyname = 'survey_localities_isolation_policy'
    ) THEN
        CREATE POLICY survey_localities_isolation_policy
            ON public.survey_localities
            FOR ALL
            USING (tenant_id = get_user_tenant_id());
    END IF;
END
$$;

-- survey_premises: isolamento por tenant (leitura, escrita e exclusão)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename  = 'survey_premises'
          AND policyname = 'survey_premises_isolation_policy'
    ) THEN
        CREATE POLICY survey_premises_isolation_policy
            ON public.survey_premises
            FOR ALL
            USING (tenant_id = get_user_tenant_id());
    END IF;
END
$$;
