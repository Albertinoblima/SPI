'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
    getAuthSearchErrorMessage,
    getAuthSearchMessage,
    getSafeRedirectPath,
    loginSchema,
} from '@/lib/auth/login';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isSupabaseConfigured =
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
    const [loading, setLoading] = useState(false);
    const [oauthLoading, setOauthLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const infoMessage = getAuthSearchMessage(searchParams.get('message'));
    const queryErrorMessage = getAuthSearchErrorMessage(searchParams.get('error'));

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setFieldErrors({});

        if (!isSupabaseConfigured) {
            setError('Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em apps/web/.env.local.');
            return;
        }

        const parsedCredentials = loginSchema.safeParse({ email, password });

        if (!parsedCredentials.success) {
            const flattenedErrors = parsedCredentials.error.flatten().fieldErrors;

            setFieldErrors({
                email: flattenedErrors.email?.[0],
                password: flattenedErrors.password?.[0],
            });

            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: parsedCredentials.data.email,
                    password: parsedCredentials.data.password,
                    redirect: searchParams.get('redirect') ?? undefined,
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error ?? 'Não foi possível concluir o login agora. Tente novamente.');
                return;
            }

            window.location.assign(data.data?.redirectTo ?? '/dashboard');
        } catch {
            setError('Não foi possível se conectar ao servidor de autenticação. Tente novamente em instantes.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');

        if (!isSupabaseConfigured) {
            setError('Configuração do Supabase ausente. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY em apps/web/.env.local.');
            return;
        }

        setOauthLoading(true);

        try {
            const supabase = createClient();
            const nextPath = getSafeRedirectPath(searchParams.get('redirect'), '/dashboard');
            const redirectTo = new URL('/auth/callback', window.location.origin);
            redirectTo.searchParams.set('next', nextPath);

            const { error: oauthError } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectTo.toString(),
                },
            });

            if (oauthError) {
                setError('Não foi possível iniciar o login com Google. Verifique a configuração do provedor no Supabase.');
            }
        } catch {
            setError('Falha ao iniciar autenticação externa. Tente novamente.');
        } finally {
            setOauthLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#e2e8f0)] px-4 py-10">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
                <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-2xl shadow-slate-300/40 backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
                    <div className="hidden bg-slate-950 px-10 py-12 text-slate-100 md:flex md:flex-col md:justify-between">
                        <div>
                            <span className="inline-flex rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                                Acesso seguro
                            </span>
                            <h1 className="mt-6 text-4xl font-semibold leading-tight">
                                Login corporativo com sessão confiável e retorno seguro.
                            </h1>
                            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                                Entre com sua conta para acessar pesquisas, dashboards e a operação de campo sem perder o contexto da navegação.
                            </p>
                        </div>

                        <div className="space-y-3 text-sm text-slate-300">
                            <p>Sessão persistida com Supabase e redirecionamento protegido contra destinos externos.</p>
                            <p>Mensagens de erro padronizadas para credenciais inválidas, bloqueios temporários e falhas de rede.</p>
                        </div>
                    </div>

                    <div className="w-full p-8 sm:p-10">
                        <div className="flex flex-col items-center mb-8">
                            <Image
                                src="/branding/idialog-logo.png"
                                alt="Logo iDialog"
                                width={180}
                                height={54}
                                className="h-12 w-auto"
                                priority
                            />
                            <h1 className="mt-5 text-center text-3xl font-semibold text-slate-950">Entrar</h1>
                            <p className="mt-2 text-center text-sm text-slate-500">
                                Use suas credenciais para acessar a plataforma.
                            </p>
                        </div>

                        {searchParams.get('redirect') && (
                            <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                                Após o login, você será redirecionado para continuar de onde parou.
                            </div>
                        )}

                        {infoMessage && (
                            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {infoMessage}
                            </div>
                        )}

                        {queryErrorMessage && !error && (
                            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {queryErrorMessage}
                            </div>
                        )}

                        {error && (
                            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {!isSupabaseConfigured && (
                            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                Configure o arquivo apps/web/.env.local para habilitar autenticação.
                            </div>
                        )}

                        <form onSubmit={handleLogin} className="space-y-5" noValidate>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    inputMode="email"
                                    disabled={loading}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    placeholder="seu@email.com"
                                    required
                                />
                                {fieldErrors.email && (
                                    <p className="mt-1.5 text-sm text-red-600">{fieldErrors.email}</p>
                                )}
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="block text-sm font-medium text-slate-700">Senha</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((currentValue) => !currentValue)}
                                        className="text-sm font-medium text-sky-700 hover:text-sky-800"
                                    >
                                        {showPassword ? 'Ocultar' : 'Mostrar'}
                                    </button>
                                </div>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    disabled={loading}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    placeholder="Sua senha"
                                    required
                                />
                                {fieldErrors.password && (
                                    <p className="mt-1.5 text-sm text-red-600">{fieldErrors.password}</p>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-y-2 text-sm">
                                <span className="text-slate-500">Login protegido com auditoria e limite de tentativas.</span>
                                <Link href="/forgot-password" className="font-medium text-sky-700 hover:text-sky-800 hover:underline">
                                    Esqueci minha senha
                                </Link>
                            </div>

                            <button
                                type="submit"
                                disabled={loading || oauthLoading || !isSupabaseConfigured}
                                className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                                {loading ? 'Entrando...' : 'Entrar na plataforma'}
                            </button>
                        </form>

                        <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                            <div className="h-px flex-1 bg-slate-200" />
                            ou
                            <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            disabled={loading || oauthLoading || !isSupabaseConfigured}
                            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                        >
                            <span className="text-base">G</span>
                            {oauthLoading ? 'Conectando ao Google...' : 'Continuar com Google'}
                        </button>

                        <p className="mt-6 text-center text-sm text-slate-500">
                            Não tem conta?{' '}
                            <Link href="/signup" className="font-medium text-sky-700 hover:text-sky-800 hover:underline">
                                Cadastre-se
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
