-- ============================================================================
-- MIGRATION: 20240101000001_create_tenants.sql
-- Descrição: Tabela de empresas/organizações (Multi-tenancy)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
        RAISE NOTICE 'Extensao postgis ja instalada; mantendo schema atual para compatibilidade.';
    ELSE
        CREATE EXTENSION IF NOT EXISTS "postgis" WITH SCHEMA extensions;
    END IF;
END;
$$;

-- Tenants (Empresas/Organizações)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
    
    -- Configurações
    max_users INTEGER DEFAULT 10,
    max_surveys INTEGER DEFAULT 50,
    storage_limit_mb INTEGER DEFAULT 1000,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ -- Soft delete
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_status ON tenants(status) WHERE deleted_at IS NULL;
