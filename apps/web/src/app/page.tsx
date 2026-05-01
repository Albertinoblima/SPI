import Link from 'next/link';

export default function HomePage() {
    return (
        <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
            <div className="container mx-auto px-4 py-20">
                <div className="text-center">
                    <h1 className="text-5xl font-bold mb-6">SPI - Sistema de Pesquisa Inteligente</h1>
                    <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
                        Plataforma completa para criação, gestão e análise de pesquisas
                        políticas com coleta de dados em campo e suporte offline.
                    </p>

                    <div className="flex gap-4 justify-center">
                        <Link
                            href="/login"
                            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition"
                        >
                            Entrar
                        </Link>
                        <Link
                            href="/signup"
                            className="border border-slate-400 hover:border-white text-white px-8 py-3 rounded-lg font-semibold transition"
                        >
                            Criar Conta
                        </Link>
                    </div>
                </div>

                <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                        <h3 className="text-lg font-semibold mb-2">📋 Criar Pesquisas</h3>
                        <p className="text-slate-400">
                            Monte questionários dinâmicos com diversos tipos de perguntas.
                        </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                        <h3 className="text-lg font-semibold mb-2">📱 Coleta em Campo</h3>
                        <p className="text-slate-400">
                            App mobile com suporte offline para pesquisadores em campo.
                        </p>
                    </div>
                    <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                        <h3 className="text-lg font-semibold mb-2">📊 Análise de Dados</h3>
                        <p className="text-slate-400">
                            Dashboard com gráficos, mapas e relatórios em tempo real.
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
