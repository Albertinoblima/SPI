import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

type PendingCookie = {
    name: string;
    value: string;
    options: CookieOptions;
};

export function createRouteHandlerClient() {
    const cookieStore = cookies();
    const pendingCookies: PendingCookie[] = [];

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    cookieStore.set(name, value, options);
                    pendingCookies.push({ name, value, options });
                },
                remove(name: string, options: CookieOptions) {
                    cookieStore.delete({ name, ...options });
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