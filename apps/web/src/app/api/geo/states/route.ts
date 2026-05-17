import { NextRequest } from 'next/server';
import { apiSuccess, trackedApiError, handleApiUnhandledError } from '@/lib/api-middleware';
import { BR_STATES } from '@/lib/geo/br-reference';
import { getOrRefreshGeoCache } from '@/lib/geo/ibge-cache';

type IbgeStateResponse = {
    id: number;
    sigla: string;
    nome: string;
};

type StateOption = {
    code: number;
    uf: string;
    name: string;
};

type StatesPayload = {
    states: StateOption[];
};

const IBGE_STATES_URL = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados?orderBy=nome';
const STATES_CACHE_SECONDS = 60 * 60 * 24 * 30;

export async function GET(request: NextRequest) {
    try {
        const cached = await getOrRefreshGeoCache<StatesPayload>({
            cacheKey: 'ibge:states:all',
            resourceType: 'states',
            scope: 'BR',
            ttlSeconds: STATES_CACHE_SECONDS,
            fetchFresh: async () => {
                const response = await fetch(IBGE_STATES_URL, {
                    next: { revalidate: STATES_CACHE_SECONDS },
                });

                if (!response.ok) {
                    throw new Error(`IBGE states request failed with status ${response.status}`);
                }

                const payload = (await response.json()) as IbgeStateResponse[];

                const states = payload
                    .map((state) => ({
                        code: state.id,
                        uf: state.sigla,
                        name: state.nome,
                    }))
                    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

                return {
                    payload: { states },
                };
            },
        });

        return apiSuccess({
            source: cached.source === 'cache' ? 'cache' : 'ibge',
            states: cached.payload.states,
            cache_status: cached.cacheStatus,
            warning: cached.warning ?? null,
        });
    } catch {
        try {
            await trackedApiError(request, 'Falha ao consultar estados no IBGE', 500, {
                errorCode: 'EXTERNAL_API_FAILED',
                metadata: { route: '/api/geo/states' },
            });

            const states = BR_STATES.map((state) => ({
                code: state.code,
                uf: state.uf,
                name: state.name,
            })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

            return apiSuccess({
                source: 'fallback',
                states,
                cache_status: 'miss',
            });
        } catch (instrumentationError) {
            return handleApiUnhandledError(request, instrumentationError, {
                errorCode: 'API_UNHANDLED_EXCEPTION',
                metadata: { route: '/api/geo/states' },
            });
        }
    }
}
