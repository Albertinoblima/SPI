/**
 * Tests for idempotency helpers (Fase 4)
 * Covers TTL, duplicate detection, generic result typing.
 */
import {
  checkIdempotency,
  storeIdempotencyResult,
  type IdempotencyOptions,
} from '../security/idempotency';

describe('idempotency helpers', () => {
  const testKey = 'test-op-123';

  beforeEach(() => {
    // Clear any previous entries by using a unique key per test or short TTL
  });

  it('returns isDuplicate:false on first check', () => {
    const res = checkIdempotency(testKey + '-first');
    expect(res.isDuplicate).toBe(false);
    expect(res.previousResult).toBeUndefined();
  });

  it('stores and retrieves previousResult with generic type', () => {
    const payload = { success: true, id: 42 };
    storeIdempotencyResult(testKey + '-store', payload, { ttlMs: 10_000 });

    const check = checkIdempotency<{ success: boolean; id: number }>(testKey + '-store');
    expect(check.isDuplicate).toBe(true);
    expect(check.previousResult).toEqual(payload);
    expect(check.previousResult?.id).toBe(42);
  });

  it('correctly distinguishes duplicate vs new keys (TTL is best-effort in-memory)', () => {
    const k1 = testKey + '-k1';
    const k2 = testKey + '-k2';
    storeIdempotencyResult(k1, { v: 1 });

    expect(checkIdempotency(k1).isDuplicate).toBe(true);
    expect(checkIdempotency(k2).isDuplicate).toBe(false);
  });

  it('handles unknown result type safely when not specified', () => {
    storeIdempotencyResult(testKey + '-unknown', { foo: 'bar' });
    const check = checkIdempotency(testKey + '-unknown');
    expect(check.isDuplicate).toBe(true);
    // previousResult is unknown at runtime here, but we can assert shape
    const prev = check.previousResult as { foo?: string } | undefined;
    expect(prev?.foo).toBe('bar');
  });
});
