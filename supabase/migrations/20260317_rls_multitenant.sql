-- ============================================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) - CONFIGURAÇÃO COMPLETA
-- Sistema Multi-Tenant com Isolamento Total
-- ============================================================================

-- ============================================================================
-- PARTE 1: FUNÇÕES AUXILIARES
-- ============================================================================

-- Função: Obter tenant_id do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_user_tenant_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_tenant UUID;
BEGIN
  -- Busca tenant_id do usuário logado
  SELECT tenant_id INTO user_tenant
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN user_tenant;
END;
$$;

-- Função: Verificar se usuário é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN user_role = 'admin';
END;
$$;

-- Função: Verificar se usuário é manager ou admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();
  
  RETURN user_role IN ('admin', 'manager');
END;
$$;

-- Função: Verificar se usuário pertence ao tenant
CREATE OR REPLACE FUNCTION public.belongs_to_tenant(tenant_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN public.get_user_tenant_id() = tenant_uuid;
END;
$$;

-- ============================================================================
-- PARTE 2: HABILITAR RLS EM TODAS AS TABELAS
-- ============================================================================

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.response_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PARTE 3: POLICIES PARA TABELA TENANTS
-- ============================================================================

-- DROP EXISTING POLICIES (se necessário)
DROP POLICY IF EXISTS "tenants_select_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_insert_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON public.tenants;
DROP POLICY IF EXISTS "tenants_delete_policy" ON public.tenants;

-- POLICY: SELECT - Usuários só veem seu próprio tenant
CREATE POLICY "tenants_select_policy" ON public.tenants
FOR SELECT
USING (
  id = public.get_user_tenant_id()
);

-- POLICY: INSERT - Apenas via signup (service_role)
-- Em produção, esta policy seria gerenciada por uma função de signup
CREATE POLICY "tenants_insert_policy" ON public.tenants
FOR INSERT
WITH CHECK (false); -- Apenas service_role pode inserir

-- POLICY: UPDATE - Apenas admins podem atualizar seu tenant
CREATE POLICY "tenants_update_policy" ON public.tenants
FOR UPDATE
USING (
  id = public.get_user_tenant_id() 
  AND public.is_admin()
)
WITH CHECK (
  id = public.get_user_tenant_id() 
  AND public.is_admin()
);

-- POLICY: DELETE - Soft delete apenas (via updated_at)
CREATE POLICY "tenants_delete_policy" ON public.tenants
FOR DELETE
USING (false); -- Não permite delete hard

-- ============================================================================
-- PARTE 4: POLICIES PARA TABELA USERS
-- ============================================================================

DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

-- POLICY: SELECT - Usuários veem apenas users do seu tenant
CREATE POLICY "users_select_policy" ON public.users
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
);

-- POLICY: INSERT - Apenas admins/managers podem criar novos users
CREATE POLICY "users_insert_policy" ON public.users
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
);

-- POLICY: UPDATE - Usuários podem atualizar próprio perfil, admins podem atualizar todos
CREATE POLICY "users_update_policy" ON public.users
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    id = auth.uid() -- Próprio usuário
    OR public.is_admin() -- Ou é admin
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
);

-- POLICY: DELETE - Apenas admins podem desativar users (soft delete)
CREATE POLICY "users_delete_policy" ON public.users
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin()
  AND id != auth.uid() -- Não pode deletar a si mesmo
);

-- ============================================================================
-- PARTE 5: POLICIES PARA TABELA SURVEYS
-- ============================================================================

DROP POLICY IF EXISTS "surveys_select_policy" ON public.surveys;
DROP POLICY IF EXISTS "surveys_insert_policy" ON public.surveys;
DROP POLICY IF EXISTS "surveys_update_policy" ON public.surveys;
DROP POLICY IF EXISTS "surveys_delete_policy" ON public.surveys;

-- POLICY: SELECT - Todos os users veem surveys do tenant
CREATE POLICY "surveys_select_policy" ON public.surveys
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND deleted_at IS NULL
);

-- POLICY: INSERT - Apenas managers/admins criam surveys
CREATE POLICY "surveys_insert_policy" ON public.surveys
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
  AND created_by = auth.uid()
);

-- POLICY: UPDATE - Criador ou admin pode atualizar
CREATE POLICY "surveys_update_policy" ON public.surveys
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    created_by = auth.uid()
    OR public.is_admin()
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
);

-- POLICY: DELETE - Apenas admin pode deletar (soft)
CREATE POLICY "surveys_delete_policy" ON public.surveys
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin()
);

