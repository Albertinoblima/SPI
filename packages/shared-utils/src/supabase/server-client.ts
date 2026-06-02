import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

type PendingCookie = {
    name: string;
    value: string;
    options: CookieOptions;
};

/**
 * Creates a proper Supabase SSR server client for Route Handlers and Server Components.
 * Reads auth session from cookies so getUser() works after login.
 * Returns applyCookies() helper so that any session-refresh cookies set during
 * the request are propagated to the final response (critical for route handlers).
 */
export async function createSupabaseServerClient() {
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
                    // Mark for the current request's cookieStore and collect for response apply
                    try {
                        cookieStore.set(name, value, options);
                    } catch {
                        // In some RSC contexts set may be restricted; collect anyway
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
        applyCookies(response: any) {
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
