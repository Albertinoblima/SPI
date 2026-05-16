'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { resetPasswordSchema } from '@/lib/auth/login';

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        setSuccess('');

        const parsedPasswords = resetPasswordSchema.safeParse({ password, confirmPassword });

        if (!parsedPasswords.success) {
            setError(parsedPasswords.error.issues[0]?.message ?? 'Revise os campos e tente novamente.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsedPasswords.data),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error ?? 'Não foi possível redefinir sua senha.');
                return;
            }

            setSuccess('Senha redefinida com sucesso. Redirecionando para o login...');

            window.setTimeout(() => {
                router.replace('/login?message=password_reset_success');
            }, 1200);
        } catch {
            setError('Falha de conexão. Tente novamente em instantes.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#dbeafe,_#f8fafc_45%,_#e2e8f0)] px-4 py-10">
            <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
                <div className="w-full max-w-xl rounded-3xl border border-white/70 bg-white/90 p-8 shadow-2xl shadow-slate-300/40 backdrop-blur sm:p-10">
                    <div className="mb-8 flex flex-col items-center">
                        <Image
                            src="/branding/idialog-logo.png"
                            alt="Logo iDialog"
                            width={180}
                            height={54}
                            className="h-12 w-auto"
                            priority
                        />
                        <h1 className="mt-5 text-center text-3xl font-semibold text-slate-950">Definir nova senha</h1>
                        <p className="mt-2 text-center text-sm text-slate-500">
                            Escolha uma nova senha para concluir a recuperação de acesso.
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
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">Nova senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(event) => setPassword(event.target.value)}
                                autoComplete="new-password"
                                disabled={loading}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                placeholder="Mínimo de 8 caracteres"
                                required
                            />
                        </div>

                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-slate-700">Confirmar nova senha</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(event) => setConfirmPassword(event.target.value)}
                                autoComplete="new-password"
                                disabled={loading}
                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                                placeholder="Repita a nova senha"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full rounded-2xl bg-slate-950 px-4 py-3 font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        >
                            {loading ? 'Atualizando senha...' : 'Salvar nova senha'}
                        </button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Precisa reiniciar o fluxo?{' '}
                        <Link href="/forgot-password" className="font-medium text-sky-700 hover:text-sky-800 hover:underline">
                            Solicitar novo link
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}