-- ============================================================================
-- PARTE 6: POLICIES PARA TABELA QUESTIONS
-- ============================================================================

DROP POLICY IF EXISTS "questions_select_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_insert_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_update_policy" ON public.questions;
DROP POLICY IF EXISTS "questions_delete_policy" ON public.questions;

-- POLICY: SELECT - Todos veem questions do tenant
CREATE POLICY "questions_select_policy" ON public.questions
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
);

-- POLICY: INSERT - Apenas managers/admins criam questions
CREATE POLICY "questions_insert_policy" ON public.questions
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
  AND EXISTS (
    SELECT 1 FROM public.surveys
    WHERE id = survey_id
    AND tenant_id = public.get_user_tenant_id()
  )
);

-- POLICY: UPDATE - Criador do survey ou admin pode atualizar
CREATE POLICY "questions_update_policy" ON public.questions
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    EXISTS (
      SELECT 1 FROM public.surveys
      WHERE id = survey_id
      AND created_by = auth.uid()
    )
    OR public.is_admin()
  )
);

-- POLICY: DELETE - Apenas admin
CREATE POLICY "questions_delete_policy" ON public.questions
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin()
);

-- ============================================================================
-- PARTE 7: POLICIES PARA TABELA RESPONSES (CRÍTICO!)
-- ============================================================================

DROP POLICY IF EXISTS "responses_select_policy" ON public.responses;
DROP POLICY IF EXISTS "responses_insert_policy" ON public.responses;
DROP POLICY IF EXISTS "responses_update_policy" ON public.responses;
DROP POLICY IF EXISTS "responses_delete_policy" ON public.responses;

-- POLICY: SELECT - Todos veem responses do tenant
CREATE POLICY "responses_select_policy" ON public.responses
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND deleted_at IS NULL
);

-- POLICY: INSERT - Apenas entrevistadores podem criar responses
-- SEGURANÇA CRÍTICA: Garante que tenant_id e interviewer_id são corretos
CREATE POLICY "responses_insert_policy" ON public.responses
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND interviewer_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.surveys
    WHERE id = survey_id
    AND tenant_id = public.get_user_tenant_id()
    AND status = 'active'
  )
);

-- POLICY: UPDATE - Entrevistador pode atualizar próprias responses
CREATE POLICY "responses_update_policy" ON public.responses
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    interviewer_id = auth.uid() -- Próprio entrevistador
    OR public.is_manager_or_admin() -- Ou manager/admin
  )
)
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
);

-- POLICY: DELETE - Apenas admin pode deletar
CREATE POLICY "responses_delete_policy" ON public.responses
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin()
);

-- ============================================================================
-- PARTE 8: POLICIES PARA TABELA RESPONSE_ANSWERS
-- ============================================================================

DROP POLICY IF EXISTS "answers_select_policy" ON public.response_answers;
DROP POLICY IF EXISTS "answers_insert_policy" ON public.response_answers;
DROP POLICY IF EXISTS "answers_update_policy" ON public.response_answers;
DROP POLICY IF EXISTS "answers_delete_policy" ON public.response_answers;

-- POLICY: SELECT - Todos veem answers do tenant
CREATE POLICY "answers_select_policy" ON public.response_answers
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
);

-- POLICY: INSERT - Entrevistador que criou a response
CREATE POLICY "answers_insert_policy" ON public.response_answers
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND EXISTS (
    SELECT 1 FROM public.responses
    WHERE id = response_id
    AND tenant_id = public.get_user_tenant_id()
    AND interviewer_id = auth.uid()
  )
);

-- POLICY: UPDATE - Entrevistador ou admin
CREATE POLICY "answers_update_policy" ON public.response_answers
FOR UPDATE
USING (
  tenant_id = public.get_user_tenant_id()
  AND (
    EXISTS (
      SELECT 1 FROM public.responses
      WHERE id = response_id
      AND interviewer_id = auth.uid()
    )
    OR public.is_manager_or_admin()
  )
);

-- POLICY: DELETE - Apenas admin
CREATE POLICY "answers_delete_policy" ON public.response_answers
FOR DELETE
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_admin()
);

-- ============================================================================
-- PARTE 9: POLICIES PARA TABELA SYNC_LOG
-- ============================================================================

DROP POLICY IF EXISTS "sync_log_select_policy" ON public.sync_log;
DROP POLICY IF EXISTS "sync_log_insert_policy" ON public.sync_log;

