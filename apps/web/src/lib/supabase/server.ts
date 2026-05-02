// Supabase Server Client - @supabase/ssr v0.3.0 usa get/set/remove
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
    const cookieStore = cookies();

    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
                set(name: string, value: string, options: Record<string, unknown>) {
                    try {
                        cookieStore.set(name, value, options);
                    } catch {
                        // Server Component - ignore
                    }
                },
                remove(name: string, options: Record<string, unknown>) {
                    try {
                        cookieStore.delete({ name, ...options });
                    } catch {
                        // Server Component - ignore
                    }
                },
            },
        }
    );
}
