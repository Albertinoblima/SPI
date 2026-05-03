'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { HELP_TOPICS } from '@/lib/help-topics';

export default function HelpPage() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const queryFromUrl = searchParams.get('q') ?? '';

    const [query, setQuery] = useState('');
    const [activeTopicId, setActiveTopicId] = useState<string>(HELP_TOPICS[0]?.id ?? '');

    useEffect(() => {
        if (queryFromUrl !== query) {
            setQuery(queryFromUrl);
        }
    }, [queryFromUrl, query]);

    const filteredTopics = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return HELP_TOPICS;

        return HELP_TOPICS.filter((topic) => {
            const haystack = [topic.title, topic.short, ...topic.content].join(' ').toLowerCase();
            return haystack.includes(normalized);
        });
    }, [query]);

    useEffect(() => {
        if (filteredTopics.length === 0) {
            setActiveTopicId('');
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

                if (visible?.target?.id) {
                    setActiveTopicId(visible.target.id);
                }
            },
            {
                root: null,
                rootMargin: '-120px 0px -55% 0px',
                threshold: [0.2, 0.5, 0.8],
            }
        );

        filteredTopics.forEach((topic) => {
            const el = document.getElementById(topic.id);
            if (el) observer.observe(el);
        });

        if (!filteredTopics.some((topic) => topic.id === activeTopicId)) {
            setActiveTopicId(filteredTopics[0].id);
        }

        return () => observer.disconnect();
    }, [filteredTopics, activeTopicId]);

    useEffect(() => {
        const params = new URLSearchParams(Array.from(searchParams.entries()));
        const normalized = query.trim();

        if (normalized) {
            params.set('q', normalized);
        } else {
            params.delete('q');
        }

        const queryString = params.toString();
        const url = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(url, { scroll: false });
    }, [query, pathname, router, searchParams]);

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
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar na ajuda..."
                            aria-label="Buscar topicos de ajuda"
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-9 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                    <nav className="space-y-2 max-h-[70vh] overflow-auto pr-1">
                        {filteredTopics.map((topic) => (
                            <a
                                key={topic.id}
                                href={`#${topic.id}`}
                                onClick={() => setActiveTopicId(topic.id)}
                                className={`block text-sm rounded-lg px-2 py-1.5 transition ${activeTopicId === topic.id
                                    ? 'bg-blue-100 text-blue-800 font-semibold'
                                    : 'text-slate-700 hover:text-blue-700 hover:bg-blue-50'
                                    }`}
                            >
                                {topic.title}
                            </a>
                        ))}
                        {filteredTopics.length === 0 && (
                            <p className="text-sm text-slate-400 px-2 py-1">Nenhum topico encontrado.</p>
                        )}
                    </nav>
                </aside>

                <main className="space-y-4">
                    {filteredTopics.map((topic) => (
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

                    {filteredTopics.length === 0 && (
                        <section className="bg-white border border-slate-200 rounded-xl p-6 text-center">
                            <h2 className="text-lg font-semibold text-slate-700">Nenhum resultado para sua busca</h2>
                            <p className="text-sm text-slate-500 mt-2">Tente palavras diferentes, como "amostragem", "questionario" ou "premissas".</p>
                        </section>
                    )}

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
