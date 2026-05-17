import { NextRequest } from 'next/server';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import { BR_STATES, resolveStateCode } from '@/lib/geo/br-reference';
import { getOrRefreshGeoCache } from '@/lib/geo/ibge-cache';

type IbgeAggregateSeries = {
    serie?: Record<string, string>;
};

type IbgeAggregateResult = {
    resultados?: Array<{
        series?: IbgeAggregateSeries[];
    }>;
};

type PopulationExtraction = {
    population: number | null;
    referenceYear: number | null;
};

const POPULATION_CACHE_SECONDS = 60 * 60 * 24;

function toStatePopulationUrls(stateCode: number): string[] {
    return [
        `https://servicodados.ibge.gov.br/api/v3/agregados/9514/periodos/2022/variaveis/93?localidades=N3[${stateCode}]`,
        `https://servicodados.ibge.gov.br/api/v3/agregados/4714/periodos/2022/variaveis/93?localidades=N3[${stateCode}]`,
    ];
}

function extractPopulationFromAggregate(payload: IbgeAggregateResult): PopulationExtraction {
    const firstResult = payload?.resultados?.[0];
    const firstSeries = firstResult?.series?.[0];
    const serieMap = firstSeries?.serie;

    if (!serieMap) return { population: null, referenceYear: null };

    const years = Object.keys(serieMap).sort((a, b) => Number(b) - Number(a));
    if (years.length === 0) return { population: null, referenceYear: null };

    const latestYear = Number(years[0]);
    const latestValue = serieMap[years[0]];
    if (!latestValue) {
        return {
            population: null,
            referenceYear: Number.isFinite(latestYear) ? latestYear : null,
        };
    }

    const parsed = Number(String(latestValue).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return {
            population: null,
            referenceYear: Number.isFinite(latestYear) ? latestYear : null,
        };
    }

    return {
        population: Math.round(parsed),
        referenceYear: Number.isFinite(latestYear) ? latestYear : null,
    };
}

async function fetchStatePopulation(stateCode: number): Promise<PopulationExtraction> {
    const urls = toStatePopulationUrls(stateCode);

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

    if (!stateParam?.trim()) {
        return apiError('Informe state para consultar a população estadual.', 400);
    }

    const stateCode = resolveStateCode(stateParam);
    if (!stateCode) {
        return apiError('Estado inválido para consulta de população estadual.', 400);
    }

    const stateInfo = BR_STATES.find((item) => item.code === stateCode) ?? null;

    try {
        const cacheKey = `ibge:population:state:${stateCode}`;

        const cached = await getOrRefreshGeoCache<PopulationExtraction>({
            cacheKey,
            resourceType: 'population_state',
            scope: String(stateCode),
            ttlSeconds: POPULATION_CACHE_SECONDS,
            fetchFresh: async () => {
                const extraction = await fetchStatePopulation(stateCode);
                return {
                    payload: extraction,
                    source: extraction.population ? 'ibge' : 'fallback',
                    sourceUpdatedAt: extraction.referenceYear ? `${extraction.referenceYear}-01-01T00:00:00.000Z` : null,
                };
            },
        });

        return apiSuccess({
            source: cached.payload.population ? (cached.source === 'cache' ? 'cache' : 'ibge') : 'fallback',
            population: cached.payload.population,
            reference_year: cached.payload.referenceYear,
            cache_status: cached.cacheStatus,
            stateCode,
            stateName: stateInfo?.name ?? null,
            uf: stateInfo?.uf ?? null,
            warning: cached.warning ?? null,
        });
    } catch (error) {
        try {
            await trackedApiError(request, 'Falha ao consultar população estadual no IBGE', 500, {
                errorCode: 'EXTERNAL_API_FAILED',
                metadata: { route: '/api/geo/population/state', stateParam },
            });

            return apiSuccess({
                source: 'fallback',
                population: null,
                reference_year: null,
                stateCode,
                stateName: stateInfo?.name ?? null,
                uf: stateInfo?.uf ?? null,
                warning: 'Nao foi possivel consultar a populacao estadual no IBGE no momento.',
            });
        } catch (instrumentationError) {
            return handleApiUnhandledError(request, instrumentationError, {
                errorCode: 'API_UNHANDLED_EXCEPTION',
                metadata: { route: '/api/geo/population/state' },
            });
        }
    }
}
