import { NextRequest } from 'next/server';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
} from '@/lib/api-middleware';
import { getFallbackCitiesByState, resolveStateCode } from '@/lib/geo/br-reference';
import { getOrRefreshGeoCache } from '@/lib/geo/ibge-cache';

type IbgeCityResponse = {
    id: number;
    nome: string;
};

type CitiesPayload = {
    cities: string[];
};

const CITIES_CACHE_SECONDS = 60 * 60 * 24 * 30;

function toIbgeCitiesUrl(stateCode: number): string {
    return `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${stateCode}/municipios?orderBy=nome`;
}

export async function GET(request: NextRequest) {
    const stateParam = request.nextUrl.searchParams.get('state');

    if (!stateParam?.trim()) {
        return apiError('Informe o parametro state (nome, UF ou codigo IBGE).', 400);
    }

    const stateCode = resolveStateCode(stateParam);

    if (!stateCode) {
        return apiSuccess({
            source: 'fallback',
            cities: getFallbackCitiesByState(stateParam),
            warning: 'Estado nao reconhecido para consulta no IBGE.',
        });
    }

    try {
        const cached = await getOrRefreshGeoCache<CitiesPayload>({
            cacheKey: `ibge:cities:state:${stateCode}`,
            resourceType: 'cities_state',
            scope: String(stateCode),
            ttlSeconds: CITIES_CACHE_SECONDS,
            fetchFresh: async () => {
                const response = await fetch(toIbgeCitiesUrl(stateCode), {
                    next: { revalidate: CITIES_CACHE_SECONDS },
                });

                if (!response.ok) {
                    throw new Error(`IBGE cities request failed with status ${response.status}`);
                }

                const payload = (await response.json()) as IbgeCityResponse[];

                const cities = payload
                    .map((city) => city.nome)
                    .sort((a, b) => a.localeCompare(b, 'pt-BR'));

                return { payload: { cities } };
            },
        });

        return apiSuccess({
            source: cached.source === 'cache' ? 'cache' : 'ibge',
            cities: cached.payload.cities,
            stateCode,
            cache_status: cached.cacheStatus,
            warning: cached.warning ?? null,
        });
    } catch (error) {
        try {
            await trackedApiError(request, 'Falha ao consultar cidades no IBGE', 500, {
                errorCode: 'EXTERNAL_API_FAILED',
                metadata: { route: '/api/geo/cities', stateParam },
            });

            return apiSuccess({
                source: 'fallback',
                cities: getFallbackCitiesByState(stateParam),
                stateCode,
                cache_status: 'miss',
            });
        } catch (instrumentationError) {
            return handleApiUnhandledError(request, instrumentationError, {
                errorCode: 'API_UNHANDLED_EXCEPTION',
                metadata: { route: '/api/geo/cities' },
            });
        }
    }
}
