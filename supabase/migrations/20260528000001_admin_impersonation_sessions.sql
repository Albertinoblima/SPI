-- ============================================================================
-- MIGRATION: Admin Impersonation Sessions (Fase 1 - Operational Tools)
-- Descrição: Permite que System Admins assumam temporariamente a identidade
--            de um tenant para fins de suporte e debug, com auditoria completa.
-- ============================================================================

-- 1. Tabela principal de sessões de impersonation
CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    target_tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz,

    ip_address text,
    user_agent text,

    is_active boolean NOT NULL DEFAULT true,

    created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_impersonation_sessions IS 
'Sessões de impersonation. Um system_admin pode atuar como um tenant específico por um período.';

-- Índices
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_admin ON public.admin_impersonation_sessions(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_tenant ON public.admin_impersonation_sessions(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_impersonation_active ON public.admin_impersonation_sessions(is_active) WHERE is_active = true;

-- 2. RLS Policies
ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;

-- Apenas system_admins podem ver e gerenciar sessões
CREATE POLICY "admin_impersonation_select_system_admin"
ON public.admin_impersonation_sessions
FOR SELECT
USING (public.is_system_admin());

CREATE POLICY "admin_impersonation_insert_system_admin"
ON public.admin_impersonation_sessions
FOR INSERT
WITH CHECK (public.is_system_admin());

CREATE POLICY "admin_impersonation_update_system_admin"
ON public.admin_impersonation_sessions
FOR UPDATE
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- 3. Função helper para verificar se o usuário atual está em modo impersonation
CREATE OR REPLACE FUNCTION public.current_impersonated_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT target_tenant_id
    FROM public.admin_impersonation_sessions
    WHERE admin_user_id = auth.uid()
      AND is_active = true
      AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_impersonated_tenant_id() IS 
'Retorna o tenant_id que o system_admin atual está impersonando, se houver.';

-- 4. Atualizar a função is_system_admin para também considerar contexto de impersonation (se necessário no futuro)
-- Por enquanto, mantemos separada.

-- 5. Trigger para garantir que só exista uma sessão ativa por admin por vez (melhor prática)
CREATE OR REPLACE FUNCTION public.enforce_single_active_impersonation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Desativa qualquer outra sessão ativa do mesmo admin
    UPDATE public.admin_impersonation_sessions
    SET is_active = false,
        ended_at = now()
    WHERE admin_user_id = NEW.admin_user_id
      AND id != NEW.id
      AND is_active = true;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_single_impersonation
BEFORE INSERT ON public.admin_impersonation_sessions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_single_active_impersonation();

-- 6. Política extra: System admins podem ver tenants mesmo durante impersonation (já existe via is_system_admin)
-- Nada adicional necessário aqui.