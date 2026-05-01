-- ============================================================================
-- MIGRATION: 20260505_fix_users_select_policy_for_system_admin.sql
-- Descricao: Corrige RLS de users para permitir que usuario autenticado leia
--            o proprio registro (necessario para system_admin sem tenant)
-- ============================================================================

DROP POLICY IF EXISTS "users_select_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users
FOR SELECT
USING (
  id = auth.uid()
  OR tenant_id = public.get_user_tenant_id()
);
