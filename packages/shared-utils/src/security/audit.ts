/**
 * Security Audit Helper (Fase 2)
 * 
 * Centralized place to log sensitive admin operations.
 * In future: Persist to `admin_audit_log` table via admin client or Edge.
 */

export interface AdminAuditEvent {
  action: string;
  userId?: string;
  tenantId?: string;
  resource?: string;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export function logAdminAction(event: AdminAuditEvent) {
  const log = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    level: 'SECURITY_AUDIT',
    source: 'createAuditedSupabaseAdminClient',
  };

  // Structured logging for observability (pino, datadog, etc. in prod)
  console.log('[ADMIN_AUDIT]', JSON.stringify(log));

  // TODO (Fase 2+): Persist to a dedicated admin_audit_log table.
  // This should be done with a service role or a dedicated low-privilege function.
}
