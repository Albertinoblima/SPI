/**
 * GET /api/geo/municipality-profile?state=SP&city=São Paulo
 *
 * Endpoint enriquecido para o módulo de Planejamento de Pesquisa.
 * Retorna o melhor conjunto consolidado de dados disponíveis no banco
 * (IBGE Censo + TSE + CNEFE) para um município.
 *
 * Prioridades:
 * - População: geo_demograficos_municipio (Censo 2022) > populacao_estimada
 * - Eleitores: agregados de geo_dados_eleitorais
 * - Residências: geo_dados_residenciais (CNEFE 2022)
 *
 * Mantém compatibilidade com o padrão de respostas do projeto (apiSuccess / apiError).
 */

import { NextRequest } from 'next/server';
import {
    apiError,
    apiSuccess,
    trackedApiError,
    handleApiUnhandledError,
    requireTenantAdmin,
} from '@/lib/api-middleware';
import { normalizeGeoText, resolveStateCode } from '@/lib/geo/br-reference';

interface MunicipalityProfileResponse {
    municipality: {
        ibge_id: number;
        name: string;
        uf: string;
        region: string | null;
        estimated_population: number | null;
    };
    census: {
        population_total: number | null;
        population_male: number | null;
        population_female: number | null;
        year: number;
        source: string;
    } | null;
    electorate: {
        total: number;
        percentage_of_population: number | null;
        source: string;
    };
    cnefe: {
        residences_total: number;
        source: string;
    };
    localities: {
        total: number;
        urban: number;
        rural: number;
    };
    data_quality: {
        has_census: boolean;
        has_tse: boolean;
        has_cnefe: boolean;
        ingestion_score: number; // 0-3
        last_ingestion_at: string | null;
    };
    recommended_population: number | null; // melhor valor disponível para uso em cotas
    sources: string[];
}

