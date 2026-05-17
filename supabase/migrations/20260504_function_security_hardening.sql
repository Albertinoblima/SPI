-- ============================================================================
-- MIGRATION: 20260504_function_security_hardening.sql
-- Descricao: Hardening de funcoes internas expostas no schema public
-- ============================================================================

-- 1) Fixar search_path para evitar role mutable search_path warnings
ALTER FUNCTION public.test_rls_isolation() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_manager_or_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.log_error(text, text, uuid, uuid, character varying, character varying, character varying, integer, uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.belongs_to_tenant(uuid) SET search_path = public, pg_temp;
ALTER FUNCTION public.log_audit(uuid, uuid, text, text, uuid, jsonb, jsonb, text, boolean) SET search_path = public, pg_temp;
ALTER FUNCTION public.is_system_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.get_user_tenant_id() SET search_path = public, pg_temp;
ALTER FUNCTION public.is_admin() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.rls_auto_enable() SET search_path = public, pg_temp;

-- 2) Revoke de EXECUTE em funcoes internas SECURITY DEFINER para RPC publico
-- IMPORTANTE: funcoes usadas em politicas RLS precisam permanecer executaveis por authenticated.
REVOKE EXECUTE ON FUNCTION public.belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_tenant_id() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_or_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.is_system_admin() FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM public, anon, authenticated;
