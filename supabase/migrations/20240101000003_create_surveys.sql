-- ============================================================================
-- MIGRATION: 20240101000003_create_surveys.sql
-- ============================================================================

CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users (id),

    -- Survey details
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),

    -- Configuration
    requires_geolocation BOOLEAN DEFAULT TRUE,
    requires_photo BOOLEAN DEFAULT FALSE,
    requires_signature BOOLEAN DEFAULT FALSE,
    allow_offline BOOLEAN DEFAULT TRUE,

    -- Metadata
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_surveys_tenant ON surveys (tenant_id);
CREATE INDEX idx_surveys_status ON surveys (tenant_id, status) WHERE deleted_at IS NULL;
CREATE INDEX idx_surveys_created_by ON surveys (created_by);
