/**
 * Re-export da implementação centralizada em shared-utils.
 * 
 * Agora retorna { supabase, applyCookies } para suportar propagação de cookies de sessão
 * em Route Handlers (compatível com o padrão usado em /api/auth/login).
 * 
 * Uso: const { supabase, applyCookies } = await createClient();
 *      return applyCookies( apiSuccess(...) );
 *
 * @see packages/shared-utils/src/supabase/server-client.ts
 */
export { createSupabaseServerClient as createClient } from '@political-research/shared-utils/src/supabase/server-client';
