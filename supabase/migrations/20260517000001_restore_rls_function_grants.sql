-- ============================================================================
-- MIGRATION: 20260517000001_restore_rls_function_grants.sql
-- Descricao: Restaura EXECUTE em funcoes usadas por RLS policies para o role
--            authenticated, que foram indevidamente revogadas pela migration
--            20260504_function_security_hardening.sql ao ser aplicada fora de
--            ordem pelo supabase db push --include-all.
--
--            As funcoes abaixo sao invocadas DENTRO de policies RLS e precisam
--            de EXECUTE para authenticated funcionar corretamente.
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.get_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin() TO authenticated;
