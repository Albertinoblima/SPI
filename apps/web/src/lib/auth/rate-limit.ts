type RateLimitOptions = {
    namespace: string;
    key: string;
    limit: number;
    windowMs: number;
};

type RateLimitState = {
    count: number;
    resetAt: number;
};

type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
};

const globalStore = globalThis as typeof globalThis & {
    __authRateLimitStore?: Map<string, RateLimitState>;
};

const rateLimitStore = globalStore.__authRateLimitStore ?? new Map<string, RateLimitState>();

if (!globalStore.__authRateLimitStore) {
    globalStore.__authRateLimitStore = rateLimitStore;
}

function cleanupExpiredEntries(now: number) {
    for (const [storeKey, state] of rateLimitStore.entries()) {
        if (state.resetAt <= now) {
            rateLimitStore.delete(storeKey);
        }
    }
}

export function consumeRateLimit(options: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    cleanupExpiredEntries(now);

    const storeKey = `${options.namespace}:${options.key}`;
    const currentState = rateLimitStore.get(storeKey);

    if (!currentState || currentState.resetAt <= now) {
        rateLimitStore.set(storeKey, {
            count: 1,
            resetAt: now + options.windowMs,
        });

        return {
            allowed: true,
            remaining: Math.max(options.limit - 1, 0),
            retryAfterSeconds: Math.ceil(options.windowMs / 1000),
        };
    }

    currentState.count += 1;
    rateLimitStore.set(storeKey, currentState);

    const allowed = currentState.count <= options.limit;

    return {
        allowed,
        remaining: Math.max(options.limit - currentState.count, 0),
        retryAfterSeconds: Math.max(Math.ceil((currentState.resetAt - now) / 1000), 1),
    };
}