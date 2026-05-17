-- ============================================================================
-- MIGRATION: 20260515000002_fix_security_advisor_views_rls.sql
-- Descrição: Corrige 3 problemas críticos do Security Advisor do Supabase:
--   1. vw_tenant_stats e vw_system_stats criadas com SECURITY DEFINER
--   2. public.spatial_ref_sys sem RLS habilitado
-- ============================================================================

-- 1) Recriar views explicitamente com security_invoker para eliminar SECURITY DEFINER
--    PostgreSQL 15+: opção WITH (security_invoker = true) na definição da view

CREATE OR REPLACE VIEW public.vw_tenant_stats
WITH (security_invoker = true)
AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) AS active_users,
    COUNT(DISTINCT s.id) AS total_surveys,
    COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) AS active_surveys,
    COUNT(DISTINCT r.id) AS total_responses,
    COUNT(DISTINCT e.id) AS recent_errors_7d,
    MAX(r.created_at) AS last_response_at
FROM public.tenants t
LEFT JOIN public.users u ON u.tenant_id = t.id
LEFT JOIN public.surveys s ON s.tenant_id = t.id
LEFT JOIN public.responses r ON r.tenant_id = t.id AND r.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN public.error_logs e ON e.tenant_id = t.id AND e.created_at > NOW() - INTERVAL '7 days'
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name;

CREATE OR REPLACE VIEW public.vw_system_stats
WITH (security_invoker = true)
AS
SELECT 
    COUNT(DISTINCT t.id) AS total_tenants,
    COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) AS active_tenants,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) AS active_users,
    COUNT(DISTINCT s.id) AS total_surveys,
    COUNT(DISTINCT r.id) AS total_responses,
    COUNT(DISTINCT CASE WHEN e.created_at > NOW() - INTERVAL '24 hours' THEN e.id END) AS errors_24h,
    COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (e.updated_at - e.created_at)) * 1000)), 0) AS avg_error_resolution_ms
FROM public.tenants t
LEFT JOIN public.users u ON u.tenant_id = t.id
LEFT JOIN public.surveys s ON s.tenant_id = t.id
LEFT JOIN public.responses r ON r.tenant_id = t.id
LEFT JOIN public.error_logs e ON e.resolved = true;

-- 2) spatial_ref_sys é tabela do PostGIS e não pode ter RLS habilitado pelo role da aplicação.
--    Ignorado intencionalmente: tabela de sistema, somente leitura por padrão.
