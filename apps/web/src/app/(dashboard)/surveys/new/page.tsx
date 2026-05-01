'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewSurveyPage() {
    const router = useRouter();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    const handleCreate = async () => {
        // TODO: Create survey via Supabase
        router.push('/surveys');
    };

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">Nova Pesquisa</h1>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Título
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Nome da pesquisa"
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                        Descrição
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-4 py-2 h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Descrição da pesquisa"
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <button
                        onClick={handleCreate}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
                    >
                        Criar Pesquisa
                    </button>
                    <button
                        onClick={() => router.back()}
                        className="border border-slate-300 text-slate-700 px-6 py-2 rounded-lg font-medium hover:bg-slate-50 transition"
                    >
                        Cancelar
                    </button>
                </div>
            </div>
        </div>
    );
}