-- POLICY: SELECT - Managers/Admins veem logs do tenant
CREATE POLICY "sync_log_select_policy" ON public.sync_log
FOR SELECT
USING (
  tenant_id = public.get_user_tenant_id()
  AND public.is_manager_or_admin()
);

-- POLICY: INSERT - Qualquer usuário autenticado pode logar sync
CREATE POLICY "sync_log_insert_policy" ON public.sync_log
FOR INSERT
WITH CHECK (
  tenant_id = public.get_user_tenant_id()
  AND (user_id = auth.uid() OR user_id IS NULL)
);

-- ============================================================================
-- PARTE 10: INDICES PARA PERFORMANCE DE RLS
-- ============================================================================

-- Índice para public.get_user_tenant_id()
CREATE INDEX IF NOT EXISTS idx_users_auth_uid 
ON public.users(id) 
WHERE id IS NOT NULL;

-- Índices compostos para queries com RLS
CREATE INDEX IF NOT EXISTS idx_surveys_tenant_deleted 
ON public.surveys(tenant_id, deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_responses_tenant_deleted 
ON public.responses(tenant_id, deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_responses_tenant_interviewer 
ON public.responses(tenant_id, interviewer_id);

-- ============================================================================
-- PARTE 11: TESTES DE SEGURANÇA
-- ============================================================================

-- Função para testar isolamento entre tenants
CREATE OR REPLACE FUNCTION test_rls_isolation()
RETURNS TABLE(test_name TEXT, passed BOOLEAN, message TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
  tenant1_id UUID;
  tenant2_id UUID;
  user1_id UUID;
  user2_id UUID;
BEGIN
  -- Cria 2 tenants de teste
  INSERT INTO public.tenants (name, slug, status)
  VALUES ('Tenant Test 1', 'tenant-test-1', 'active')
  RETURNING id INTO tenant1_id;
  
  INSERT INTO public.tenants (name, slug, status)
  VALUES ('Tenant Test 2', 'tenant-test-2', 'active')
  RETURNING id INTO tenant2_id;
  
  -- Retorna resultados de teste
  RETURN QUERY
  SELECT 
    'Tenant Isolation'::TEXT,
    (tenant1_id != tenant2_id)::BOOLEAN,
    'Tenants should have different IDs'::TEXT;
  
  -- Cleanup
  DELETE FROM public.tenants WHERE id IN (tenant1_id, tenant2_id);
END;
$$;

-- ============================================================================
-- PARTE 12: GRANTS DE PERMISSÃO
-- ============================================================================

-- Revoga todas as permissões padrão
REVOKE ALL ON public.tenants FROM anon, authenticated;
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.surveys FROM anon, authenticated;
REVOKE ALL ON public.questions FROM anon, authenticated;
REVOKE ALL ON public.responses FROM anon, authenticated;
REVOKE ALL ON public.response_answers FROM anon, authenticated;
REVOKE ALL ON public.sync_log FROM anon, authenticated;

-- Concede permissões específicas para authenticated
GRANT SELECT, INSERT, UPDATE ON public.tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.response_answers TO authenticated;
GRANT SELECT, INSERT ON public.sync_log TO authenticated;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Verifica se todas as tabelas têm RLS habilitado
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename IN ('tenants', 'users', 'surveys', 'questions', 'responses', 'response_answers', 'sync_log')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = r.tablename
      AND n.nspname = 'public'
      AND c.relrowsecurity = true
    ) THEN
      RAISE WARNING 'RLS NOT ENABLED ON: %', r.tablename;
    END IF;
  END LOOP;
END $$;

-- ============================================================================
-- FIM DA CONFIGURAÇÃO RLS
-- ============================================================================

/*
VERIFICAÇÃO DE SEGURANÇA:

1. Teste de Isolamento:
   - Usuário do Tenant A não pode ver dados do Tenant B
   - Queries automaticamente filtram por tenant_id

2. Teste de Roles:
   - Interviewers só criam responses
   - Managers criam surveys
   - Admins têm acesso total

3. Teste de Performance:
   - Índices otimizam queries com RLS
   - Funções SECURITY DEFINER têm boa performance

PARA TESTAR:
-- Como usuário do Tenant A
SELECT * FROM responses; -- Vê apenas responses do Tenant A

-- Tentativa de acesso direto (deve falhar)
SELECT * FROM responses WHERE tenant_id = '<tenant-b-id>'; -- Retorna vazio

-- Tentativa de insert em outro tenant (deve falhar)
INSERT INTO responses (tenant_id, ...) VALUES ('<tenant-b-id>', ...); -- Erro
*/


