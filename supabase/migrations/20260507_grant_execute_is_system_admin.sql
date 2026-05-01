-- ============================================================================
-- MIGRATION: 20260507_grant_execute_is_system_admin.sql
-- Descricao: Garante EXECUTE para role authenticated na funcao is_system_admin
--            usada em policies RLS de administracao.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
