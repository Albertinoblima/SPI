export default function ResponsesPage() {
    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Respostas</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <p className="text-sm text-slate-500">Total de Respostas</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">0</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <p className="text-sm text-slate-500">Respostas Hoje</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">0</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <p className="text-sm text-slate-500">Pesquisadores Ativos</p>
                    <p className="text-3xl font-bold text-slate-900 mt-1">0</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-slate-400 text-center py-12">
                    Nenhuma resposta registrada ainda
                </p>
            </div>
        </div>
    );
}
