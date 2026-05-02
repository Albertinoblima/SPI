// Supabase Auth Middleware
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: Record<string, unknown>) {
                    request.cookies.set(name, value, options as Parameters<typeof request.cookies.set>[2]);
                    supabaseResponse = NextResponse.next({ request });
                    supabaseResponse.cookies.set(name, value, options as Parameters<typeof supabaseResponse.cookies.set>[2]);
                },
                remove(name: string, options: Record<string, unknown>) {
                    request.cookies.set(name, '', options as Parameters<typeof request.cookies.set>[2]);
                    supabaseResponse = NextResponse.next({ request });
                    supabaseResponse.cookies.set(name, '', options as Parameters<typeof supabaseResponse.cookies.set>[2]);
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    // Redirect unauthenticated users to login
    if (
        !user &&
        !request.nextUrl.pathname.startsWith('/login') &&
        !request.nextUrl.pathname.startsWith('/signup') &&
        request.nextUrl.pathname !== '/'
    ) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
    }

    return supabaseResponse;
}
