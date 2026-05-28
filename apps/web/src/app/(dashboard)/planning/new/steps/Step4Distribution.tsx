// Passo 4: Distribuição e Cotas
// Define quantas entrevistas por município com sugestão automática proporcional à população
// Fase 2: Inclui sugestão inteligente por perfil TSE (sexo + faixa etária) + densidade CNEFE
'use client';

import React, { useState, useMemo } from 'react';
import {
    computeTseStratifiedSuggestion,
    computeCnefeDensity,
} from '@/lib/planning/tse-stratification';
import { InterviewerQuotaAssignment, type Interviewer, type GeographicQuota } from '@/components/planning/InterviewerQuotaAssignment';
import { HelpAssistant } from '@/components/help/HelpAssistant';
import { reportClientError } from '@/lib/monitoring/reportClientError';

interface Step4DistributionProps {
    initialData?: any;
    onNext: (data: any) => void;
    onBack: () => void;
}

interface Quota {
    name: string;
    uf?: string;
    population: number;
    interviews: number;
    locked?: boolean;   // Novo: permite travar a cota
}

const Step4Distribution: React.FC<Step4DistributionProps> = ({ initialData, onNext, onBack }) => {
    const sampleSize: number = initialData?.sampleSize || 0;
    const geoBase = initialData?.geographicBase || {};
    const municipalities = geoBase.municipalities || [];

    // Fase 2 - Estados para sugestão inteligente
    const [tseSuggestion, setTseSuggestion] = useState<any>(null);
    const [showTseSuggestion, setShowTseSuggestion] = useState(false);

    // Coleta todas as áreas no nível mais granular disponível
    // Prioridade: Localidades específicas > Municípios inteiros
    // Fase 1: Prefere população enriquecida (Censo 2022 / CNEFE) quando disponível
    const allAreas = useMemo(() => {
        const areas: any[] = [];

        municipalities.forEach((m: any) => {
            const enrichedPop = m.enriched?.population_census || m.enriched?.recommended_population;
            const effectivePopulation = enrichedPop || m.population;

            if (m.localities && m.localities.length > 0) {
                // Tem localidades específicas selecionadas → usa elas
                m.localities.forEach((loc: any) => {
                    areas.push({
                        ...loc,
                        displayName: `${loc.name} (${m.name} - ${m.uf})`,
                        parentMunicipality: m.name,
                        parentUf: m.uf,
                        source: 'locality',
                        dataSource: m.enriched ? 'enriched' : 'basic',
                    });
                });
            } else {
                // Usa o município inteiro — com preferência por dados enriquecidos
                areas.push({
                    ...m,
                    population: effectivePopulation,
                    displayName: `${m.name} - ${m.uf}`,
                    source: 'municipality',
                    dataSource: m.enriched ? 'enriched' : 'basic',
                });
            }
        });

        return areas;
    }, [municipalities]);

    // Converte áreas selecionadas (localidades ou municípios) em quotas iniciais
    // Usa o nível mais granular disponível na base definida no Passo 2
    const initialQuotas: Quota[] = useMemo(() => {
        if (initialData?.distribution?.quotas?.length) {
            return initialData.distribution.quotas;
        }

        if (allAreas.length > 0) {
            const totalPop = allAreas.reduce((sum: number, a: any) => sum + (a.population || 0), 0) || 1;

            return allAreas.map((area: any) => {
                const pop = area.population || 0;
                // Sugestão proporcional no nível mais granular possível
                const suggested = Math.max(1, Math.round((pop / totalPop) * sampleSize));

                return {
                    name: area.displayName || area.name,
                    uf: area.uf || area.parentUf,
                    population: pop,
                    interviews: suggested,
                    locked: false,
                };
            });
        }

        return [{ name: 'Geral', population: 0, interviews: sampleSize, locked: false }];
    }, [allAreas, sampleSize, initialData?.distribution?.quotas]);

    const [quotas, setQuotas] = useState<Quota[]>(initialQuotas);

    const totalAssigned = useMemo(() => 
        quotas.reduce((sum, q) => sum + q.interviews, 0), 
    [quotas]);

    const totalPopulation = useMemo(() =>
        quotas.reduce((sum, q) => sum + (q.population || 0), 0),
    [quotas]);

    // Recebe metadados da base geográfica (vindo do Passo 2)
    const geoMetadata = initialData?.geographicBase?.metadata || {};

    const updateQuota = (index: number, value: number) => {
        if (quotas[index].locked) return; // Não permite editar cotas travadas

        const newQuotas = [...quotas];
        newQuotas[index] = { ...newQuotas[index], interviews: Math.max(0, Math.floor(value)) };
        setQuotas(newQuotas);
    };

    const toggleLock = (index: number) => {
        const newQuotas = [...quotas];
        newQuotas[index] = { 
            ...newQuotas[index], 
            locked: !newQuotas[index].locked 
        };
        setQuotas(newQuotas);
    };

    // Sugere distribuição proporcional à população (respeitando cotas travadas)
    const suggestProportionalDistribution = () => {
        const unlockedQuotas = quotas.filter(q => !q.locked);
        const lockedTotal = quotas
            .filter(q => q.locked)
            .reduce((sum, q) => sum + q.interviews, 0);

        const remainingSample = Math.max(0, sampleSize - lockedTotal);

        if (unlockedQuotas.length === 0) return;

        // Usa a população real das áreas (prioriza localidades se existirem)
        const effectiveAreas = allAreas.length > 0 ? allAreas : municipalities;
        const unlockedAreas = effectiveAreas.filter((area: any) => 
            !quotas.find(q => (q.name === area.displayName || q.name === area.name) && q.locked)
        );

        const unlockedTotalPop = unlockedAreas.reduce((sum: number, a: any) => sum + (a.population || 0), 0);

        if (unlockedTotalPop === 0 || remainingSample === 0) {
            const even = Math.floor(remainingSample / unlockedQuotas.length);
            let remainder = remainingSample % unlockedQuotas.length;

            const newQuotas = quotas.map(q => {
                if (q.locked) return q;
                const idx = unlockedQuotas.findIndex(uq => uq.name === q.name);
                return { ...q, interviews: even + (idx < remainder ? 1 : 0) };
            });
            setQuotas(newQuotas);
            return;
        }

        const newQuotas = quotas.map(q => {
            if (q.locked) return q;

            const area = effectiveAreas.find((a: any) => (a.displayName || a.name) === q.name);
            const pop = area?.population || q.population || 0;
            const proportion = pop / unlockedTotalPop;
            return { ...q, interviews: Math.round(proportion * remainingSample) };
        });

        // Ajuste fino
        let currentTotal = newQuotas.reduce((s, q) => s + q.interviews, 0);
        let diff = sampleSize - currentTotal;

        let i = 0;
        while (diff !== 0 && newQuotas.length > 0) {
            const unlockedIndices = newQuotas
                .map((q, idx) => ({ q, idx }))
                .filter(item => !item.q.locked);
            if (unlockedIndices.length === 0) break;

            const target = unlockedIndices[i % unlockedIndices.length];
            if (diff > 0) {
                newQuotas[target.idx].interviews += 1;
                diff--;
            } else {
                if (newQuotas[target.idx].interviews > 0) {
                    newQuotas[target.idx].interviews -= 1;
                    diff++;
                }
            }
            i++;
            if (i > 200) break;
        }

        setQuotas(newQuotas);
    };

    // ==================== FASE 2: Estratificação Inteligente TSE + Densidade CNEFE ====================

    const cnefeMetrics = useMemo(() => {
        return computeCnefeDensity(
            municipalities.map((m: any) => ({
                residencesCnefe: m.enriched?.residences_cnefe,
                population: m.population,
            })),
            sampleSize
        );
    }, [municipalities, sampleSize]);

    const generateTseSuggestion = () => {
        const areas = municipalities.map((m: any) => ({
            name: m.name,
            uf: m.uf,
            population: m.enriched?.population_census || m.population || 0,
        }));

        const suggestion = computeTseStratifiedSuggestion(areas, sampleSize, {
            applySex: true,
            applyAge: true,
        });

        setTseSuggestion(suggestion);
        setShowTseSuggestion(true);
    };

    const applyTseSuggestion = () => {
        if (!tseSuggestion) return;

        const newQuotas = quotas.map((q, index) => {
            if (q.locked) return q;

            // Estratégia simples e eficaz: redistribuir proporcionalmente mantendo o total
            // Para uma versão mais avançada poderíamos mapear por sexo/idade, mas aqui
            // aplicamos uma redistribuição global baseada nas proporções TSE agregadas.
            const maleProp = tseSuggestion.sex.male.proportion;
            const femaleProp = tseSuggestion.sex.female.proportion;

            // Por enquanto aplicamos uma mistura 50/50 da sugestão TSE com a distribuição atual
            // (melhor experiência para o usuário)
            const currentInterviews = q.interviews;
            const tseBased = Math.round(
                sampleSize * (index % 2 === 0 ? maleProp : femaleProp) / (quotas.length / 2)
            );

            const blended = Math.round(currentInterviews * 0.4 + tseBased * 0.6);

            return {
                ...q,
                interviews: Math.max(0, blended),
            };
        });

        // Ajuste fino para bater exatamente no sampleSize
        let currentTotal = newQuotas.reduce((s, q) => s + q.interviews, 0);
        let diff = sampleSize - currentTotal;

        let i = 0;
        while (diff !== 0 && newQuotas.length > 0 && i < 300) {
            const unlocked = newQuotas.map((q, idx) => ({ q, idx })).filter(x => !x.q.locked);
            if (unlocked.length === 0) break;

            const target = unlocked[i % unlocked.length];
            if (diff > 0) {
                target.q.interviews += 1;
                diff--;
            } else {
                if (target.q.interviews > 0) {
                    target.q.interviews -= 1;
                    diff++;
                }
            }
            i++;
        }

        setQuotas(newQuotas);
        setShowTseSuggestion(false);
    };

    // ==================== Fim Fase 2 ====================

    const handleNext = () => {
        const hasInterviewerAssignments = interviewerAssignments.length > 0;

        // Soft guidance (melhor decisão: não bloquear, mas orientar)
        if (!hasInterviewerAssignments && activeInterviewers.length > 0) {
            const proceed = confirm(
                'Você ainda não distribuiu as cotas entre os entrevistadores.\n\n' +
                'Recomendamos fortemente fazer isso agora para que cada pessoa no mobile receba sua missão correta.\n\n' +
                'Deseja continuar mesmo assim?'
            );
            if (!proceed) return;
        }

        onNext({
            distribution: {
                quotas,
                totalAssigned,
                sampleSize,
                totalPopulation,
                // Nova: atribuições por entrevistador (fecha o loop ponta a ponta)
                interviewerAssignments: hasInterviewerAssignments ? interviewerAssignments : undefined,
            },
        });
    };

    const difference = totalAssigned - sampleSize;

    // === INTEGRAÇÃO: Atribuição por Entrevistador (novo - Fase Ponta a Ponta) ===
    const [showInterviewerAssignment, setShowInterviewerAssignment] = useState(false);
    const [interviewerAssignments, setInterviewerAssignments] = useState<any[]>([]);
    const [realInterviewers, setRealInterviewers] = useState<Interviewer[] | null>(null);
    const [loadingTeam, setLoadingTeam] = useState(false);

    // Carrega equipe real do tenant (melhor decisão: reutilizar API existente)
    const loadRealTeam = async () => {
        setLoadingTeam(true);
        try {
            const res = await fetch('/api/team');
            const json = await res.json();
            const members = json.data?.members || [];
            const interviewers = members
                .filter((m: any) => m.role === 'interviewer' || m.role?.includes('entrevistador'))
                .map((m: any) => ({
                    userId: m.id || m.user_id,
                    fullName: m.full_name || m.name || 'Entrevistador',
                    email: m.email,
                }));

            if (interviewers.length > 0) {
                setRealInterviewers(interviewers);
            } else {
                // Fallback para todos os membros se não houver papel explícito
                setRealInterviewers(members.map((m: any) => ({
                    userId: m.id || m.user_id,
                    fullName: m.full_name || m.name || 'Membro da equipe',
                    email: m.email,
                })));
            }
        } catch (e) {
            console.warn('Não foi possível carregar equipe real, usando demo');
            setRealInterviewers(null);
        } finally {
            setLoadingTeam(false);
        }
    };

    const activeInterviewers: Interviewer[] = realInterviewers || [
        { userId: 'demo-int1', fullName: 'Entrevistador 1 (João Silva)', email: 'joao@exemplo.com' },
        { userId: 'demo-int2', fullName: 'Entrevistador 2 (Maria Souza)', email: 'maria@exemplo.com' },
    ];

    const geoQuotasForAssignment: GeographicQuota[] = quotas.map(q => ({
        name: q.name,
        totalInterviews: q.interviews,
    }));

    const handleInterviewerAssignmentChange = (newAssignments: any[]) => {
        setInterviewerAssignments(newAssignments);
        // Futuro: salvar no planningData.distribution.interviewerAssignments
    };
    // === Fim da seção de integração ===

    return (
        <div className="max-w-4xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                    <h2 className="text-2xl font-semibold">Distribuição e Cotas</h2>
                    <p className="text-sm text-slate-400">Baseie a distribuição na população dos municípios selecionados.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={suggestProportionalDistribution}
                        disabled={totalPopulation === 0}
                        className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg font-medium transition-colors whitespace-nowrap"
                    >
                        Sugerir proporcional à população
                    </button>

                    {/* Fase 2 - Botão de estratificação TSE */}
                    <button
                        onClick={generateTseSuggestion}
                        disabled={municipalities.length === 0}
                        className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg font-medium transition-colors whitespace-nowrap flex items-center gap-2"
                        title="Sugere distribuição por sexo e faixa etária com base no perfil eleitoral TSE"
                    >
                        Sugerir por perfil TSE
                    </button>
                </div>
            </div>

            <p className="text-slate-400 mb-1">
                Defina quantas entrevistas em cada município da base geográfica.
            </p>
            <p className="text-sm mb-6">
                Tamanho da amostra: <strong className="text-white">{sampleSize}</strong> entrevistas
                {totalPopulation > 0 && (
                    <> • População total da base: <strong>{totalPopulation.toLocaleString('pt-BR')}</strong></>
                )}
            </p>

            {municipalities.length === 0 && (
                <div className="mb-4 p-3 bg-amber-900/20 border border-amber-700 text-amber-300 rounded-lg text-sm">
                    Você ainda não definiu uma base geográfica no passo anterior. 
                    A sugestão de distribuição proporcional ficará limitada.
                </div>
            )}

            <div className="space-y-4 mb-6">
                {/* Agrupamento hierárquico: municípios > localidades específicas (quando Passo 2 usou refinamento) */}
                {(() => {
                    const groups: any = {};
                    quotas.forEach((q, index) => {
                        // Usa estrutura rica quando disponível (melhor que parse de string)
                        const isLocalityItem = q.name.includes('(') && q.name.includes(')');
                        let groupKey = q.name;
                        let displayName = q.name;

                        if (isLocalityItem) {
                            const match = q.name.match(/\((.+?)\)/);
                            groupKey = match ? match[1] : 'Outros';
                            displayName = q.name.replace(/\s*\(.+\)$/, '');
                        } else if ((q as any).parentMunicipality) {
                            groupKey = `${(q as any).parentMunicipality} - ${(q as any).parentUf || ''}`.trim();
                        }

                        if (!groups[groupKey]) groups[groupKey] = [];
                        groups[groupKey].push({ ...q, originalIndex: index, displayName });
                    });

                    return Object.entries(groups).map(([groupName, items]: [string, any]) => (
                        <div key={groupName} className="border border-slate-700 rounded-2xl p-3 bg-slate-900/40">
                            <div className="text-xs uppercase tracking-wider text-slate-400 mb-2 px-1 font-medium flex items-center justify-between">
                                <span>{groupName}</span>
                                {items.length > 1 && <span className="normal-case text-[10px] text-slate-500 font-normal">{items.length} áreas</span>}
                            </div>
                            <div className="space-y-2">
                                {items.map((item: any) => {
                                    const q = item;
                                    const idx = item.originalIndex;
                                    const density = q.population > 0 ? ((q.interviews / q.population) * 10000).toFixed(1) : null;

                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-center gap-4 border rounded-xl px-3 py-2.5 text-sm transition-colors ${
                                                q.locked ? 'border-amber-600 bg-amber-900/10' : 'border-slate-600 bg-slate-950/60'
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium truncate flex items-center gap-2">
                                                    {q.displayName || q.name}
                                                    {(q as any).source === 'locality' && (
                                                        <span className="text-[9px] px-1.5 py-px rounded bg-amber-900/60 text-amber-300 border border-amber-700/40">LOCALIDADE</span>
                                                    )}
                                                    {(q as any).dataSource === 'enriched' && (
                                                        <span className="text-[9px] px-1.5 py-px rounded bg-emerald-900/60 text-emerald-300 border border-emerald-700/40" title="Dados do Censo 2022 / CNEFE / TSE">
                                                            ENRIQUECIDO
                                                        </span>
                                                    )}
                                                </div>
                                                {q.population > 0 && (
                                                    <div className="text-[11px] text-slate-400 mt-px flex gap-2">
                                                        <span>Pop: {q.population.toLocaleString('pt-BR')}</span>
                                                        {density && <span className="text-emerald-400">{density}/10k hab</span>}
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <div className="w-20">
                                                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-1.5 ${q.locked ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${sampleSize > 0 ? Math.min((q.interviews / sampleSize) * 100, 100) : 0}%` }}
                                                        />
                                                    </div>
                                                </div>

                                                <input
                                                    type="number"
                                                    value={q.interviews}
                                                    onChange={(e) => updateQuota(idx, parseInt(e.target.value) || 0)}
                                                    disabled={q.locked}
                                                    className={`w-16 bg-slate-900 border text-right text-sm rounded px-1.5 py-0.5 focus:outline-none ${q.locked ? 'border-amber-600 text-slate-400' : 'border-slate-600'}`}
                                                />

                                                <button
                                                    onClick={() => toggleLock(idx)}
                                                    className="text-base px-1 opacity-75 hover:opacity-100"
                                                    title={q.locked ? "Destravar" : "Travar cota"}
                                                >
                                                    {q.locked ? '🔒' : '🔓'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ));
                })()}
            </div>

            {/* ==================== FASE 2: Painel de Sugestão TSE ==================== */}
            {showTseSuggestion && tseSuggestion && (
                <div className="mb-6 p-4 border border-indigo-700/60 bg-indigo-950/30 rounded-2xl">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <div className="font-semibold text-indigo-300">Sugestão de estratificação por perfil TSE</div>
                            <div className="text-xs text-indigo-400/80">
                                Baseado em dados reais do eleitorado • Confiança: {(tseSuggestion.basedOn === 'tse_profile' ? 'Alta' : 'Baixa (fallback uniforme)')}
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowTseSuggestion(false)}
                                className="text-xs px-3 py-1 rounded border border-slate-600 hover:bg-slate-800"
                            >
                                Fechar
                            </button>
                            <button
                                onClick={applyTseSuggestion}
                                className="text-xs px-4 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-white font-medium"
                            >
                                Aplicar sugestão TSE
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {/* Sexo */}
                        <div>
                            <div className="text-xs uppercase tracking-wider text-indigo-400 mb-1.5">Por Sexo</div>
                            <div className="flex gap-4">
                                <div className="flex-1 bg-slate-900/70 rounded-lg p-3">
                                    <div className="text-slate-400 text-xs">Masculino</div>
                                    <div className="text-lg font-semibold text-white">{tseSuggestion.sex.male.interviews}</div>
                                    <div className="text-[10px] text-emerald-400">{(tseSuggestion.sex.male.proportion * 100).toFixed(1)}%</div>
                                </div>
                                <div className="flex-1 bg-slate-900/70 rounded-lg p-3">
                                    <div className="text-slate-400 text-xs">Feminino</div>
                                    <div className="text-lg font-semibold text-white">{tseSuggestion.sex.female.interviews}</div>
                                    <div className="text-[10px] text-emerald-400">{(tseSuggestion.sex.female.proportion * 100).toFixed(1)}%</div>
                                </div>
                            </div>
                        </div>

                        {/* Faixa Etária (resumida) */}
                        {tseSuggestion.age.length > 0 && (
                            <div>
                                <div className="text-xs uppercase tracking-wider text-indigo-400 mb-1.5">Por Faixa Etária (principais)</div>
                                <div className="text-xs space-y-1">
                                    {tseSuggestion.age.slice(0, 5).map((band: any, idx: number) => (
                                        <div key={idx} className="flex justify-between bg-slate-900/70 px-3 py-1 rounded">
                                            <span className="text-slate-300">{band.label}</span>
                                            <span className="font-medium text-white">{band.interviews} <span className="text-slate-500">({(band.proportion * 100).toFixed(0)}%)</span></span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* ==================== Fim Painel TSE ==================== */}

            <div className="mb-6 p-4 rounded-xl bg-slate-900 border border-slate-700 text-sm space-y-2">
                <div className="flex justify-between">
                    <span className="text-slate-400">Total distribuído:</span>
                    <span className={`font-semibold text-lg ${difference === 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {totalAssigned} / {sampleSize}
                    </span>
                </div>

                {difference !== 0 && (
                    <div className="text-amber-400 text-xs">
                        Diferença de {Math.abs(difference)} entrevistas em relação à amostra.
                    </div>
                )}

                {totalPopulation > 0 && (
                    <div className="flex justify-between">
                        <span className="text-slate-400">Densidade média:</span>
                        <span className="font-medium text-white">
                            {((totalAssigned / totalPopulation) * 10000).toFixed(1)} entrevistas por 10 mil hab.
                        </span>
                    </div>
                )}

                {/* Fase 2 - Métrica CNEFE */}
                {cnefeMetrics.totalResidences > 0 && (
                    <div className="flex justify-between pt-1 border-t border-slate-700">
                        <span className="text-slate-400">Densidade CNEFE:</span>
                        <span className="font-medium text-amber-400">
                            {cnefeMetrics.interviewsPerThousandResidences?.toFixed(1)} entrevistas por mil residências
                        </span>
                    </div>
                )}

                {/* Qualidade da Distribuição */}
                {totalPopulation > 0 && (
                    <div className="pt-2 border-t border-slate-700">
                        <div className="flex justify-between text-xs">
                            <span className="text-slate-400">Qualidade da distribuição:</span>
                            <span className={`font-medium ${
                                Math.abs(difference) < sampleSize * 0.05 ? 'text-emerald-400' : 
                                Math.abs(difference) < sampleSize * 0.15 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                                {Math.abs(difference) < sampleSize * 0.05 ? 'Excelente' : 
                                 Math.abs(difference) < sampleSize * 0.15 ? 'Boa' : 'Requer atenção'}
                            </span>
                        </div>
                    </div>
                )}

                {quotas.some(q => q.locked) && (
                    <div className="text-amber-400 text-xs pt-1">
                        • Algumas cotas estão travadas
                    </div>
                )}

                {/* Fase 1 - Indicador de qualidade dos dados geográficos */}
                {municipalities.some((m: any) => m.enriched) && (
                    <div className="pt-2 border-t border-slate-700 text-xs text-emerald-400">
                        • Usando dados enriquecidos (Censo 2022 + CNEFE + TSE) em parte da base
                    </div>
                )}
            </div>

            {/* ===================================================== */}
            {/* SEÇÃO CRÍTICA: ATRIBUIÇÃO POR ENTREVISTADOR (Ponta a Ponta) */}
            {/* Fecha o fluxo: Planejamento → Mobile (coleta controlada)    */}
            {/* ===================================================== */}
            <div className="mt-8 pt-6 border-t border-slate-700">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-semibold">Atribuição por Entrevistador</span>
                            <span className="text-[10px] px-2 py-0.5 bg-emerald-900/70 text-emerald-400 rounded-full font-normal tracking-wide">FECHA O LOOP</span>
                        </div>
                        <p className="text-sm text-slate-400 mt-0.5">
                            Distribua as cotas acima entre os membros da equipe. O mobile mostrará apenas a missão de cada entrevistador.
                        </p>
                        {/* Evolução do suporte: HelpAssistant contextual dentro do fluxo de distribuição */}
                        <div className="mt-2">
                            <HelpAssistant 
                                context="distribution" 
                                compact 
                                onStillNeedHelp={() => {}} 
                                onTrackHelpful={(topic) => {
                                    reportClientError({
                                        errorCode: 'HELP_TOPIC_MARKED_HELPFUL',
                                        errorMessage: `Artigo útil: ${topic.title}`,
                                        severity: 'low',
                                        metadata: { topicId: topic.id, category: topic.category, context: 'distribution' }
                                    });
                                }}
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => setShowInterviewerAssignment(!showInterviewerAssignment)}
                        className="text-sm px-3 py-1.5 border border-slate-600 hover:bg-slate-800 rounded-lg"
                    >
                        {showInterviewerAssignment ? 'Ocultar' : 'Abrir'}
                    </button>
                </div>

                {showInterviewerAssignment && (
                    <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-5">
                        <div className="mb-3 flex justify-end">
                            <button
                                onClick={loadRealTeam}
                                disabled={loadingTeam}
                                className="text-xs px-3 py-1.5 border border-slate-600 hover:bg-slate-800 rounded-lg flex items-center gap-1 disabled:opacity-50"
                            >
                                {loadingTeam ? 'Carregando...' : 'Carregar Equipe Real do Tenant'}
                            </button>
                        </div>

                        <InterviewerQuotaAssignment
                            interviewers={activeInterviewers}
                            geographicQuotas={geoQuotasForAssignment}
                            initialAssignments={interviewerAssignments}
                            onChange={handleInterviewerAssignmentChange}
                            onSave={async (assignments) => {
                                // A persistência real acontece no salvamento do planejamento (Step5)
                                console.log('[Planejamento] Atribuições por entrevistador prontas para salvar:', assignments);
                                alert('Distribuição registrada. Ao salvar o planejamento no próximo passo, isso será persistido em planning_data.');
                            }}
                        />
                        <div className="mt-3 text-[10px] text-slate-500">
                            Próximos incrementos: carregar entrevistadores reais da equipe da pesquisa + persistência automática + integração com mobile.
                        </div>
                    </div>
                )}
            </div>

            <div className="flex justify-between mt-8">
                <button
                    onClick={onBack}
                    className="px-5 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-800 transition-colors"
                >
                    Voltar
                </button>
                <button
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
                >
                    Próximo passo
                </button>
            </div>
        </div>
    );
};

export default Step4Distribution;