export async function GET(request: NextRequest) {
    const auth = await requireTenantAdmin(request);
    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Não autorizado', auth.status ?? 401);
    }

    try {
        const stateParam = request.nextUrl.searchParams.get('state')?.trim() ?? '';
        const cityParam = request.nextUrl.searchParams.get('city')?.trim() ?? '';

        if (!stateParam || !cityParam) {
            return apiError('Parâmetros obrigatórios: state e city', 400);
        }

        const stateCode = resolveStateCode(stateParam);
        if (!stateCode) {
            return apiError(`Estado não reconhecido: "${stateParam}"`, 400);
        }

        const normalizedCity = normalizeGeoText(cityParam);

        // 1. Buscar município base
        const { data: municipio, error: munError } = await auth.supabase
            .from('geo_municipios')
            .select('id_ibge, nome, uf, regiao, populacao_estimada')
            .eq('uf', stateParam.toUpperCase().slice(0, 2)) // mais confiável que normalização simples
            .ilike('nome_normalizado', `%${normalizedCity}%`)
            .limit(1)
            .single();

        let resolvedMunicipio = municipio;

        if (munError || !resolvedMunicipio) {
            // Tenta fallback mais amplo
            const { data: fallbackMun } = await auth.supabase
                .from('geo_municipios')
                .select('id_ibge, nome, uf, regiao, populacao_estimada')
                .ilike('nome_normalizado', `%${normalizedCity}%`)
                .limit(1)
                .single();

            if (!fallbackMun) {
                return apiSuccess({
                    source: 'database',
                    match_type: 'none',
                    warning: `Município "${cityParam}" não encontrado na base geográfica enriquecida.`,
                });
            }
            resolvedMunicipio = fallbackMun;
        }

        const ibgeId = resolvedMunicipio.id_ibge;

        // Buscar IDs das localidades uma única vez (usado por várias queries)
        const { data: localityIdsData } = await auth.supabase
            .from('geo_localidades')
            .select('id')
            .eq('municipio_id', ibgeId);

        const localityIds = (localityIdsData ?? []).map((l: any) => l.id);

        // 2. Buscar dados demográficos municipais (Censo) - paralelo
        const [censusRes, viewRes, residencesRes, ingestionRes] = await Promise.all([
            // Censo municipal (melhor fonte de população)
            auth.supabase
                .from('geo_demograficos_municipio')
                .select('populacao_total, populacao_masculina, populacao_feminina, ano_censo')
                .eq('municipio_id', ibgeId)
                .order('ano_censo', { ascending: false })
                .limit(1)
                .maybeSingle(),

            // View consolidada (eleitores + localidades + residências agregadas)
            auth.supabase
                .from('vw_municipio_resumo')
                .select('populacao_censo, residencias_cnefe, total_eleitores, percentual_eleitores, total_localidades, localidades_urbanas, localidades_rurais, ultima_ingestao_em')
                .eq('id_ibge', ibgeId)
                .maybeSingle(),

            // Contagem agregada de residências CNEFE (via localidade)
            localityIds.length > 0
                ? auth.supabase
                      .from('geo_dados_residenciais')
                      .select('quantidade_residencias')
                      .eq('ano_censo', 2022)
                      .in('localidade_id', localityIds)
                : Promise.resolve({ data: [], count: 0 }),

            // Último log de ingestão
            auth.supabase
                .from('geo_ingestao_log')
                .select('concluido_em, status')
                .eq('municipio_id', ibgeId)
                .order('concluido_em', { ascending: false })
                .limit(1)
                .maybeSingle(),
        ]);

        const census = censusRes.data;
        const view = viewRes.data;

        // 3. Montar resposta enriquecida
        const hasCensus = !!census?.populacao_total || (view?.populacao_censo ?? 0) > 0;
        const hasTse = (view?.total_eleitores ?? 0) > 0;

        const cnefeFromView = view?.residencias_cnefe ?? 0;
        const cnefeFromDirect = Array.isArray(residencesRes.data)
            ? residencesRes.data.reduce((sum: number, r: any) => sum + (r.quantidade_residencias || 0), 0)
            : 0;
        const hasCnefe = cnefeFromView > 0 || cnefeFromDirect > 0;

        const ingestionScore =
            (hasCensus ? 1 : 0) +
            (hasTse ? 1 : 0) +
            (hasCnefe ? 1 : 0);

        const recommendedPopulation =
            census?.populacao_total ||
            view?.populacao_censo ||
            resolvedMunicipio.populacao_estimada ||
            null;

        const profile: MunicipalityProfileResponse = {
            municipality: {
                ibge_id: resolvedMunicipio.id_ibge,
                name: resolvedMunicipio.nome,
                uf: resolvedMunicipio.uf,
                region: resolvedMunicipio.regiao,
                estimated_population: resolvedMunicipio.populacao_estimada,
            },
            census: census
                ? {
                      population_total: census.populacao_total,
                      population_male: census.populacao_masculina,
                      population_female: census.populacao_feminina,
                      year: census.ano_censo,
                      source: 'IBGE Censo 2022',
                  }
                : view?.populacao_censo
                ? {
                      population_total: view.populacao_censo,
                      population_male: null,
                      population_female: null,
                      year: 2022,
                      source: 'IBGE Censo 2022 (agregado)',
                  }
                : null,
            electorate: {
                total: view?.total_eleitores ?? 0,
                percentage_of_population: view?.percentual_eleitores ?? null,
                source: 'TSE (Perfil do Eleitorado)',
            },
            cnefe: {
                residences_total: cnefeFromView || cnefeFromDirect,
                source: 'IBGE CNEFE 2022',
            },
            localities: {
                total: view?.total_localidades ?? 0,
                urban: view?.localidades_urbanas ?? 0,
                rural: view?.localidades_rurais ?? 0,
            },
            data_quality: {
                has_census: hasCensus,
                has_tse: hasTse,
                has_cnefe: hasCnefe,
                ingestion_score: ingestionScore,
                last_ingestion_at: ingestionRes.data?.concluido_em ?? view?.ultima_ingestao_em ?? null,
            },
            recommended_population: recommendedPopulation,
            sources: [
                ...(hasCensus ? ['IBGE Censo 2022'] : []),
                ...(hasTse ? ['TSE'] : []),
                ...(hasCnefe ? ['CNEFE 2022'] : []),
                'IBGE (estimativa)',
            ].filter(Boolean),
        };

        return apiSuccess({
            source: 'database_enriched',
            match_type: 'exact',
            data: profile,
        });
    } catch (error) {
        await trackedApiError(request, 'Falha ao consultar municipality-profile enriquecido', 500, {
            errorCode: 'GEO_PROFILE_FAILED',
            metadata: {
                route: '/api/geo/municipality-profile',
                state: request.nextUrl.searchParams.get('state'),
                city: request.nextUrl.searchParams.get('city'),
            },
        });

        return handleApiUnhandledError(request, error, {
            errorCode: 'API_UNHANDLED_EXCEPTION',
            metadata: { route: '/api/geo/municipality-profile' },
        });
    }
}
