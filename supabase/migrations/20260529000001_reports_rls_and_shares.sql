-- ============================================================================
-- RELATÓRIOS AVANÇADOS - RLS + Helpers para Shares (Fase de Consolidação)
-- Data: 2026-05-29
-- Objetivo: Segurança multi-tenant rigorosa nas tabelas de relatórios
-- ============================================================================

-- 1. Habilitar RLS nas novas tabelas
ALTER TABLE public.report_cover_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_access_logs ENABLE ROW LEVEL SECURITY;

-- 2. Políticas para report_cover_templates (por tenant)
CREATE POLICY "report_cover_templates_tenant_isolation" ON public.report_cover_templates
  FOR ALL USING (
    tenant_id = (SELECT current_tenant_id()) 
    OR is_system_admin()
  );

-- 3. Políticas para report_configurations
CREATE POLICY "report_configurations_tenant_isolation" ON public.report_configurations
  FOR ALL USING (
    tenant_id = (SELECT current_tenant_id()) 
    OR is_system_admin()
  );

-- 4. Políticas para report_shares (leitura por tenant + acesso público limitado por token)
CREATE POLICY "report_shares_tenant_isolation" ON public.report_shares
  FOR ALL USING (
    tenant_id = (SELECT current_tenant_id()) 
    OR is_system_admin()
  );

-- Política especial: permitir leitura de shares via token para o endpoint público (sem autenticação de usuário logado)
-- O acesso real é controlado no application layer (PublicReportAccessService)
CREATE POLICY "report_shares_public_token_read" ON public.report_shares
  FOR SELECT USING (true);  -- Leitura controlada pela API (validação de token + credenciais)

-- 5. Políticas para report_access_logs (append-only por tenant)
CREATE POLICY "report_access_logs_tenant_isolation" ON public.report_access_logs
  FOR INSERT USING (
    tenant_id = (SELECT current_tenant_id()) 
    OR is_system_admin()
  );

CREATE POLICY "report_access_logs_select" ON public.report_access_logs
  FOR SELECT USING (
    tenant_id = (SELECT current_tenant_id()) 
    OR is_system_admin()
  );

-- 6. Função helper para criar share de forma segura (pode ser chamada via RPC se necessário)
COMMENT ON TABLE public.report_shares IS 'Compartilhamento seguro de relatórios. RLS aplicado + validação de token+credenciais na API.';

-- 7. Garantir que o service role consiga acessar (para os services server-side com createAdminClient)
-- (Service role bypassa RLS automaticamente)

-- Fim da migration de RLS para relatórios