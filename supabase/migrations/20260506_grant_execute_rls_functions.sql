-- ============================================================================
-- MIGRATION: 20260506_grant_execute_rls_functions.sql
-- Descricao: Garante EXECUTE para role authenticated nas funcoes usadas por RLS
--            para evitar 403 ao avaliar policies com funcoes SECURITY DEFINER.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;
