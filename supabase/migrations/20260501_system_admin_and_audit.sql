-- ============================================================================
-- MIGRATION: 20260501_system_admin_and_audit.sql
-- Descrição: Suporte a System Admin e tabelas de auditoria/analytics do sistema
-- Data: 2026-05-01
-- ============================================================================

-- Garante função uuid_generate_v4() para UUIDs padrão
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PARTE 1: ALTERAR TABELA USERS PARA SUPORTAR SYSTEM ADMIN
-- ============================================================================

-- Adiciona coluna para diferenciar system_admin
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_system_admin BOOLEAN DEFAULT false;

-- Índice para melhor performance em queries de system_admin
CREATE INDEX IF NOT EXISTS idx_users_system_admin ON public.users(is_system_admin) WHERE is_system_admin = true;

-- Constraint para garantir que system_admin não tem tenant específico ou tem tenant especial
ALTER TABLE public.users ADD CONSTRAINT check_system_admin_tenant CHECK (
    NOT is_system_admin OR tenant_id IS NOT NULL -- Mesmo system_admin tem tenant (pode ser 'system')
);

-- ============================================================================
-- PARTE 2: CRIAR TABELA SYSTEM_ANALYTICS
-- ============================================================================
-- Métricas gerais do sistema (não isoladas por tenant)

CREATE TABLE IF NOT EXISTS public.system_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Métricas contáveis
    total_tenants INTEGER DEFAULT 0,
    active_tenants INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    total_surveys INTEGER DEFAULT 0,
    active_surveys INTEGER DEFAULT 0,
    total_responses INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    
    -- Storage
    total_storage_used_mb DECIMAL(10, 2) DEFAULT 0,
    
    -- Performance
    avg_response_time_ms DECIMAL(10, 2),
    total_errors_24h INTEGER DEFAULT 0,
    
    -- Período desta métrica
    date_recorded TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(date_recorded)
);

CREATE INDEX IF NOT EXISTS idx_system_analytics_date ON public.system_analytics(date_recorded DESC);

-- ============================================================================
-- PARTE 3: CRIAR TABELA ERROR_LOGS
-- ============================================================================
-- Log centralizado de erros do sistema

CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Contexto do erro
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Detalhes do erro
    error_code VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    error_stack TEXT,
    
    -- Contexto HTTP
    http_method VARCHAR(10),
    http_path VARCHAR(500),
    http_status_code INTEGER,
    
    -- Severidade
    severity VARCHAR(20) CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Rastreamento
    correlation_id UUID, -- Para agrupar erros relacionados
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_tenant ON public.error_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_severity ON public.error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved) WHERE resolved = false;

-- ============================================================================
-- PARTE 4: CRIAR TABELA SUPPORT_TICKETS
-- ============================================================================
-- Sistema de tickets de suporte com chat integrado

CREATE TABLE IF NOT EXISTS public.support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relacionamento
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- System admin responsável
    
    -- Conteúdo
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN (
        'bug', 'feature_request', 'account', 'billing', 'performance', 'other'
    )),
    
    -- Status
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN (
        'open', 'in_progress', 'waiting_user', 'resolved', 'closed'
    )),
    
    -- Prioridade
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN (
        'low', 'medium', 'high', 'urgent'
    )),
    
    -- Metadata
    response_count INTEGER DEFAULT 0,
    last_response_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON public.support_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON public.support_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_support_tickets_created ON public.support_tickets(created_at DESC);

-- ============================================================================
-- PARTE 5: CRIAR TABELA SUPPORT_MESSAGES
-- ============================================================================
-- Mensagens de chat dentro de um ticket de suporte

CREATE TABLE IF NOT EXISTS public.support_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Determina se é user ou admin respondendo
    is_admin_response BOOLEAN DEFAULT false,
    
    -- Conteúdo
    message TEXT NOT NULL,
    attachments JSONB, -- URLs de arquivos anexados
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON public.support_messages(ticket_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_messages_sender ON public.support_messages(sender_id);

-- ============================================================================
-- PARTE 6: CRIAR TABELA AUDIT_LOG
-- ============================================================================
-- Auditoria de todas as ações críticas do sistema

CREATE TABLE IF NOT EXISTS public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Ator da ação
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
    
    -- Ação
    action VARCHAR(100) NOT NULL, -- Ex: 'survey_created', 'user_deleted', 'tenant_suspended'
    entity_type VARCHAR(100) NOT NULL, -- Ex: 'survey', 'user', 'tenant'
    entity_id UUID NOT NULL,
    
    -- Detalhes da mudança
    old_values JSONB, -- Estado anterior
    new_values JSONB, -- Estado novo
    changes_description TEXT, -- Descrição em linguagem natural
    
    -- Contexto
    ip_address INET,
    user_agent TEXT,
    
    -- Severidade
    is_critical BOOLEAN DEFAULT false, -- Para alertar admins
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON public.audit_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON public.audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_critical ON public.audit_log(is_critical) WHERE is_critical = true;
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON public.audit_log(created_at DESC);

-- ============================================================================
-- PARTE 7: CRIAR TRIGGERS PARA ATUALIZAR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para error_logs
DROP TRIGGER IF EXISTS update_error_logs_updated_at ON public.error_logs;
CREATE TRIGGER update_error_logs_updated_at BEFORE UPDATE ON public.error_logs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para support_tickets
DROP TRIGGER IF EXISTS update_support_tickets_updated_at ON public.support_tickets;
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para support_messages
DROP TRIGGER IF EXISTS update_support_messages_updated_at ON public.support_messages;
CREATE TRIGGER update_support_messages_updated_at BEFORE UPDATE ON public.support_messages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger para system_analytics
DROP TRIGGER IF EXISTS update_system_analytics_updated_at ON public.system_analytics;
CREATE TRIGGER update_system_analytics_updated_at BEFORE UPDATE ON public.system_analytics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PARTE 8: VIEWS PARA ANALYTICS
-- ============================================================================

-- View para estatísticas agregadas de um tenant
CREATE OR REPLACE VIEW public.vw_tenant_stats AS
SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) AS active_users,
    COUNT(DISTINCT s.id) AS total_surveys,
    COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) AS active_surveys,
    COUNT(DISTINCT r.id) AS total_responses,
    COUNT(DISTINCT e.id) AS recent_errors_7d,
    MAX(r.created_at) AS last_response_at
