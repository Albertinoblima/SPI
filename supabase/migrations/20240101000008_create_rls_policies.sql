-- ============================================================================
-- MIGRATION: 20240101000008_create_rls_policies.sql
-- Descrição: Row Level Security para isolamento multi-tenant
-- ============================================================================

-- Enable RLS em todas as tabelas
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

-- Helper function para pegar tenant_id do usuário logado
CREATE OR REPLACE FUNCTION get_user_tenant_id()
RETURNS UUID AS $$
BEGIN
    RETURN (SELECT tenant_id FROM users WHERE id = auth.uid());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- POLICIES: TENANTS
-- ============================================================================

-- Usuários só veem seu próprio tenant
CREATE POLICY tenant_isolation_policy ON tenants
    FOR ALL
    USING (id = get_user_tenant_id());

-- ============================================================================
-- POLICIES: USERS
-- ============================================================================

-- Usuários veem apenas users do seu tenant
CREATE POLICY users_isolation_policy ON users
    FOR ALL
    USING (tenant_id = get_user_tenant_id());

-- Admins podem criar novos usuários
CREATE POLICY users_insert_policy ON users
    FOR INSERT
    WITH CHECK (
        tenant_id = get_user_tenant_id() 
        AND EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- ============================================================================
-- POLICIES: SURVEYS
-- ============================================================================

CREATE POLICY surveys_isolation_policy ON surveys
    FOR ALL
    USING (tenant_id = get_user_tenant_id());

-- Apenas admins/managers criam surveys
CREATE POLICY surveys_insert_policy ON surveys
    FOR INSERT
    WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role IN ('admin', 'manager')
        )
    );

-- ============================================================================
-- POLICIES: QUESTIONS
-- ============================================================================

CREATE POLICY questions_isolation_policy ON questions
    FOR ALL
    USING (tenant_id = get_user_tenant_id());

-- ============================================================================
-- POLICIES: RESPONSES
-- ============================================================================

CREATE POLICY responses_isolation_policy ON responses
    FOR ALL
    USING (tenant_id = get_user_tenant_id());

-- Interviewers podem criar respostas
CREATE POLICY responses_insert_policy ON responses
    FOR INSERT
    WITH CHECK (
        tenant_id = get_user_tenant_id()
        AND interviewer_id = auth.uid()
    );

-- ============================================================================
-- POLICIES: RESPONSE_ANSWERS
-- ============================================================================

CREATE POLICY answers_isolation_policy ON response_answers
    FOR ALL
    USING (tenant_id = get_user_tenant_id());

-- ============================================================================
-- POLICIES: SYNC_LOG
-- ============================================================================

CREATE POLICY sync_log_isolation_policy ON sync_log
    FOR ALL
    USING (tenant_id = get_user_tenant_id());

-- ============================================================================
-- TRIGGERS: Updated_at automation
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_surveys_updated_at BEFORE UPDATE ON surveys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_questions_updated_at BEFORE UPDATE ON questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_responses_updated_at BEFORE UPDATE ON responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- VIEWS: Analytics simplificadas
-- ============================================================================

CREATE OR REPLACE VIEW vw_survey_stats AS
SELECT 
    s.id AS survey_id,
    s.tenant_id,
    s.title,
    COUNT(DISTINCT r.id) AS total_responses,
    COUNT(DISTINCT r.interviewer_id) AS total_interviewers,
    COUNT(DISTINCT r.id) FILTER (WHERE r.is_complete) AS completed_responses,
    MIN(r.created_at) AS first_response_at,
    MAX(r.created_at) AS last_response_at
FROM surveys s
LEFT JOIN responses r ON r.survey_id = s.id AND r.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.tenant_id, s.title;

-- ============================================================================
-- INDEXES: Performance optimization
-- ============================================================================

-- Composite index para queries comuns de dashboard
CREATE INDEX idx_responses_dashboard ON responses(tenant_id, survey_id, created_at DESC) 
    WHERE deleted_at IS NULL;

-- Full-text search em perguntas
CREATE INDEX idx_questions_search ON questions USING GIN(to_tsvector('portuguese', question_text));

-- Geospatial queries otimizadas
CREATE INDEX idx_responses_geohash ON responses(tenant_id, survey_id, location) 
    WHERE location IS NOT NULL;
