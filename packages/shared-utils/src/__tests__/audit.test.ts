/**
 * Tests for admin audit logging helper (Fase 4)
 * Used by the audited service_role wrapper (Fase 0/2 security hardening).
 */
import { logAdminAction, type AdminAuditEvent } from '../security/audit';

describe('audit (security logging)', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs structured ADMIN_AUDIT entries with defaults', () => {
    const event: AdminAuditEvent = {
      action: 'tenant.delete',
      userId: 'user-1',
      tenantId: 'tenant-xyz',
    };

    logAdminAction(event);

    expect(consoleSpy).toHaveBeenCalledWith(
      '[ADMIN_AUDIT]',
      expect.stringContaining('"action":"tenant.delete"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ADMIN_AUDIT]',
      expect.stringContaining('"level":"SECURITY_AUDIT"')
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      '[ADMIN_AUDIT]',
      expect.stringContaining('"timestamp"')
    );
  });
});
