/**
 * Simple idempotency key helper (Fase 2).
 * 
 * For production, use Redis or Supabase table with TTL for distributed idempotency.
 * This is an in-memory example for single-instance or as starting point.
 */

const processedKeys = new Map<string, { timestamp: number; result?: unknown }>();

export interface IdempotencyOptions {
  ttlMs?: number; // default 5 minutes
}

export function checkIdempotency<T = unknown>(key: string, options: IdempotencyOptions = {}): { isDuplicate: boolean; previousResult: T | undefined } {
  const ttl = options.ttlMs ?? 5 * 60 * 1000;
  const now = Date.now();
  const entry = processedKeys.get(key);

  if (entry) {
    if ((now - entry.timestamp) < ttl) {
      return { isDuplicate: true, previousResult: entry.result as T | undefined };
    }
    // Expired: remove immediately for correctness
    processedKeys.delete(key);
  }

  // Occasional global GC when map grows
  if (processedKeys.size > 1000) {
    for (const [k, v] of processedKeys) {
      if ((now - v.timestamp) > ttl) processedKeys.delete(k);
    }
  }

  return { isDuplicate: false, previousResult: undefined };
}

export function storeIdempotencyResult<T = unknown>(key: string, result: T, options: IdempotencyOptions = {}) {
  const ttl = options.ttlMs ?? 5 * 60 * 1000;
  processedKeys.set(key, { timestamp: Date.now(), result });
  // Auto cleanup after TTL not implemented for simplicity (use external store in prod)
}
