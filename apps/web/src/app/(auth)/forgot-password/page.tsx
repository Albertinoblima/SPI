'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { forgotPasswordSchema } from '@/lib/auth/login';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const parsedEmail = forgotPasswordSchema.safeParse({ email });

        if (!parsedEmail.success) {
            setError(parsedEmail.error.issues[0]?.message ?? 'Informe um email válido.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: parsedEmail.data.email }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error ?? 'Não foi possível iniciar a redefinição agora.');
                return;
            }

            setSuccess(data.data?.message ?? 'Verifique sua caixa de entrada para continuar.');
        } catch {
            setError('Falha de conexão. Tente novamente em instantes.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#e2e8f0)] px-4 py-10">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
                <div className="grid w-full max-w-4xl overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-2xl shadow-slate-300/40 backdrop-blur md:grid-cols-[1.1fr_0.9fr]">
                    <div className="hidden bg-slate-950 px-10 py-12 text-slate-100 md:flex md:flex-col md:justify-between">
                        <div>
                            <span className="inline-flex rounded-full border border-sky-400/40 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-200">
                                Recuperação segura
                            </span>
                            <h1 className="mt-6 text-4xl font-semibold leading-tight">
                                Redefina o acesso sem expor detalhes da conta.
                            </h1>
                            <p className="mt-4 max-w-md text-sm leading-6 text-slate-300">
                                O fluxo usa link temporário do Supabase, callback autenticado e mensagens neutras para reduzir enumeração de usuários.
                            </p>
                        </div>
                    </div>

                    <div className="w-full p-8 sm:p-10">
                        <div className="mb-8 flex flex-col items-center">
                            <Image
                                src="/branding/idialog-logo.png"
                                alt="Logo iDialog"
                                width={180}
                                height={54}
                                className="h-12 w-auto"
                                priority
                            />
                            <h1 className="mt-5 text-center text-3xl font-semibold text-slate-950">Recuperar senha</h1>
                            <p className="mt-2 text-center text-sm text-slate-500">
                                Informe seu email corporativo para receber um link seguro de redefinição.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                                {success}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
                            <div>
                                <label className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="email"
                                    inputMode="email"
                                    disabled={loading}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                    placeholder="seu@email.com"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                            >
                                {loading ? 'Enviando link...' : 'Enviar link de redefinição'}
                            </button>
                        </form>

                        <p className="mt-6 text-center text-sm text-slate-500">
                            Lembrou sua senha?{' '}
                            <Link href="/login" className="font-medium text-sky-700 hover:text-sky-800 hover:underline">
                                Voltar ao login
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}