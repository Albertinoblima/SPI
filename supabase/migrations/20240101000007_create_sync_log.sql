-- ============================================================================
-- MIGRATION: 20240101000007_create_sync_log.sql
-- Descrição: Auditoria de sincronizações para debugging
-- ============================================================================

CREATE TABLE sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    
    -- Sync details
    device_id VARCHAR(255) NOT NULL,
    sync_type VARCHAR(50) NOT NULL, -- 'upload', 'download', 'conflict'
    entity_type VARCHAR(50) NOT NULL, -- 'response', 'media'
    entity_id UUID,
    
    -- Status
    status VARCHAR(20) CHECK (status IN ('pending', 'success', 'failed', 'conflict')),
    error_message TEXT,
    
    -- Payload
    request_payload JSONB,
    response_payload JSONB,
    
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_tenant ON sync_log(tenant_id);
CREATE INDEX idx_sync_log_device ON sync_log(device_id);
CREATE INDEX idx_sync_log_status ON sync_log(status, created_at DESC);
