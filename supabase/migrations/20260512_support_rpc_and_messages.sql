-- ============================================================================
-- Suporte: funÃ§Ã£o RPC para incrementar response_count e rota de mensagens admin
-- ============================================================================

-- FunÃ§Ã£o: incrementar contador de respostas de um ticket
CREATE OR REPLACE FUNCTION public.increment_ticket_response_count(ticket_uuid UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.support_tickets
  SET response_count = COALESCE(response_count, 0) + 1,
      updated_at = now()
  WHERE id = ticket_uuid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_ticket_response_count(UUID) TO authenticated;
