"use client";

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function SignupPage() {
    const router = useRouter();
    const [companyName, setCompanyName] = useState('');
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        if (password.length < 8) {
            setError('A senha deve ter no mínimo 8 caracteres.');
            return;
        }

        setLoading(true);

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName, fullName, email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                setError(data.error || 'Erro ao criar conta.');
            } else {
                setSuccess('Empresa e conta criadas com sucesso! Redirecionando para login...');
                setTimeout(() => router.push('/login'), 2000);
            }
        } catch {
            setError('Falha de conexão. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 px-4 py-8">
            <div className="w-full max-w-md bg-white rounded-xl shadow-lg p-6 sm:p-8">
                <div className="flex justify-center mb-4">
                    <Image
                        src="/branding/idialog-logo.png"
                        alt="Logo iDialog"
                        width={180}
                        height={54}
                        className="h-12 w-auto"
                        priority
                    />
                </div>
                <h1 className="text-2xl font-bold text-center text-slate-900 mb-2">Criar Conta</h1>
                <p className="text-center text-sm text-slate-500 mb-6">Cadastre sua empresa na plataforma iDialog</p>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 text-green-700 text-sm p-3 rounded-lg mb-4">
                        {success}
                    </div>
                )}

                <form className="space-y-4" onSubmit={handleSignup}>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Empresa</label>
                        <input
                            type="text"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Ex: Minha Empresa Ltda"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            autoComplete="name"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Seu nome"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            autoComplete="email"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="seu@email.com"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Mínimo 8 caracteres"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500"
                            placeholder="Repita a senha"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || Boolean(success)}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2 rounded-lg font-medium transition"
                    >
                        {loading ? 'Criando...' : 'Criar Conta'}
                    </button>
                </form>

                <p className="text-center text-sm text-slate-500 mt-4">
                    Já tem conta?{' '}
                    <Link href="/login" className="text-blue-600 hover:underline">
                        Entrar
                    </Link>
                </p>
            </div>
        </div>
    );
}

