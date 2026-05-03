'use client';

import Link from 'next/link';
import { HELP_TOPICS } from '@/lib/help-topics';

export default function HelpPage() {
    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900">Central de Ajuda</h1>
                <p className="text-slate-600 mt-2">
                    Guia completo para configuracao metodologica, amostragem, operacao de campo e qualidade da coleta.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
                <aside className="bg-white border border-slate-200 rounded-xl p-4 h-fit sticky top-6">
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">Topicos</p>
                    <nav className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                        {HELP_TOPICS.map((topic) => (
                            <a
                                key={topic.id}
                                href={`#${topic.id}`}
                                className="block text-sm text-slate-700 hover:text-blue-700 hover:bg-blue-50 rounded-lg px-2 py-1.5 transition"
                            >
                                {topic.title}
                            </a>
                        ))}
                    </nav>
                </aside>

                <main className="space-y-4">
                    {HELP_TOPICS.map((topic) => (
                        <section key={topic.id} id={topic.id} className="bg-white border border-slate-200 rounded-xl p-5 scroll-mt-24">
                            <h2 className="text-lg font-bold text-slate-900">{topic.title}</h2>
                            <p className="text-slate-700 mt-2">{topic.short}</p>
                            <ul className="mt-3 space-y-2">
                                {topic.content.map((line) => (
                                    <li key={line} className="text-sm text-slate-600 flex items-start gap-2">
                                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                        <span>{line}</span>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}

                    <section className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                        <h2 className="text-lg font-bold text-blue-900">Fluxo recomendado para nova pesquisa</h2>
                        <ol className="mt-3 space-y-2 text-sm text-blue-900 list-decimal pl-5">
                            <li>Defina o tipo de pesquisa e o objetivo com clareza.</li>
                            <li>Escolha o metodo de distribuicao por localidade (automatico ou manual, conforme tipologia).</li>
                            <li>Configure premissas e cotas com criterios auditaveis.</li>
                            <li>Monte o questionario e valide a ordem logica das perguntas.</li>
                            <li>Revise recursos de campo e publique para coleta.</li>
                        </ol>
                        <div className="mt-4">
                            <Link href="/surveys/new" className="text-sm font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900">
                                Criar nova pesquisa agora
                            </Link>
                        </div>
                    </section>
                </main>
            </div>
        </div>
    );
}
