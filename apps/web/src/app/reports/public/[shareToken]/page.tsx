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
      // Após login bem-sucedido, podemos buscar dados do relatório
      fetchReportData();
    } else {
      setError('Credenciais inválidas ou link expirado');
    }
  };

  const [reportData, setReportData] = useState<any>(null);

  const fetchReportData = async () => {
    try {
      const res = await fetch(`/api/reports/public/${params.shareToken}/data`);
      if (res.ok) {
        const data = await res.json();
        setReportData(data);
      }
    } catch (e) {
      console.error('Erro ao carregar dados do relatório dinâmico');
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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Relatório Dinâmico</h1>
          <p className="text-slate-600">Análise interativa completa da pesquisa</p>
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="px-4 py-2 border rounded-lg text-sm"
        >
          Sair
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filtros */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border">
          <h3 className="font-semibold mb-4">Filtros</h3>
          <p className="text-sm text-slate-500">Filtros por zona, sexo, faixa etária etc. (em desenvolvimento)</p>
        </div>

        {/* Dashboard Principal */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-xl border">
            <h3 className="font-semibold mb-3">Visão Geral</h3>
            <p className="text-2xl font-bold text-emerald-600">
              {reportData ? `${reportData.totalResponses || 0} respostas` : 'Carregando dados...'}
            </p>
            <p className="text-slate-600 mt-2">
              Dashboard dinâmico com todos os cruzamentos da pesquisa.
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl border">
            <h3 className="font-semibold mb-3">Cruzamentos Disponíveis</h3>
            {reportData?.availableCrossings ? (
              <div className="text-sm">
                {reportData.availableCrossings.length} cruzamentos possíveis carregados.
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                O sistema carregará automaticamente todos os cruzamentos possíveis entre as perguntas da pesquisa.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
