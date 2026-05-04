-- Sistema de notificaÃ§Ãµes: respostas de tickets + broadcasts do admin para empresas

-- Tabela principal de notificaÃ§Ãµes
CREATE TABLE IF NOT EXISTS public.notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type         TEXT NOT NULL CHECK (type IN ('ticket_reply', 'broadcast', 'system')),
    title        TEXT NOT NULL,
    message      TEXT NOT NULL,
    -- Alvo: 'all' = todas as empresas, 'tenant' = empresa especÃ­fica, 'user' = usuÃ¡rio especÃ­fico
    target_type  TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'tenant', 'user')),
    tenant_id    UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_by   UUID REFERENCES auth.users(id),
    ticket_id    UUID,  -- referÃªncia ao ticket quando type = 'ticket_reply'
    data         JSONB DEFAULT '{}',
    created_at   TIMESTAMPTZ DEFAULT now()
);

-- Tabela de leituras (quem leu o quÃª)
CREATE TABLE IF NOT EXISTS public.notification_reads (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    read_at         TIMESTAMPTZ DEFAULT now(),
    UNIQUE(notification_id, user_id)
);

-- Ãndices de performance
CREATE INDEX IF NOT EXISTS idx_notifications_tenant_id ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_reads_user ON public.notification_reads(user_id);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_notifications" ON public.notifications;
DROP POLICY IF EXISTS "sysadmin_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "sysadmin_select_all_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_insert_reads" ON public.notification_reads;
DROP POLICY IF EXISTS "users_select_reads" ON public.notification_reads;

-- UsuÃ¡rios veem notificaÃ§Ãµes destinadas a eles, ao seu tenant ou a todos
CREATE POLICY "users_select_notifications" ON public.notifications
    FOR SELECT USING (
        target_type = 'all'
        OR tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()))
        OR user_id = (SELECT auth.uid())
    );

-- Somente admins do sistema podem criar notificaÃ§Ãµes
CREATE POLICY "sysadmin_insert_notifications" ON public.notifications
    FOR INSERT WITH CHECK (
        (SELECT is_system_admin()) = true
    );

-- Admins podem ver todas as notificaÃ§Ãµes
CREATE POLICY "sysadmin_select_all_notifications" ON public.notifications
    FOR SELECT USING (
        (SELECT is_system_admin()) = true
    );

-- UsuÃ¡rios controlam suas prÃ³prias leituras
CREATE POLICY "users_insert_reads" ON public.notification_reads
    FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "users_select_reads" ON public.notification_reads
    FOR SELECT USING (user_id = (SELECT auth.uid()));

-- FunÃ§Ã£o para criar notificaÃ§Ã£o de resposta de ticket (chamada internamente)
CREATE OR REPLACE FUNCTION public.create_ticket_reply_notification(
    p_ticket_id   UUID,
    p_ticket_title TEXT,
    p_user_id     UUID,
    p_tenant_id   UUID,
    p_admin_id    UUID
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.notifications (type, title, message, target_type, user_id, tenant_id, created_by, ticket_id)
    VALUES (
        'ticket_reply',
        'Resposta no ticket: ' || p_ticket_title,
        'O suporte respondeu ao seu ticket. Clique para ver a resposta.',
        'user',
        p_user_id,
        p_tenant_id,
        p_admin_id,
        p_ticket_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_ticket_reply_notification(UUID, TEXT, UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ticket_reply_notification(UUID, TEXT, UUID, UUID, UUID) TO service_role;

