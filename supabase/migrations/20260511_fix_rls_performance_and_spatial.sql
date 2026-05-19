-- ============================================================================
-- FIX: RLS Performance (Auth Initialization Plan) + spatial_ref_sys
-- Substitui auth.uid() direto por (select auth.uid()) nas policies RLS
-- para permitir que o Postgres faÃ§a cache do valor e melhore performance.
-- Habilita RLS na tabela PostGIS spatial_ref_sys (read-only para todos).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. spatial_ref_sys: RLS - skipped (requires superuser/owner permission)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 2. USERS - recriar policies usando (select auth.uid())
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy" ON public.users
FOR UPDATE
USING (
    tenant_id = public.get_user_tenant_id()
    AND (
        id = (SELECT auth.uid())
        OR public.is_admin()
    )
)
WITH CHECK (
    tenant_id = public.get_user_tenant_id()
);

DROP POLICY IF EXISTS "users_delete_policy" ON public.users;
CREATE POLICY "users_delete_policy" ON public.users
FOR DELETE
USING (
    tenant_id = public.get_user_tenant_id()
    AND public.is_admin()
    AND id != (SELECT auth.uid())
);

-- ----------------------------------------------------------------------------
-- 3. SURVEYS - recriar policies usando (select auth.uid())
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "surveys_insert_policy" ON public.surveys;
CREATE POLICY "surveys_insert_policy" ON public.surveys
FOR INSERT
WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND public.is_manager_or_admin()
    AND created_by = (SELECT auth.uid())
);

DROP POLICY IF EXISTS "surveys_update_policy" ON public.surveys;
CREATE POLICY "surveys_update_policy" ON public.surveys
FOR UPDATE
USING (
    tenant_id = public.get_user_tenant_id()
    AND (
        created_by = (SELECT auth.uid())
        OR public.is_admin()
    )
)
WITH CHECK (
    tenant_id = public.get_user_tenant_id()
);

-- ----------------------------------------------------------------------------
-- 4. RESPONSES - recriar policies usando (select auth.uid())
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "responses_insert_policy" ON public.responses;
CREATE POLICY "responses_insert_policy" ON public.responses
FOR INSERT
WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND interviewer_id = (SELECT auth.uid())
    AND EXISTS (
        SELECT 1 FROM public.surveys
        WHERE
            id = survey_id
            AND tenant_id = public.get_user_tenant_id()
            AND status = 'active'
    )
);

DROP POLICY IF EXISTS "responses_update_policy" ON public.responses;
CREATE POLICY "responses_update_policy" ON public.responses
FOR UPDATE
USING (
    tenant_id = public.get_user_tenant_id()
    AND (
        interviewer_id = (SELECT auth.uid())
        OR public.is_manager_or_admin()
    )
)
WITH CHECK (
    tenant_id = public.get_user_tenant_id()
);

-- ----------------------------------------------------------------------------
-- 5. RESPONSE_ANSWERS - recriar policies usando (select auth.uid())
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "answers_insert_policy" ON public.response_answers;
CREATE POLICY "answers_insert_policy" ON public.response_answers
FOR INSERT
WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND EXISTS (
        SELECT 1 FROM public.responses
        WHERE
            id = response_id
            AND tenant_id = public.get_user_tenant_id()
            AND interviewer_id = (SELECT auth.uid())
    )
);

DROP POLICY IF EXISTS "answers_update_policy" ON public.response_answers;
CREATE POLICY "answers_update_policy" ON public.response_answers
FOR UPDATE
USING (
    tenant_id = public.get_user_tenant_id()
    AND (
        EXISTS (
            SELECT 1 FROM public.responses
            WHERE
                id = response_id
                AND interviewer_id = (SELECT auth.uid())
        )
        OR public.is_manager_or_admin()
    )
);

-- ----------------------------------------------------------------------------
-- 6. SYNC_LOG - recriar policy usando (select auth.uid())
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "sync_log_insert_policy" ON public.sync_log;
CREATE POLICY "sync_log_insert_policy" ON public.sync_log
FOR INSERT
WITH CHECK (
    tenant_id = public.get_user_tenant_id()
    AND (user_id = (SELECT auth.uid()) OR user_id IS NULL)
);

-- ----------------------------------------------------------------------------
-- 7. FunÃ§Ãµes auxiliares: usar (select auth.uid()) internamente para cache
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_tenant UUID;
BEGIN
  SELECT tenant_id INTO user_tenant
  FROM public.users
  WHERE id = (select auth.uid());
  RETURN user_tenant;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = (select auth.uid());
  RETURN user_role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = (select auth.uid());
  RETURN user_role IN ('admin', 'manager');
END;
$$;
