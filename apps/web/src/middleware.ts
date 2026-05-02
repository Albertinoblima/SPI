import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware de autenticação Supabase SSR.
 *
 * Responsabilidades:
 * 1. Sincroniza os cookies de sessão do Supabase em cada request.
 *    Sem isso, as rotas server-side (API routes) não conseguem ler a sessão
 *    e retornam "Não autenticado" mesmo com o usuário logado no browser.
 * 2. Redireciona para /login se a rota for protegida e não houver sessão ativa.
 * 3. Redireciona para /dashboard se o usuário já logado tentar acessar /login ou /register.
 */
export async function middleware(request: NextRequest) {
    const response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Atualiza/sincroniza a sessão — essencial para rotas server-side lerem os cookies
    const { data: { user } } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Rotas públicas (auth)
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/register');
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
        return NextResponse.redirect(loginUrl);
    }

    // Usuário autenticado tentando acessar /login ou /register → /dashboard
    if (user && isAuthRoute) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Aplicar middleware em todas as rotas exceto:
         * - _next/static (arquivos estáticos)
         * - _next/image (otimização de imagens)
         * - favicon.ico, ícones e assets públicos
         */
        '/((?!_next/static|_next/image|favicon.ico|branding|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
};
