import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { logAdminAction } from '../security/audit';

/**
 * Creates a Supabase admin client using the Service Role key.
 * 
 * WARNING: This client bypasses RLS. Use ONLY in trusted server contexts
 * (API routes, Edge Functions, background jobs).
 * Never expose to the browser.
 *
 * Fase 2 Security Recommendation:
 * Prefer createAuditedSupabaseAdminClient(context) for all new code.
 * 
 * Current Privilege Matrix (high-level, as of Fase 2 - post-audit):
 * - system_admin: Full access via audited admin client (tenant impersonation, reports, geo enrichment, user/tenant management, audit logs).
 * - tenant admin/manager: Limited via RLS + normal client; admin client only for specific justified operations (publishing surveys, team management, distribution within tenant) — all logged.
 * - interviewer (mobile): Never direct admin client — only through Edge Functions (sync-responses, etc.) with proper auth context.
 * - Report generation, AI insights, PublicReportAccess: Use audited client with explicit context for full traceability.
 * - Sync operations (entrevistas, responses, media): Use audited client in rate-limited routes.
 * - Geo cache / IBGE enrichment: Audited for bulk data operations.
 * 
 * Audit coverage: All web direct usages migrated to createAuditedSupabaseAdminClient. Edge functions use service_role via env (documented and minimized).
 * 
 * All new code must use the audited wrapper + logAdminAction. Rate limiting applied to destructive/sensitive endpoints (tenant delete, survey publish, distribution downloads, sync).
 */
export function createSupabaseAdminClient() {
  const url = process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!url || !serviceRoleKey) {
    throw new Error('Missing Supabase admin credentials (SUPABASE_SERVICE_ROLE_KEY)');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Fase 2: Audited Admin Client
 * 
 * Wrapper that logs every creation of an admin client for security auditing.
 * This is the recommended way to obtain admin clients going forward.
 */
export function createAuditedSupabaseAdminClient(context: string = 'unknown') {
  logAdminAction({
    action: 'create_admin_client',
    metadata: { context },
  });

  const client = createSupabaseAdminClient();

  // Future: We can return a proxied client that logs destructive operations.
  return client;
}
