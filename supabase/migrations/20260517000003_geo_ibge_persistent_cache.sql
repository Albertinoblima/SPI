-- ============================================================================
-- MIGRATION: 20260517000003_geo_ibge_persistent_cache.sql
-- Descricao: Cache persistente para respostas IBGE (geo) com controle de validade
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geo_ibge_cache (
    cache_key TEXT PRIMARY KEY,
    resource_type TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global',
    payload JSONB NOT NULL,
    payload_hash TEXT,
    source TEXT NOT NULL DEFAULT 'ibge',
    source_updated_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'fresh' CHECK (status IN ('fresh', 'stale')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_geo_ibge_cache_resource_type
    ON public.geo_ibge_cache(resource_type);

CREATE INDEX IF NOT EXISTS idx_geo_ibge_cache_expires_at
    ON public.geo_ibge_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_geo_ibge_cache_updated_at
    ON public.geo_ibge_cache(updated_at DESC);

ALTER TABLE public.geo_ibge_cache ENABLE ROW LEVEL SECURITY;

-- Acesso de usuarios finais e anonimos permanece bloqueado por RLS.
-- Leitura/escrita sera feita pelo backend com service role (bypass RLS).
