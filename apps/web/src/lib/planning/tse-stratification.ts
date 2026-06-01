/**
 * tse-stratification.ts
 * 
 * Helper para Fase 2 – Estratificação Inteligente de Cotas
 * 
 * Usa os dados TSE já existentes (tse-voter-profiles + tse-voter-data.json)
 * para calcular sugestões de distribuição de entrevistas por sexo e faixa etária.
 * 
 * Também calcula métricas de densidade baseadas em dados CNEFE quando disponíveis.
 */

import {
    getTseVoterList,
    computeProportions,
    type TseVoterCity,
    TSE_AGE_LABELS,
} from '@/lib/geo/tse-voter-profiles';
import { normalizeGeoText } from '@/lib/geo/br-reference';

// Tipos exportados
export interface TseSexDistribution {
    male: number;      // proporção 0-1
    female: number;
    unknown: number;
}

export interface TseAgeBand {
    key: string;
    label: string;
    proportion: number; // 0-1
}

export interface TseProfile {
    totalElectorate: number;
    sex: TseSexDistribution;
    ageBands: TseAgeBand[];
    source: 'tse' | 'none';
    confidence: number;
}

export interface StratificationSuggestion {
    sex: {
        male: { interviews: number; proportion: number };
        female: { interviews: number; proportion: number };
    };
    age: Array<{
        key: string;
        label: string;
        interviews: number;
        proportion: number;
    }>;
    totalSample: number;
    basedOn: 'tse_profile' | 'uniform';
}

/**
 * Busca o perfil TSE mais próximo para um município.
 * Usa a mesma lógica de matching inteligente já existente.
 */
export function getTseProfileForArea(
    uf: string,
    cityName: string
): TseProfile {
    const list = getTseVoterList();
    if (!list.length) {
        return {
            totalElectorate: 0,
            sex: { male: 0, female: 0, unknown: 0 },
            ageBands: [],
            source: 'none',
            confidence: 0,
        };
    }

    const normalizedUf = uf.toUpperCase().trim();
    const normalizedInput = normalizeGeoText(cityName);

    // Filtra por UF
    const candidates = list.filter((c) => c.uf === normalizedUf);

    if (candidates.length === 0) {
        return {
            totalElectorate: 0,
            sex: { male: 0, female: 0, unknown: 0 },
            ageBands: [],
            source: 'none',
            confidence: 0,
        };
    }

    // Matching exato
    const exact = candidates.find(
        (c) => normalizeGeoText(c.name) === normalizedInput
    );

    let best: TseVoterCity | null = exact || null;
    let confidence = exact ? 1.0 : 0;

    // Matching fuzzy (mesma lógica do voters route)
    if (!best) {
        let bestScore = 0;
        for (const c of candidates) {
            const score = similarityScore(normalizedInput, normalizeGeoText(c.name));
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        }
        if (best && bestScore >= 0.72) {
            confidence = bestScore;
        } else {
            best = null;
        }
    }

    if (!best) {
        return {
            totalElectorate: 0,
            sex: { male: 0, female: 0, unknown: 0 },
            ageBands: [],
            source: 'none',
            confidence: 0,
        };
    }

    const proportions = computeProportions(best);

    const ageBands: TseAgeBand[] = Object.entries(proportions.age).map(([key, prop]) => ({
        key,
        label: TSE_AGE_LABELS[key] || key,
        proportion: prop / 100,
    }));

    return {
        totalElectorate: best.total,
        sex: {
            male: proportions.sex.m / 100,
            female: proportions.sex.f / 100,
            unknown: proportions.sex.n / 100,
        },
        ageBands,
        source: 'tse',
        confidence: Math.round(confidence * 1000) / 1000,
    };
}

/**
 * Calcula sugestão de estratificação a partir de múltiplas áreas + perfil TSE.
 */
