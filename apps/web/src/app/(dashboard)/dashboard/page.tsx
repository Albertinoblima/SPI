export default function DashboardPage() {
    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Bem-vindo ao SPI</h1>
            <p className="text-slate-500 mb-8">Sistema de Pesquisa Inteligente</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <a
                    href="/surveys"
                    className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
                >
                    <div className="text-blue-600 text-2xl mb-3">📋</div>
                    <h2 className="font-semibold text-slate-900 mb-1">Pesquisas</h2>
                    <p className="text-sm text-slate-500">Crie e gerencie pesquisas de campo</p>
                </a>

                <a
                    href="/responses"
                    className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
                >
                    <div className="text-green-600 text-2xl mb-3">📊</div>
                    <h2 className="font-semibold text-slate-900 mb-1">Respostas</h2>
                    <p className="text-sm text-slate-500">Visualize os dados coletados</p>
                </a>

                <a
                    href="/team"
                    className="bg-white rounded-xl border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition-all"
                >
                    <div className="text-purple-600 text-2xl mb-3">👥</div>
                    <h2 className="font-semibold text-slate-900 mb-1">Equipe</h2>
                    <p className="text-sm text-slate-500">Gerencie os membros da sua equipe</p>
                </a>
            </div>
        </div>
    );
}
