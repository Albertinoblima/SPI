import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * Creates a Supabase server client for use in Route Handlers and Server Components.
 * 
 * Note: In Next.js 14+, cookies() returns a Promise in async contexts.
 * This function is async to handle both sync and async usage safely.
 */
export async function createSupabaseServerClient() {
  const { cookies } = await import('next' + '/headers');
  const cookieStore = await cookies();

  return createServerClient(
    process.env['NEXT_PUBLIC_SUPABASE_URL']!,
    process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY']!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set(name, value, options);
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.delete(name);
        },
      },
    }
  );
}