export function computeTseStratifiedSuggestion(
    areas: Array<{ name: string; uf?: string; population: number }>,
    totalSample: number,
    options: { applySex?: boolean; applyAge?: boolean } = {}
): StratificationSuggestion {
    const { applySex = true, applyAge = true } = options;

    if (totalSample <= 0 || areas.length === 0) {
        return getUniformFallback(totalSample);
    }

    // Tenta obter perfis TSE para cada área
    const profiles: TseProfile[] = areas.map((area) => {
        if (!area.uf) {
            return {
                totalElectorate: 0,
                sex: { male: 0, female: 0, unknown: 0 },
                ageBands: [],
                source: 'none',
                confidence: 0,
            };
        }
        return getTseProfileForArea(area.uf, area.name);
    });

    const validProfiles = profiles.filter((p) => p.source === 'tse' && p.totalElectorate > 0);

    if (validProfiles.length === 0) {
        return getUniformFallback(totalSample);
    }

    // Agrega proporções ponderadas pela população (melhor aproximação)
    let totalPop = 0;
    let weightedMale = 0;
    let weightedFemale = 0;
    const weightedAge: Record<string, number> = {};

    areas.forEach((area, index) => {
        const profile = profiles[index];
        const pop = area.population || 0;
        if (pop <= 0 || !profile || profile.source !== 'tse') return;

        totalPop += pop;
        weightedMale += pop * profile.sex.male;
        weightedFemale += pop * profile.sex.female;

        profile.ageBands.forEach((band) => {
            weightedAge[band.key] = (weightedAge[band.key] || 0) + pop * band.proportion;
        });
    });

    if (totalPop === 0) {
        return getUniformFallback(totalSample);
    }

    const finalMaleProp = weightedMale / totalPop;
    const finalFemaleProp = weightedFemale / totalPop;

    // Normaliza idade
    const ageProportions = Object.entries(weightedAge).map(([key, val]) => ({
        key,
        proportion: val / totalPop,
    }));

    const normalizedAge = normalizeProportions(ageProportions);

    // Calcula entrevistas
    const maleInterviews = applySex ? Math.round(totalSample * finalMaleProp) : Math.floor(totalSample / 2);
    const femaleInterviews = applySex ? totalSample - maleInterviews : Math.ceil(totalSample / 2);

    const ageSuggestions = applyAge
        ? normalizedAge.map((band) => ({
            key: band.key,
            label: TSE_AGE_LABELS[band.key] || band.key,
            interviews: Math.max(1, Math.round(totalSample * band.proportion)),
            proportion: band.proportion,
        }))
        : [];

    return {
        sex: {
            male: { interviews: maleInterviews, proportion: finalMaleProp },
            female: { interviews: femaleInterviews, proportion: finalFemaleProp },
        },
        age: ageSuggestions,
        totalSample,
        basedOn: 'tse_profile',
    };
}

/**
 * Calcula densidade operacional baseada em CNEFE (residências).
 */
export interface CnefeDensityMetrics {
    totalResidences: number;
    interviewsPerThousandResidences: number | null;
    recommendedSampleForDensity: number | null; // exemplo: 1 entrevista a cada 200 residências
}

export function computeCnefeDensity(
    areas: Array<{ residencesCnefe?: number; population?: number }>,
    currentSampleSize: number
): CnefeDensityMetrics {
    const totalResidences = areas.reduce((sum, a) => sum + (a.residencesCnefe || 0), 0);

    if (totalResidences === 0) {
        return {
            totalResidences: 0,
            interviewsPerThousandResidences: null,
            recommendedSampleForDensity: null,
        };
    }

    const perThousand = (currentSampleSize / totalResidences) * 1000;

    // Exemplo de densidade "razoável" para pesquisas presenciais: ~5 entrevistas por mil residências
    const recommended = Math.round(totalResidences * 0.005);

    return {
        totalResidences,
        interviewsPerThousandResidences: Math.round(perThousand * 10) / 10,
        recommendedSampleForDensity: recommended,
    };
}

// ==================== Helpers internos ====================

function similarityScore(input: string, candidate: string): number {
    if (input === candidate) return 1;
    if (candidate.startsWith(input) || input.startsWith(candidate)) return 0.92;

    const inputTokens = input.split(/\s+/);
    const candidateTokens = candidate.split(/\s+/);
    const tokenMatches = inputTokens.filter((t) => candidateTokens.includes(t)).length;
    const tokenScore = tokenMatches / Math.max(inputTokens.length, candidateTokens.length);

    const maxLen = Math.max(input.length, candidate.length);
    const lev = 1 - levenshteinDistance(input, candidate) / maxLen;

    return tokenScore * 0.35 + lev * 0.65;
}

function levenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );
    for (let i = 0; i <= a.length; i += 1) {
        const row = dp[i];
        if (!row) continue;
        row[0] = i;
    }
    const firstRow = dp[0];
    if (firstRow) {
        for (let j = 0; j <= b.length; j += 1) firstRow[j] = j;
    }

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const row = dp[i];
            const prevRow = dp[i - 1];
            if (!row || !prevRow) continue;
            const up = prevRow[j] ?? 0;
            const left = row[j - 1] ?? 0;
            const diag = prevRow[j - 1] ?? 0;

            row[j] =
                a[i - 1] === b[j - 1]
                    ? diag
                    : 1 + Math.min(up, left, diag);
        }
    }
    return dp[a.length]?.[b.length] ?? 0;
}

function normalizeProportions(items: { key: string; proportion: number }[]) {
    const total = items.reduce((s, i) => s + i.proportion, 0) || 1;
    return items.map((i) => ({ ...i, proportion: i.proportion / total }));
}

function getUniformFallback(totalSample: number): StratificationSuggestion {
    return {
        sex: {
            male: { interviews: Math.floor(totalSample / 2), proportion: 0.5 },
            female: { interviews: Math.ceil(totalSample / 2), proportion: 0.5 },
        },
        age: [],
        totalSample,
        basedOn: 'uniform',
    };
}
