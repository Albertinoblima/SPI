/**
 * Basic in-memory rate limiter for sensitive admin operations.
 * 
 * Supports distributed mode via Upstash REST when configured.
 * Falls back to in-memory limiter if Redis is unavailable.
 * 
 * Fase 2 Security Hardening.
 */

export interface RateLimitConfig {
  windowMs: number;   // Time window in ms
  maxRequests: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  mode: 'distributed' | 'memory';
}

const limits = new Map<string, { count: number; resetTime: number }>();

function readRedisConfig() {
  const url = process.env['UPSTASH_REDIS_REST_URL'];
  const token = process.env['UPSTASH_REDIS_REST_TOKEN'];

  if (!url || !token) {
    return null;
  }

  return { url: url.replace(/\/$/, ''), token };
}

async function redisCommand(command: string[]): Promise<unknown> {
  const config = readRedisConfig();
  if (!config) {
    throw new Error('UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN não configurados');
  }

  const response = await fetch(`${config.url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([command]),
  });

  if (!response.ok) {
    throw new Error(`Upstash HTTP ${response.status}`);
  }

  const payload = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const first = payload?.[0];
  if (!first) {
    throw new Error('Upstash empty response');
  }
  if (first.error) {
    throw new Error(first.error);
  }

  return first.result;
}

function clampRemaining(maxRequests: number, count: number): number {
  return Math.max(0, maxRequests - count);
}

function millisecondsToSeconds(valueMs: number): number {
  return Math.max(1, Math.ceil(valueMs / 1000));
}

function checkRateLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = limits.get(key);

  if (!entry || now > entry.resetTime) {
    limits.set(key, { count: 1, resetTime: now + config.windowMs });
    return {
      allowed: true,
      remaining: clampRemaining(config.maxRequests, 1),
      retryAfterSeconds: 0,
      mode: 'memory',
    };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: millisecondsToSeconds(entry.resetTime - now),
      mode: 'memory',
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: clampRemaining(config.maxRequests, entry.count),
    retryAfterSeconds: 0,
    mode: 'memory',
  };
}

export async function checkRateLimitDistributed(
  key: string,
  config: RateLimitConfig = { windowMs: 60_000, maxRequests: 30 }
): Promise<RateLimitResult> {
  // If distributed backend isn't configured, fallback silently.
  if (!readRedisConfig()) {
    return checkRateLimitMemory(key, config);
  }

  try {
    const redisKey = `rl:${key}`;
    const increment = Number(await redisCommand(['INCR', redisKey]));

    if (!Number.isFinite(increment) || increment <= 0) {
      return checkRateLimitMemory(key, config);
    }

    if (increment === 1) {
      await redisCommand(['PEXPIRE', redisKey, String(config.windowMs)]);
    }

    const ttlMsRaw = Number(await redisCommand(['PTTL', redisKey]));
    const ttlMs = Number.isFinite(ttlMsRaw) ? ttlMsRaw : config.windowMs;
    const retryAfterSeconds = ttlMs > 0 ? millisecondsToSeconds(ttlMs) : 1;

    if (increment > config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds,
        mode: 'distributed',
      };
    }

    return {
      allowed: true,
      remaining: clampRemaining(config.maxRequests, increment),
      retryAfterSeconds: 0,
      mode: 'distributed',
    };
  } catch {
    return checkRateLimitMemory(key, config);
  }
}

export function checkRateLimit(key: string, config: RateLimitConfig = { windowMs: 60_000, maxRequests: 30 }): boolean {
  return checkRateLimitMemory(key, config).allowed;
}

/**
 * Helper to generate rate limit key for admin operations.
 */
export function adminRateLimitKey(userId: string, operation: string): string {
  return `admin:${userId}:${operation}`;
}
