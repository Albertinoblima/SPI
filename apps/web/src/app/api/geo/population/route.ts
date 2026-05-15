import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { normalizeGeoText, resolveStateCode } from '@/lib/geo/br-reference';

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

function extractPopulationFromAggregate(payload: IbgeAggregateResult): number | null {
    const firstResult = payload?.resultados?.[0];
    const firstSeries = firstResult?.series?.[0];
    const serieMap = firstSeries?.serie;
    if (!serieMap) return null;

    const years = Object.keys(serieMap).sort((a, b) => Number(b) - Number(a));
    if (years.length === 0) return null;

    const latestValue = serieMap[years[0]];
    if (!latestValue) return null;

    const parsed = Number(String(latestValue).replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) return null;

    return Math.round(parsed);
}

async function resolveCityCode(stateCode: number, cityName: string): Promise<number | null> {
    const response = await fetch(toIbgeCitiesUrl(stateCode), {
        next: { revalidate: CITY_LIST_CACHE_SECONDS },
    });

    if (!response.ok) {
        throw new Error(`IBGE cities request failed with status ${response.status}`);
    }

    const payload = (await response.json()) as IbgeCityResponse[];
    const normalizedCity = normalizeGeoText(cityName);

    const exactMatch = payload.find((city) => normalizeGeoText(city.nome) === normalizedCity);
    if (exactMatch) return exactMatch.id;

    const startsWithMatch = payload.find((city) => normalizeGeoText(city.nome).startsWith(normalizedCity));
    if (startsWithMatch) return startsWithMatch.id;

    return null;
}

async function fetchPopulation(cityCode: number): Promise<number | null> {
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
            const population = extractPopulationFromAggregate(payload);
            if (population) {
                return population;
            }
        } catch {
            continue;
        }
    }

    return null;
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
        const cityCode = await resolveCityCode(stateCode, cityParam);
        if (!cityCode) {
            return apiSuccess({
                source: 'ibge',
                population: null,
                stateCode,
                warning: 'Municipio nao encontrado na base do IBGE para o estado informado.',
            });
        }

        const population = await fetchPopulation(cityCode);

        return apiSuccess({
            source: population ? 'ibge' : 'fallback',
            population,
            cityCode,
            stateCode,
        });
    } catch {
        return apiSuccess({
            source: 'fallback',
            population: null,
            stateCode,
            warning: 'Nao foi possivel consultar a populacao no IBGE no momento.',
        });
    }
}
