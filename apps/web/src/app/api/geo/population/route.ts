import { NextRequest } from 'next/server';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import { normalizeGeoText, resolveStateCode } from '@/lib/geo/br-reference';
import { getOrRefreshGeoCache } from '@/lib/geo/ibge-cache';

type IbgeCityResponse = {
    id: number;
    nome: string;
};

type IbgeAggregateSeries = {
    localidade?: { id?: string; nome?: string };
    serie?: Record<string, string>;
};

type IbgeAggregateResult = {
    resultados?: Array<{
        series?: IbgeAggregateSeries[];
    }>;
};

type CityCandidate = {
    id: number;
    name: string;
};

type ResolveCityResult = {
    cityCode: number | null;
    cityName: string | null;
    matchType: 'exact' | 'smart' | 'none';
    confidence: number;
};

type PopulationExtraction = {
    population: number | null;
    referenceYear: number | null;
};

const CITY_LIST_CACHE_SECONDS = 60 * 60 * 24 * 30;
const POPULATION_CACHE_SECONDS = 60 * 60 * 24 * 7;

function toIbgeCitiesUrl(stateCode: number): string {
    return `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`;
}

function toPopulationUrls(cityCode: number): string[] {
    return [
        `https://servicodados.ibge.gov.br/api/v3/agregados/9514/periodos/2022/variaveis/93?localidades=N6[${cityCode}]`,
        `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=N6[${cityCode}]`,
    ];
}

function levenshteinDistance(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

    for (let i = 0; i <= a.length; i += 1) dp[i][0] = i;
    for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;

    for (let i = 1; i <= a.length; i += 1) {
        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost,
            );
        }
    }

    return dp[a.length][b.length];
}

function similarityScore(input: string, candidate: string): number {
    if (!input || !candidate) return 0;
    if (input === candidate) return 1;

    if (candidate.startsWith(input) || input.startsWith(candidate)) {
        return 0.92;
    }

    const inputTokens = input.split(' ').filter(Boolean);
    const candidateTokens = candidate.split(' ').filter(Boolean);
    if (inputTokens.length > 0 && inputTokens.every((token) => candidateTokens.includes(token))) {
        return 0.88;
    }

    const maxLen = Math.max(input.length, candidate.length);
    if (maxLen === 0) return 0;
    const distance = levenshteinDistance(input, candidate);
    return 1 - (distance / maxLen);
}

function extractPopulationFromAggregate(payload: IbgeAggregateResult): PopulationExtraction {
    const firstResult = payload?.resultados?.[0];
    const firstSeries = firstResult?.series?.[0];
    const serieMap = firstSeries?.serie;
    if (!serieMap) return { population: null, referenceYear: null };

    const years = Object.keys(serieMap).sort((a, b) => Number(b) - Number(a));
    if (years.length === 0) return { population: null, referenceYear: null };

    const latestValue = serieMap[years[0]];
    if (!latestValue) return { population: null, referenceYear: Number(years[0]) || null };

    const parsed = Number(String(latestValue).replace(/\./g, '').replace(',', '.'));
    const referenceYear = Number(years[0]);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return {
            population: null,
            referenceYear: Number.isFinite(referenceYear) ? referenceYear : null,
        };
    }

    return {
        population: Math.round(parsed),
        referenceYear: Number.isFinite(referenceYear) ? referenceYear : null,
    };
}

