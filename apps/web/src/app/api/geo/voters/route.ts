import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { normalizeGeoText, resolveStateCode, BR_STATES } from '@/lib/geo/br-reference';
import {
    getTseVoterList,
    hasTseData,
    computeProportions,
    type TseVoterCity,
} from '@/lib/geo/tse-voter-profiles';

// --------------------------------------------------------------------------
// Matching helpers (mirrors population route logic)
// --------------------------------------------------------------------------

function levenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        Array(b.length + 1).fill(0)
    );
    for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            dp[i][j] =
                a[i - 1] === b[j - 1]
                    ? dp[i - 1][j - 1]
                    : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[a.length][b.length];
}

function similarityScore(input: string, candidate: string): number {
    if (input === candidate) return 1;
    if (candidate.startsWith(input) || input.startsWith(candidate)) return 0.95;

    const inputTokens = input.split(/\s+/);
    const candidateTokens = candidate.split(/\s+/);
    const tokenMatches = inputTokens.filter((t) => candidateTokens.includes(t)).length;
    const tokenScore = tokenMatches / Math.max(inputTokens.length, candidateTokens.length);

    const maxLen = Math.max(input.length, candidate.length);
    const levScore = maxLen === 0 ? 1 : 1 - levenshteinDistance(input, candidate) / maxLen;

    return tokenScore * 0.4 + levScore * 0.6;
}

const SMART_MATCH_THRESHOLD = 0.72;

type ResolveResult = {
    city: TseVoterCity | null;
    matchType: 'exact' | 'smart' | 'none';
    confidence: number;
};

function resolveCity(uf: string, cityName: string): ResolveResult {
    const list = getTseVoterList();
    const normalizedInput = normalizeGeoText(cityName);

    // Filter to the requested UF (for ZZ = overseas, also look there)
    const candidates = list.filter((c) => c.uf === uf);

    // 1. Exact match (normalized)
    const exact = candidates.find(
        (c) => normalizeGeoText(c.name) === normalizedInput
    );
    if (exact) return { city: exact, matchType: 'exact', confidence: 1 };

    // 2. Smart match
    let best: TseVoterCity | null = null;
    let bestScore = 0;
    for (const c of candidates) {
        const score = similarityScore(normalizedInput, normalizeGeoText(c.name));
        if (score > bestScore) {
            bestScore = score;
            best = c;
        }
    }

    if (best && bestScore >= SMART_MATCH_THRESHOLD) {
        return { city: best, matchType: 'smart', confidence: bestScore };
    }

    return { city: null, matchType: 'none', confidence: 0 };
}

// --------------------------------------------------------------------------
// Route handler
// --------------------------------------------------------------------------

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const stateParam = searchParams.get('state')?.trim() ?? '';
    const cityParam = searchParams.get('city')?.trim() ?? '';

    if (!stateParam || !cityParam) {
        return apiError('Parâmetros obrigatórios: state e city', 400);
    }

    if (!hasTseData()) {
        return apiError(
            'Dados do TSE ainda não foram gerados. Execute: powershell -ExecutionPolicy Bypass -File .\\scripts\\generate-tse-voters.ps1',
            503
        );
    }

    // Resolve UF
    const stateCode = resolveStateCode(stateParam);
    if (!stateCode) {
        return apiError(`Estado não reconhecido: "${stateParam}"`, 400);
    }
    const brState = BR_STATES.find((s) => s.code === stateCode);
    const uf = brState?.uf ?? stateParam.toUpperCase().slice(0, 2);

    const { city, matchType, confidence } = resolveCity(uf, cityParam);

    if (!city) {
        return apiSuccess({
            source: 'tse',
            match_type: 'none',
            warning: `Município "${cityParam}" não encontrado no ${uf}. Preencha o número de eleitores manualmente.`,
        });
    }

    const proportions = computeProportions(city);

    return apiSuccess({
        source: 'tse',
        total: city.total,
        cityName: city.name,
        uf: city.uf,
        match_type: matchType,
        confidence: Math.round(confidence * 1000) / 1000,
        ...(matchType === 'smart' && {
            warning: `Sugestão inteligente: "${city.name}" corresponde a "${cityParam}" com ${(confidence * 100).toFixed(1)}% de similaridade. Confirme antes de aplicar.`,
        }),
        proportions,
    });
}
