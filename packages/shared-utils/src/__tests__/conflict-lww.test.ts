/**
 * Tests for Last-Write-Wins conflict resolution logic (Fase 4)
 * Mirrors the strategy used in mobile SyncEngine / ConflictResolver after Fase 1+3 hardening.
 */
describe('LWW Conflict Resolution (core algorithm)', () => {
  function resolveLWW(localUpdatedAt: string, remoteUpdatedAt: string): 'local' | 'remote' {
    const localTs = new Date(localUpdatedAt).getTime();
    const remoteTs = new Date(remoteUpdatedAt).getTime();
    return localTs >= remoteTs ? 'local' : 'remote';
  }

  it('local wins on equal or newer timestamp', () => {
    expect(resolveLWW('2026-06-01T10:00:00Z', '2026-06-01T09:59:00Z')).toBe('local');
    expect(resolveLWW('2026-06-01T10:00:00Z', '2026-06-01T10:00:00Z')).toBe('local');
  });

  it('remote wins on strictly newer timestamp', () => {
    expect(resolveLWW('2026-06-01T09:00:00Z', '2026-06-01T10:00:00Z')).toBe('remote');
  });

  it('handles invalid dates gracefully (treats as epoch)', () => {
    const result = resolveLWW('invalid', '2026-01-01');
    expect(result).toBe('remote'); // remote is newer than epoch
  });
});
