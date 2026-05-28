'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';

/**
 * Protected Dynamic Report Page
 * 
 * Esta é a página personalizada que o contratante acessa.
 * 
 * Fluxo:
 * 1. Usuário acessa via link com shareToken
 * 2. Se o share for protegido, pede email + senha
 * 3. Após autenticação, carrega o dashboard dinâmico completo
 * 
 * Futuro: Aqui entrará o dashboard interativo completo com todos os cruzamentos.
 */
export default function PublicDynamicReportPage() {
  const params = useParams<{ shareToken: string }>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');

    const res = await fetch(`/api/reports/public/${params.shareToken}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (res.ok) {
      setAuthenticated(true);
    } else {
      setError('Credenciais inválidas ou link expirado');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow">
          <h1 className="text-2xl font-bold mb-2">Acesso ao Relatório Dinâmico</h1>
          <p className="text-slate-600 mb-6">Insira suas credenciais para acessar o dashboard completo da pesquisa.</p>

          <div className="space-y-4">
            <input
              type="email"
              placeholder="Seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <input
              type="password"
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border p-3 rounded-lg"
            />
            <button
              onClick={handleLogin}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold"
            >
              Acessar Relatório
            </button>
            {error && <p className="text-red-600 text-sm">{error}</p>}
          </div>

          <p className="text-xs text-slate-500 mt-6">
            Este acesso é exclusivo para o contratante da pesquisa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-4">Relatório Dinâmico - Dashboard</h1>
      <p className="text-lg text-slate-600 mb-8">
        Bem-vindo ao dashboard interativo da pesquisa. Aqui você pode explorar todos os cruzamentos.
      </p>

      {/* TODO: Inserir o Dashboard completo aqui */}
      <div className="border border-dashed border-slate-300 rounded-xl p-12 text-center text-slate-500">
        Dashboard dinâmico completo será implementado aqui (gráficos, filtros, todos os cruzamentos).
      </div>
    </div>
  );
}
