-- ============================================================================
-- MIGRATION: 20260501_rls_policies_admin_audit.sql
-- Descrição: Row Level Security para system_admin e tabelas de auditoria
-- Data: 2026-05-01
-- ============================================================================

-- ============================================================================
-- PARTE 1: ATUALIZAR FUNÇÃO HELPER PARA VERIFICAR SYSTEM_ADMIN
-- ============================================================================

-- Função: Verificar se usuário é system_admin
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  SELECT is_system_admin INTO is_admin
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN COALESCE(is_admin, false);
END;
$$;

-- ============================================================================
-- PARTE 2: POLICIES PARA TABELA SYSTEM_ANALYTICS
-- ============================================================================

DROP POLICY IF EXISTS "system_analytics_select_policy" ON public.system_analytics;
DROP POLICY IF EXISTS "system_analytics_insert_policy" ON public.system_analytics;
DROP POLICY IF EXISTS "system_analytics_update_policy" ON public.system_analytics;
DROP POLICY IF EXISTS "system_analytics_delete_policy" ON public.system_analytics;

-- POLICY: SELECT - Apenas system_admin pode ler
CREATE POLICY "system_analytics_select_policy" ON public.system_analytics
FOR SELECT
USING (public.is_system_admin());

-- POLICY: INSERT - Apenas service_role (backend) pode inserir
CREATE POLICY "system_analytics_insert_policy" ON public.system_analytics
FOR INSERT
WITH CHECK (false);

-- POLICY: UPDATE - Apenas service_role pode atualizar
CREATE POLICY "system_analytics_update_policy" ON public.system_analytics
FOR UPDATE
USING (false);

-- POLICY: DELETE - Não permitir delete
CREATE POLICY "system_analytics_delete_policy" ON public.system_analytics
FOR DELETE
USING (false);

-- ============================================================================
-- PARTE 3: POLICIES PARA TABELA ERROR_LOGS
-- ============================================================================

DROP POLICY IF EXISTS "error_logs_select_system_admin" ON public.error_logs;
DROP POLICY IF EXISTS "error_logs_select_tenant_admin" ON public.error_logs;
DROP POLICY IF EXISTS "error_logs_insert_policy" ON public.error_logs;
DROP POLICY IF EXISTS "error_logs_update_system_admin" ON public.error_logs;
DROP POLICY IF EXISTS "error_logs_delete_policy" ON public.error_logs;

-- POLICY: SELECT - System_admin vê tudo, tenant admin vê seu tenant
CREATE POLICY "error_logs_select_system_admin" ON public.error_logs
FOR SELECT
USING (public.is_system_admin());

CREATE POLICY "error_logs_select_tenant_admin" ON public.error_logs
FOR SELECT
USING (
  NOT public.is_system_admin()
  AND tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
);

-- POLICY: INSERT - Backend (service_role) insere logs de erro
CREATE POLICY "error_logs_insert_policy" ON public.error_logs
FOR INSERT
WITH CHECK (false);

-- POLICY: UPDATE - System_admin pode resolver erros
CREATE POLICY "error_logs_update_system_admin" ON public.error_logs
FOR UPDATE
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- POLICY: DELETE - Não permitir delete
CREATE POLICY "error_logs_delete_policy" ON public.error_logs
FOR DELETE
USING (false);

-- ============================================================================
-- PARTE 4: POLICIES PARA TABELA SUPPORT_TICKETS
-- ============================================================================

DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_tenant_admin" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_select_system_admin" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert_policy" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_own" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_update_assigned" ON public.support_tickets;
DROP POLICY IF EXISTS "support_tickets_delete_policy" ON public.support_tickets;

-- POLICY: SELECT - Usuário vê seus próprios tickets
CREATE POLICY "support_tickets_select_own" ON public.support_tickets
FOR SELECT
USING (
  NOT public.is_system_admin()
  AND user_id = auth.uid()
);

-- POLICY: SELECT - Tenant admin vê todos do seu tenant
CREATE POLICY "support_tickets_select_tenant_admin" ON public.support_tickets
FOR SELECT
USING (
  NOT public.is_system_admin()
  AND tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
);

-- POLICY: SELECT - System_admin vê tudo
CREATE POLICY "support_tickets_select_system_admin" ON public.support_tickets
FOR SELECT
USING (public.is_system_admin());

-- POLICY: INSERT - Usuários do tenant podem criar tickets
CREATE POLICY "support_tickets_insert_policy" ON public.support_tickets
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND user_id = auth.uid()
);

-- POLICY: UPDATE - Proprietário ou admin do tenant pode atualizar
CREATE POLICY "support_tickets_update_own" ON public.support_tickets
FOR UPDATE
USING (
  NOT public.is_system_admin()
  AND tenant_id = public.get_user_tenant_id()
  AND user_id = auth.uid()
)
WITH CHECK (
  NOT public.is_system_admin()
  AND tenant_id = public.get_user_tenant_id()
);

