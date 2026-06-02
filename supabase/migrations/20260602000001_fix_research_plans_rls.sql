-- Migration: Fix RLS policy for research_plans (was comparing tenant_id to auth.uid() which never matches)
-- Uses the standard get_user_tenant_id() helper + is_system_admin() for consistency with the rest of the system.
-- Also ensures WITH CHECK for INSERT/UPDATE security.
-- This fixes "new row violates row-level security policy" when creating the first planejamento for a tenant user.

DROP POLICY IF EXISTS "Research plans are tenant-isolated" ON public.research_plans;

CREATE POLICY "Research plans are tenant-isolated"
    ON public.research_plans
    FOR ALL
    USING (
        tenant_id = public.get_user_tenant_id()
        OR public.is_system_admin()
        OR auth.role() = 'service_role'
    )
    WITH CHECK (
        tenant_id = public.get_user_tenant_id()
        OR public.is_system_admin()
        OR auth.role() = 'service_role'
    );

COMMENT ON POLICY "Research plans are tenant-isolated" ON public.research_plans IS 
'Senior fix: proper tenant isolation using get_user_tenant_id() (from public.users). Allows system admins and service role. Matches patterns in tenants, users, reports, etc.';

-- If a BEFORE INSERT trigger for auto tenant/created_by is desired in future, it can be added here.
-- For now, the client lib (researchPlans.ts) explicitly provides tenant_id + created_by after fetching profile (senior practice: explicit over magic triggers for auditability).
