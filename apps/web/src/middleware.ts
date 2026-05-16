import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware de autenticação Supabase SSR.
 *
 * @supabase/ssr v0.3.0 usa API get/set/remove (não getAll/setAll).
 * getAll/setAll só foi adicionado em v0.4.0+.
 */
export async function middleware(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return request.cookies.get(name)?.value;
                },
                set(name: string, value: string, options: CookieOptions) {
                    request.cookies.set({ name, value, ...options });
                    supabaseResponse = NextResponse.next({ request });
                    supabaseResponse.cookies.set({ name, value, ...options });
                },
                remove(name: string, options: CookieOptions) {
                    request.cookies.set({ name, value: '', ...options });
                    supabaseResponse = NextResponse.next({ request });
                    supabaseResponse.cookies.set({ name, value: '', ...options });
                },
            },
        }
    );

    // IMPORTANTE: não coloque lógica entre createServerClient e getUser()
    const { data: { user } } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Rotas públicas (auth)
    const isAuthRoute =
        pathname === '/login' ||
        pathname === '/signup' ||
        pathname === '/forgot-password' ||
        pathname === '/reset-password' ||
        pathname.startsWith('/login') ||
        pathname.startsWith('/signup') ||
        pathname.startsWith('/forgot-password') ||
        pathname.startsWith('/reset-password') ||
        pathname.startsWith('/auth/callback');

    // Rotas protegidas do dashboard
    const isDashboardRoute =
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/surveys') ||
        pathname.startsWith('/team') ||
        pathname.startsWith('/settings') ||
        pathname.startsWith('/admin');

    // Usuário não autenticado tentando acessar rota protegida → /login
    if (!user && isDashboardRoute) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        const redirectResponse = NextResponse.redirect(loginUrl);
        // Propagar cookies do supabaseResponse no redirect
        supabaseResponse.cookies.getAll().forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
    }

    // Usuário autenticado tentando acessar /login ou /signup → /dashboard
    if (user && isAuthRoute) {
        const redirectResponse = NextResponse.redirect(new URL('/dashboard', request.url));
        supabaseResponse.cookies.getAll().forEach(cookie => {
            redirectResponse.cookies.set(cookie.name, cookie.value);
        });
        return redirectResponse;
    }

    // IMPORTANTE: retornar supabaseResponse (não NextResponse.next())
    return supabaseResponse;
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