-- POLICY: UPDATE - Admin do tenant pode atualizar
CREATE POLICY "support_tickets_update_assigned" ON public.support_tickets
FOR UPDATE
USING (
  NOT public.is_system_admin()
  AND tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
);

-- POLICY: UPDATE - System_admin pode atualizar (atribuição)
CREATE POLICY "support_tickets_update_system_admin" ON public.support_tickets
FOR UPDATE
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- POLICY: DELETE - Não permitir delete
CREATE POLICY "support_tickets_delete_policy" ON public.support_tickets
FOR DELETE
USING (false);

-- ============================================================================
-- PARTE 5: POLICIES PARA TABELA SUPPORT_MESSAGES
-- ============================================================================

DROP POLICY IF EXISTS "support_messages_select_own" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_select_tenant_admin" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_select_system_admin" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_insert_policy" ON public.support_messages;
DROP POLICY IF EXISTS "support_messages_delete_policy" ON public.support_messages;

-- POLICY: SELECT - Usuário vê mensagens do seu ticket
CREATE POLICY "support_messages_select_own" ON public.support_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = support_messages.ticket_id
    AND st.user_id = auth.uid()
  )
);

-- POLICY: SELECT - Admin do tenant vê mensagens do seu tenant
CREATE POLICY "support_messages_select_tenant_admin" ON public.support_messages
FOR SELECT
USING (
  NOT public.is_system_admin()
  AND EXISTS (
    SELECT 1 FROM public.support_tickets st
    WHERE st.id = support_messages.ticket_id
    AND st.tenant_id = public.get_user_tenant_id()
    AND public.is_manager_or_admin()
  )
);

-- POLICY: SELECT - System_admin vê tudo
CREATE POLICY "support_messages_select_system_admin" ON public.support_messages
FOR SELECT
USING (public.is_system_admin());

-- POLICY: INSERT - Pode escrever em seus próprios tickets ou sendo admin
CREATE POLICY "support_messages_insert_policy" ON public.support_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND (
    -- Caso 1: Usuário em seu próprio ticket
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_id
      AND st.user_id = auth.uid()
    )
    -- Caso 2: Admin do tenant respondendo
    OR (
      public.is_manager_or_admin()
      AND EXISTS (
        SELECT 1 FROM public.support_tickets st
        WHERE st.id = ticket_id
        AND st.tenant_id = public.get_user_tenant_id()
      )
    )
    -- Caso 3: System_admin respondendo
    OR public.is_system_admin()
  )
);

-- POLICY: DELETE - Não permitir delete
CREATE POLICY "support_messages_delete_policy" ON public.support_messages
FOR DELETE
USING (false);

-- ============================================================================
-- PARTE 6: POLICIES PARA TABELA AUDIT_LOG
-- ============================================================================

DROP POLICY IF EXISTS "audit_log_select_system_admin" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_select_tenant" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_insert_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_update_policy" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_delete_policy" ON public.audit_log;

-- POLICY: SELECT - System_admin vê tudo
CREATE POLICY "audit_log_select_system_admin" ON public.audit_log
FOR SELECT
USING (public.is_system_admin());

-- POLICY: SELECT - Admin do tenant vê ações do seu tenant
CREATE POLICY "audit_log_select_tenant" ON public.audit_log
FOR SELECT
USING (
  NOT public.is_system_admin()
  AND tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
);

-- POLICY: INSERT - Backend (service_role) insere logs
CREATE POLICY "audit_log_insert_policy" ON public.audit_log
FOR INSERT
WITH CHECK (false);

-- POLICY: UPDATE - Não permitir update
CREATE POLICY "audit_log_update_policy" ON public.audit_log
FOR UPDATE
USING (false);

-- POLICY: DELETE - Não permitir delete
CREATE POLICY "audit_log_delete_policy" ON public.audit_log
FOR DELETE
USING (false);

-- ============================================================================
-- PARTE 7: ATUALIZAR POLICIES EXISTENTES PARA RESPEITAR SYSTEM_ADMIN
-- ============================================================================

-- TABELA: TENANTS
-- System_admin pode ler todos os tenants
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
CREATE POLICY "tenants_select_policy" ON public.tenants
FOR SELECT
USING (
  id = public.get_user_tenant_id()
  OR public.is_system_admin()
);

-- ============================================================================
-- PARTE 8: SEED DATA INICIAL (COMENTADO)
-- ============================================================================

-- Descomente e execute para criar um system_admin inicial
-- Para executar manualmente após criar user no Supabase Auth:
-- UPDATE public.users SET is_system_admin = true WHERE email = 'albertinoblima@gmail.com';

-- ============================================================================
-- FIM DA MIGRATION
-- ============================================================================