async function resolveCityCandidate(stateCode: number, cityName: string): Promise<ResolveCityResult> {
    const response = await fetch(toIbgeCitiesUrl(stateCode), {
        next: { revalidate: CITY_LIST_CACHE_SECONDS },
    });

    if (!response.ok) {
        throw new Error(`IBGE cities request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as IbgeCityResponse[];
    const candidates: CityCandidate[] = payload.map((city) => ({ id: city.id, name: city.nome }));
    const normalizedCity = normalizeGeoText(cityName);

    const exactMatch = candidates.find((city) => normalizeGeoText(city.name) === normalizedCity);
    if (exactMatch) {
        return {
            cityCode: exactMatch.id,
            cityName: exactMatch.name,
            matchType: 'exact',
            confidence: 1,
        };
    }

    let best: { city: CityCandidate; score: number } | null = null;
    for (const city of candidates) {
        const score = similarityScore(normalizedCity, normalizeGeoText(city.name));
        if (!best || score > best.score) {
            best = { city, score };
        }
    }

    if (best && best.score >= 0.72) {
        return {
            cityCode: best.city.id,
            cityName: best.city.name,
            matchType: 'smart',
            confidence: Number(best.score.toFixed(3)),
        };
    }

    return {
        cityCode: null,
        cityName: null,
        matchType: 'none',
        confidence: 0,
    };
}

async function fetchPopulation(cityCode: number): Promise<PopulationExtraction> {
    const urls = toPopulationUrls(cityCode);

    for (const url of urls) {
        try {
            const response = await fetch(url, {
                next: { revalidate: POPULATION_CACHE_SECONDS },
            });

            if (!response.ok) {
                continue;
            }

            const payload = (await response.json()) as IbgeAggregateResult;
            const extraction = extractPopulationFromAggregate(payload);
            if (extraction.population) {
                return extraction;
            }
        } catch {
            continue;
        }
    }

    return { population: null, referenceYear: null };
}

export async function GET(request: NextRequest) {
    const stateParam = request.nextUrl.searchParams.get('state');
    const cityParam = request.nextUrl.searchParams.get('city');

    if (!stateParam?.trim() || !cityParam?.trim()) {
        return apiError('Informe state e city para consultar a população.', 400);
    }

    const stateCode = resolveStateCode(stateParam);
    if (!stateCode) {
        return apiError('Estado inválido para consulta de população.', 400);
    }

    try {
        const cityResolution = await resolveCityCandidate(stateCode, cityParam);
        if (!cityResolution.cityCode) {
            return apiSuccess({
                source: 'ibge',
                population: null,
                stateCode,
                match_type: 'none',
                warning: 'Municipio nao encontrado na base do IBGE para o estado informado.',
            });
        }

        const cacheKey = `ibge:population:city:${cityResolution.cityCode}`;

        const cached = await getOrRefreshGeoCache<PopulationExtraction>({
            cacheKey,
            resourceType: 'population_city',
            scope: String(stateCode),
            ttlSeconds: 60 * 60 * 24,
            fetchFresh: async () => {
                const extraction = await fetchPopulation(cityResolution.cityCode as number);
                return {
                    payload: extraction,
                    source: extraction.population ? 'ibge' : 'fallback',
                    sourceUpdatedAt: extraction.referenceYear ? `${extraction.referenceYear}-01-01T00:00:00.000Z` : null,
                };
            },
        });

        const population = cached.payload.population;
        const referenceYear = cached.payload.referenceYear;

        const warning = cityResolution.matchType === 'smart'
            ? `Nao houve correspondencia exata para "${cityParam}". Sugestao inteligente: ${cityResolution.cityName}.`
            : null;

        return apiSuccess({
            source: population ? (cached.source === 'cache' ? 'cache' : 'ibge') : 'fallback',
            population,
            cityCode: cityResolution.cityCode,
            cityName: cityResolution.cityName,
            stateCode,
            reference_year: referenceYear,
            cache_status: cached.cacheStatus,
            match_type: cityResolution.matchType,
            confidence: cityResolution.confidence,
            warning: [warning, cached.warning].filter(Boolean).join(' | ') || null,
        });
    } catch {
        try {
            await trackedApiError(request, 'Falha ao consultar população no IBGE', 500, {
                errorCode: 'EXTERNAL_API_FAILED',
                metadata: { route: '/api/geo/population', stateParam, cityParam },
            });

            return apiSuccess({
                source: 'fallback',
                population: null,
                stateCode,
                warning: 'Nao foi possivel consultar a populacao no IBGE no momento.',
            });
        } catch (instrumentationError) {
            return handleApiUnhandledError(request, instrumentationError, {
                errorCode: 'API_UNHANDLED_EXCEPTION',
                metadata: { route: '/api/geo/population' },
            });
        }
    }
}
