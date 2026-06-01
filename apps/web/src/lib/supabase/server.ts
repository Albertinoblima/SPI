/**
 * Re-export da implementação centralizada em shared-utils.
 * 
 * Uso preferencial para Server Components e Route Handlers.
 * 
 * @see packages/shared-utils/src/supabase/server-client.ts
 */
export { createSupabaseServerClient as createClient } from '@political-research/shared-utils/src/supabase/server-client';