FROM public.tenants t
LEFT JOIN public.users u ON u.tenant_id = t.id
LEFT JOIN public.surveys s ON s.tenant_id = t.id
LEFT JOIN public.responses r ON r.tenant_id = t.id AND r.created_at > NOW() - INTERVAL '7 days'
LEFT JOIN public.error_logs e ON e.tenant_id = t.id AND e.created_at > NOW() - INTERVAL '7 days'
WHERE t.deleted_at IS NULL
GROUP BY t.id, t.name;

-- View para estatísticas gerais do sistema
CREATE OR REPLACE VIEW public.vw_system_stats AS
SELECT 
    COUNT(DISTINCT t.id) AS total_tenants,
    COUNT(DISTINCT CASE WHEN t.status = 'active' THEN t.id END) AS active_tenants,
    COUNT(DISTINCT u.id) AS total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) AS active_users,
    COUNT(DISTINCT s.id) AS total_surveys,
    COUNT(DISTINCT r.id) AS total_responses,
    COUNT(DISTINCT CASE WHEN e.created_at > NOW() - INTERVAL '24 hours' THEN e.id END) AS errors_24h,
    COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (e.updated_at - e.created_at)) * 1000)), 0) AS avg_error_resolution_ms
FROM public.tenants t
LEFT JOIN public.users u ON u.tenant_id = t.id
LEFT JOIN public.surveys s ON s.tenant_id = t.id
LEFT JOIN public.responses r ON r.tenant_id = t.id
LEFT JOIN public.error_logs e ON e.resolved = true;

-- ============================================================================
-- PARTE 9: COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ============================================================================

COMMENT ON TABLE public.system_analytics IS 'Métricas agregadas do sistema (uma entrada por dia)';
COMMENT ON TABLE public.error_logs IS 'Log centralizado de erros com rastreamento e resolução';
COMMENT ON TABLE public.support_tickets IS 'Tickets de suporte dos tenants com atribuição a admins';
COMMENT ON TABLE public.support_messages IS 'Chat de suporte dentro de cada ticket';
COMMENT ON TABLE public.audit_log IS 'Auditoria de ações críticas para compliance e investigação';

COMMENT ON COLUMN public.error_logs.severity IS 'Nível de severidade: low, medium, high, critical';
COMMENT ON COLUMN public.error_logs.correlation_id IS 'ID para agrupar erros relacionados (ex: erro cascata)';
COMMENT ON COLUMN public.audit_log.is_critical IS 'True para ações críticas que requerem notificação imediata';

-- ============================================================================
-- PARTE 10: FUNÇÃO HELPER PARA REGISTRAR AUDITORIA
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_audit(
    p_user_id UUID,
    p_tenant_id UUID,
    p_action TEXT,
    p_entity_type TEXT,
    p_entity_id UUID,
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_changes_description TEXT DEFAULT NULL,
    p_is_critical BOOLEAN DEFAULT false
) RETURNS UUID AS $$
DECLARE
    audit_id UUID;
BEGIN
    INSERT INTO public.audit_log (
        user_id, tenant_id, action, entity_type, entity_id,
        old_values, new_values, changes_description, is_critical
    ) VALUES (
        p_user_id, p_tenant_id, p_action, p_entity_type, p_entity_id,
        p_old_values, p_new_values, p_changes_description, p_is_critical
    )
    RETURNING id INTO audit_id;
    
    RETURN audit_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 11: FUNÇÃO HELPER PARA REGISTRAR ERRO
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_error(
    p_error_code TEXT,
    p_error_message TEXT,
    p_tenant_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT 'medium',
    p_http_method VARCHAR(10) DEFAULT NULL,
    p_http_path VARCHAR(500) DEFAULT NULL,
    p_http_status_code INTEGER DEFAULT NULL,
    p_correlation_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    error_id UUID;
BEGIN
    INSERT INTO public.error_logs (
        tenant_id, user_id, error_code, error_message, severity,
        http_method, http_path, http_status_code, correlation_id
    ) VALUES (
        p_tenant_id, p_user_id, p_error_code, p_error_message, p_severity,
        p_http_method, p_http_path, p_http_status_code, p_correlation_id
    )
    RETURNING id INTO error_id;
    
    RETURN error_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PARTE 12: HABILITAR RLS NESSAS NOVAS TABELAS
-- ============================================================================

ALTER TABLE public.system_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
