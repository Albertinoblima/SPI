import { createClient } from '@supabase/supabase-js';

/**
 * Creates a Supabase server client for use in Route Handlers and Server Components.
 *
 * IMPORTANT: This is intentionally a *minimal/plain* client (no next/headers, no cookie
 * SSR adapter). It is safe to be depended on by the mobile app (EAS/React Native).
 *
 * Web-specific authenticated SSR client (with cookies + applyCookies for session
 * propagation after signIn) lives in apps/web/src/lib/supabase/server.ts and is
 * the one used by all protected web API routes.
 *
 * Adding next/@supabase/ssr here would break mobile builds (and was the cause of
 * the EAS + web-deploy npm ci failures on commit 80e5887).
 */
export async function createSupabaseServerClient() {
  return createClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!
  );
}
