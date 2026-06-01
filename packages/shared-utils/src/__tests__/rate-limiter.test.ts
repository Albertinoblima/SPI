/**
 * Tests for in-memory rate limiter (Fase 4)
 * Covers the security primitive used alongside the audited admin client (Fase 0/2 hardening).
 */
import { checkRateLimit, adminRateLimitKey } from '../security/rate-limiter';
import { checkRateLimitDistributed } from '../security/rate-limiter';

describe('rate-limiter (security primitive)', () => {
  const baseKey = 'test-user:operation';

  beforeEach(() => {
    // Note: the module uses a shared Map; in real tests we would export a reset() for isolation.
    // For this F4 increment we test behavior with fresh keys.
  });

  it('allows requests under the limit', () => {
    const key = baseKey + '-under-limit';
    const config = { windowMs: 60_000, maxRequests: 3 };

    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
  });

  it('blocks after exceeding maxRequests in the window', () => {
    const key = baseKey + '-exceed';
    const config = { windowMs: 60_000, maxRequests: 2 };

    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(true);
    expect(checkRateLimit(key, config)).toBe(false); // blocked
  });

  it('adminRateLimitKey produces stable composite keys', () => {
    expect(adminRateLimitKey('u123', 'deleteTenant')).toBe('admin:u123:deleteTenant');
    expect(adminRateLimitKey('u123', 'impersonate')).toBe('admin:u123:impersonate');
  });

  it('resets counter after window expires (simulated)', async () => {
    const key = baseKey + '-reset';
    const shortWindow = { windowMs: 10, maxRequests: 1 };

    expect(checkRateLimit(key, shortWindow)).toBe(true);
    expect(checkRateLimit(key, shortWindow)).toBe(false);

    await new Promise(r => setTimeout(r, 25));

    // New window should allow again
    expect(checkRateLimit(key, shortWindow)).toBe(true);
  });

  it('distributed limiter falls back to memory when redis env is missing', async () => {
    const key = baseKey + '-distributed-fallback';
    const config = { windowMs: 60_000, maxRequests: 2 };

    const first = await checkRateLimitDistributed(key, config);
    const second = await checkRateLimitDistributed(key, config);
    const third = await checkRateLimitDistributed(key, config);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(first.mode).toBe('memory');
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('distributed limiter returns remaining count metadata', async () => {
    const key = baseKey + '-distributed-remaining';
    const config = { windowMs: 60_000, maxRequests: 3 };

    const first = await checkRateLimitDistributed(key, config);
    const second = await checkRateLimitDistributed(key, config);

    expect(first.remaining).toBe(2);
    expect(second.remaining).toBe(1);
  });
});
