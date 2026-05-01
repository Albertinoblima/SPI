-- ============================================================================
-- MIGRATION: 20240101000005_create_responses.sql
-- ============================================================================

CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
    interviewer_id UUID NOT NULL REFERENCES users(id),
    
    -- Respondent info (optional)
    respondent_name VARCHAR(255),
    respondent_phone VARCHAR(20),
    respondent_email VARCHAR(255),
    
    -- Geolocation (PostGIS)
    location GEOGRAPHY(POINT, 4326), -- WGS84
    location_accuracy NUMERIC(6,2), -- meters
    address_street TEXT,
    address_city VARCHAR(255),
    address_state VARCHAR(100),
    address_country VARCHAR(100),
    
    -- Sync metadata
    device_id VARCHAR(255) NOT NULL, -- Unique device identifier
    local_id UUID, -- ID gerado no dispositivo offline
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_version INTEGER DEFAULT 1, -- Para conflict resolution
    
    -- Status
    is_complete BOOLEAN DEFAULT false,
    completed_at TIMESTAMPTZ,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_responses_tenant ON responses(tenant_id);
CREATE INDEX idx_responses_survey ON responses(survey_id);
CREATE INDEX idx_responses_interviewer ON responses(interviewer_id);
CREATE INDEX idx_responses_device ON responses(device_id);
CREATE INDEX idx_responses_local_id ON responses(local_id) WHERE local_id IS NOT NULL;
CREATE INDEX idx_responses_location ON responses USING GIST(location) WHERE location IS NOT NULL;
CREATE INDEX idx_responses_created_at ON responses(tenant_id, created_at DESC);
