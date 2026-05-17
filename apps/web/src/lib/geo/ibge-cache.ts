import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

type JsonRecord = Record<string, unknown>;

type CacheRow = {
    cache_key: string;
    payload: unknown;
    payload_hash: string | null;
    source: string;
    source_updated_at: string | null;
    expires_at: string;
};

type FreshPayload<T> = {
    payload: T;
    source?: string;
    sourceUpdatedAt?: string | null;
};

export type GeoCacheResult<T> = {
    payload: T;
    source: 'cache' | 'ibge';
    cacheStatus: 'fresh' | 'stale' | 'miss';
    warning?: string;
};

type CacheOptions<T> = {
    cacheKey: string;
    resourceType: string;
    scope?: string;
    ttlSeconds: number;
    fetchFresh: () => Promise<FreshPayload<T>>;
};

function normalizeForHash(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeForHash(item));
    }

    if (value && typeof value === 'object') {
        const entries = Object.entries(value as JsonRecord)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, val]) => [key, normalizeForHash(val)]);
        return Object.fromEntries(entries);
    }

    return value;
}

function hashPayload(payload: unknown): string {
    const canonical = JSON.stringify(normalizeForHash(payload));
    return createHash('sha256').update(canonical).digest('hex');
}

function asDate(value: string): Date {
    return new Date(value);
}

function isFuture(date: Date): boolean {
    return date.getTime() > Date.now();
}

function buildExpiry(ttlSeconds: number): string {
    return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

async function readCache(cacheKey: string): Promise<CacheRow | null> {
    try {
        const admin = createAdminClient();
        const { data, error } = await admin
            .from('geo_ibge_cache')
            .select('cache_key, payload, payload_hash, source, source_updated_at, expires_at')
            .eq('cache_key', cacheKey)
            .maybeSingle();

        if (error || !data) return null;
        return data as CacheRow;
    } catch {
        return null;
    }
}

async function writeCache<T>(
    cacheKey: string,
    resourceType: string,
    scope: string,
    ttlSeconds: number,
    fresh: FreshPayload<T>
): Promise<void> {
    try {
        const admin = createAdminClient();
        const payloadHash = hashPayload(fresh.payload);
        const expiresAt = buildExpiry(ttlSeconds);

        await admin
            .from('geo_ibge_cache')
            .upsert(
                {
                    cache_key: cacheKey,
                    resource_type: resourceType,
                    scope,
                    payload: fresh.payload,
                    payload_hash: payloadHash,
                    source: fresh.source ?? 'ibge',
                    source_updated_at: fresh.sourceUpdatedAt ?? null,
                    status: 'fresh',
                    last_error: null,
                    updated_at: new Date().toISOString(),
                    expires_at: expiresAt,
                },
                { onConflict: 'cache_key' }
            );
    } catch {
        // Cache eh opcional: falha nao pode interromper o endpoint.
    }
}

async function markCacheStale(cacheKey: string, message: string): Promise<void> {
    try {
        const admin = createAdminClient();
        await admin
            .from('geo_ibge_cache')
            .update({
                status: 'stale',
                last_error: message.slice(0, 600),
                updated_at: new Date().toISOString(),
            })
            .eq('cache_key', cacheKey);
    } catch {
        // noop
    }
}

export async function getOrRefreshGeoCache<T>(options: CacheOptions<T>): Promise<GeoCacheResult<T>> {
    const { cacheKey, resourceType, ttlSeconds, scope = 'global', fetchFresh } = options;

    const cached = await readCache(cacheKey);
    const cachedPayload = cached?.payload as T | undefined;
    const hasFreshCache = Boolean(cached && isFuture(asDate(cached.expires_at)));

    if (hasFreshCache && cachedPayload !== undefined) {
        return {
            payload: cachedPayload,
            source: 'cache',
            cacheStatus: 'fresh',
        };
    }

    try {
        const fresh = await fetchFresh();
        await writeCache(cacheKey, resourceType, scope, ttlSeconds, fresh);

        return {
            payload: fresh.payload,
            source: 'ibge',
            cacheStatus: cached ? 'stale' : 'miss',
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (cachedPayload !== undefined) {
            await markCacheStale(cacheKey, message);
            return {
                payload: cachedPayload,
                source: 'cache',
                cacheStatus: 'stale',
                warning: 'IBGE indisponivel no momento. Retornando ultimo cache persistido.',
            };
        }

        throw error;
    }
}
