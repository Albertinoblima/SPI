import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type PendingCookie = {
    name: string;
    value: string;
    options: CookieOptions;
};

/**
 * Web-only Supabase SSR server client.
 *
 * - Uses @supabase/ssr + next/headers cookies so that getUser() sees the session
 *   after login (critical for /api/dashboard, /api/settings/company, surveys, team, etc.).
 * - Returns { supabase, applyCookies } so protected route handlers can propagate
 *   any refreshed auth cookies back to the client (same pattern as createRouteHandlerClient).
 *
 * This must stay inside apps/web (never in shared-utils) because:
 *   - It depends on "next" (headers, server).
 *   - Mobile (EAS) depends on @political-research/shared-utils and would break.
 *
 * All web code should import via: import { createClient } from '@/lib/supabase/server'
 */
export async function createClient() {
    const cookieStore = await cookies();
    const pendingCookies: PendingCookie[] = [];

    const supabase = createServerClient(
        process.env['NEXT_PUBLIC_SUPABASE_URL']!,
        process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    try {
                        cookieStore.set(name, value, options);
                    } catch {
                        /* ignore in restricted contexts */
                    }
                    pendingCookies.push({ name, value, options });
                },
                remove(name: string, options: CookieOptions) {
                    try {
                        cookieStore.delete({ name, ...options });
                    } catch {
                        /* ignore */
                    }
                    pendingCookies.push({ name, value: '', options });
                },
            },
        }
    );

    return {
        supabase,
        applyCookies(response: NextResponse) {
            pendingCookies.forEach((cookie) => {
                response.cookies.set({
                    name: cookie.name,
                    value: cookie.value,
                    ...cookie.options,
                });
            });
            return response;
        },
    };
}
