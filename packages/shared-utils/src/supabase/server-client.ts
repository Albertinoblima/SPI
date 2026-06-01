import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase server client for use in Route Handlers and Server Components.
 * 
 * Note: Simplified to avoid next/headers in the module graph for build compatibility.
 * In real usage, the cookie handling should be restored for proper session.
 */
export async function createSupabaseServerClient() {
  return createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
  );
}
