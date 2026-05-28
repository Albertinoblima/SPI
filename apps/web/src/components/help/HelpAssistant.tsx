'use client';

import React, { useState } from 'react';
import { HELP_TOPICS, HelpTopic } from '@/lib/help-topics';
import { Search, BookOpen, CheckCircle, ArrowRight } from 'lucide-react';

interface HelpAssistantProps {
    initialQuery?: string;
    onTopicHelpful?: (topic: HelpTopic) => void;
    onStillNeedHelp?: (description: string) => void; // agora passa a descrição para preencher o ticket
    compact?: boolean;
}

export function HelpAssistant({ 
    initialQuery = '', 
    onTopicHelpful, 
    onStillNeedHelp,
    compact = false 
}: HelpAssistantProps) {
    const [query, setQuery] = useState(initialQuery);
    const [selectedTopics, setSelectedTopics] = useState<HelpTopic[]>([]);
    const [helpfulMarked, setHelpfulMarked] = useState<Set<string>>(new Set());

    const searchResults = React.useMemo(() => {
        if (!query.trim()) return [];
        
        const normalized = query.toLowerCase().trim();
        const scored = HELP_TOPICS.map(topic => {
            let score = 0;
            const haystack = [
                topic.title, 
                topic.short, 
                ...topic.content,
                ...(topic.keywords || [])
            ].join(' ').toLowerCase();

            if (haystack.includes(normalized)) score += 3;
            normalized.split(' ').forEach(word => {
                if (word.length > 2 && haystack.includes(word)) score += 1;
            });
            
            if (topic.relatedErrors?.some(err => err.toLowerCase().includes(normalized))) {
                score += 2;
            }

            return { topic, score };
        });

        return scored
            .filter(s => s.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 5)
            .map(s => s.topic);
    }, [query]);

    const handleMarkHelpful = (topic: HelpTopic) => {
        setHelpfulMarked(prev => new Set(prev).add(topic.id));
        onTopicHelpful?.(topic);
    };

    const handleStillNeedHelp = () => {
        onStillNeedHelp?.();
    };

    if (compact) {
        return (
            <div className="space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Descreva seu problema ou dúvida..."
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
                    />
                </div>

                {searchResults.length > 0 && (
                    <div className="space-y-2">
                        {searchResults.map(topic => (
                            <div key={topic.id} className="p-3 rounded-lg bg-slate-800 border border-slate-700 text-sm">
                                <div className="font-medium text-white">{topic.title}</div>
                                <div className="text-slate-400 text-xs mt-1 line-clamp-2">{topic.short}</div>
                                <button
                                    onClick={() => handleMarkHelpful(topic)}
                                    disabled={helpfulMarked.has(topic.id)}
                                    className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 disabled:text-emerald-600 flex items-center gap-1"
                                >
                                    <CheckCircle className="w-3 h-3" /> 
                                    {helpfulMarked.has(topic.id) ? 'Obrigado! Marcado como útil' : 'Isso resolveu meu problema'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {query.trim().length > 5 && (
                    <button
                        onClick={() => {
                            if (onStillNeedHelp) {
                                // Pass the current query so parent can prefill the ticket
                                onStillNeedHelp(query);
                            }
                        }}
                        className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg border border-blue-600 text-blue-400 hover:bg-blue-950 text-sm font-medium transition"
                    >
                        Ainda não resolveu → Quero abrir um chamado com a equipe
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div>
                <div className="flex items-center gap-2 mb-2 text-sm font-medium text-slate-300">
                    <BookOpen className="w-4 h-4" />
                    Assistente de Autossuporte
                </div>
                <p className="text-xs text-slate-400 mb-3">
                    Descreva seu problema. Vamos sugerir artigos da Base de Conhecimento antes de abrir um ticket.
                </p>
                
                <div className="relative">
                    <Search className="absolute left-3 top-3 w-4 h-4 text-slate-500" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ex: não consigo definir cotas por localidade, erro ao salvar planejamento..."
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-blue-500"
                    />
                </div>
            </div>

            {searchResults.length > 0 && (
                <div>
                    <div className="text-sm font-medium text-emerald-400 mb-2">Artigos que podem ajudar:</div>
                    <div className="space-y-3">
                        {searchResults.map(topic => (
                            <div key={topic.id} className="p-4 rounded-xl border border-slate-700 bg-slate-800/50">
                                <div className="flex justify-between">
                                    <div>
                                        <div className="font-semibold text-white">{topic.title}</div>
                                        <div className="text-sm text-slate-300 mt-1">{topic.short}</div>
                                    </div>
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-700 text-slate-400 h-fit">
                                        {topic.category}
                                    </span>
                                </div>
                                
                                <div className="mt-3 text-sm text-slate-300 space-y-1">
                                    {topic.content.slice(0, 2).map((line, i) => (
                                        <div key={i} className="flex gap-2">• {line}</div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handleMarkHelpful(topic)}
                                    disabled={helpfulMarked.has(topic.id)}
                                    className="mt-3 text-sm flex items-center gap-2 text-emerald-400 hover:text-emerald-300 disabled:opacity-60"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    {helpfulMarked.has(topic.id) ? 'Marcado como útil — obrigado!' : 'Isso resolveu meu problema'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {query.trim().length > 5 && (
                <div className="pt-2 border-t border-slate-700">
                    <button
                        onClick={handleStillNeedHelp}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm transition"
                    >
                        Ainda preciso de ajuda humana → Abrir ticket
                        <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-[10px] text-center text-slate-500 mt-2">
                        Nossa equipe de suporte vai te atender o mais rápido possível.
                    </p>
                </div>
            )}
        </div>
    );
}
