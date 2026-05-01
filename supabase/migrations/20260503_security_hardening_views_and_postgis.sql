-- ============================================================================
-- MIGRATION: 20260503_security_hardening_views_and_postgis.sql
-- Descricao: Hardening de seguranca para eliminar erros do advisor
-- ============================================================================

-- 1) Views devem executar com privilegios do usuario chamador (SECURITY INVOKER)
ALTER VIEW IF EXISTS public.vw_survey_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_tenant_stats SET (security_invoker = true);
ALTER VIEW IF EXISTS public.vw_system_stats SET (security_invoker = true);

-- 2) Tabela do PostGIS exposta no schema public precisa de RLS habilitado
DO $$
BEGIN
    IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
        BEGIN
            ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

            IF NOT EXISTS (
                SELECT 1 FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename  = 'spatial_ref_sys'
                  AND policyname = 'spatial_ref_sys_read_all'
            ) THEN
                CREATE POLICY spatial_ref_sys_read_all
                    ON public.spatial_ref_sys
                    FOR SELECT
                    USING (true);
            END IF;
        EXCEPTION
            WHEN insufficient_privilege THEN
                RAISE NOTICE 'Sem permissao de owner para alterar public.spatial_ref_sys; ajuste manual necessario no dashboard SQL editor.';
        END;
    END IF;
END
$$;
