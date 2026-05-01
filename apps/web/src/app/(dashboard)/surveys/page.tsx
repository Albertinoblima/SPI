export default function SurveysPage() {
    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold text-slate-900">Pesquisas</h1>
                <a
                    href="/surveys/new"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition"
                >
                    + Nova Pesquisa
                </a>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Título</th>
                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Status</th>
                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Respostas</th>
                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Criada em</th>
                            <th className="text-left px-6 py-3 text-sm font-medium text-slate-500">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                Nenhuma pesquisa criada ainda
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}
