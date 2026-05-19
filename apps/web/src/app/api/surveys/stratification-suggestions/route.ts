/**
 * POST /api/surveys/stratification-suggestions
 * 
 * Gera sugestões de cotas de estratificação baseadas em dados demográficos IBGE.
 * Recebe um array de localidades (estado/cidade/específica) e retorna as cotas
 * sugeridas para sexo, faixa etária e escolaridade.
 * 
 * Se um critério tiver valor zero, não inclui sugestão para esse critério.
 */

import { NextRequest } from 'next/server';
import { apiError, apiSuccess, handleApiUnhandledError } from '@/lib/api-middleware';
import { createClient } from '@/lib/supabase/server';

interface LocalityInput {
    id: string;
    name: string;
    geo_level: 'state' | 'city' | 'locality';
    parent_city_name?: string | null;
    parent_state_name?: string | null;
}

interface DemographicData {
    populacao_total: number;
    populacao_masculina?: number | null;
    populacao_feminina?: number | null;
    faixas_etarias?: Record<string, number> | null;
    escolaridade?: Record<string, number> | null;
}

interface CotaSuggestion {
    category: string; // 'sexo', 'faixa_etaria', 'escolaridade'
    label: string;
    suggestions: Array<{
        value: string;
        label: string;
        quota_pct?: number;
    }>;
}

type AgeKey = '0_4' | '5_9' | '10_14' | '15_19' | '20_24' | '25_29' | '30_34' | '35_39' | '40_44' | '45_49' | '50_54' | '55_59' | '60_64' | '65_69' | '70_74' | '75_79' | '80_mais' | '90_mais';
type EducationKey = 'sem_instrucao' | 'fundamental_incompleto' | 'fundamental_completo' | 'medio_incompleto' | 'medio_completo' | 'superior_incompleto' | 'superior_completo' | 'pos_graduacao';

/**
 * Mapeia faixas etárias IBGE (por 5 anos) para as faixas do preset
 */
function mapAgeRanges(faixasEtarias: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {
        '16-24': 0,
        '25-34': 0,
        '35-44': 0,
        '45-59': 0,
        '60+': 0,
    };

    if (!faixasEtarias || typeof faixasEtarias !== 'object') {
        return result;
    }

    for (const [key, value] of Object.entries(faixasEtarias)) {
        const numValue = Number(value) || 0;
        if (key === '15_19' || key === '20_24') result['16-24'] += numValue;
        else if (key === '25_29' || key === '30_34') result['25-34'] += numValue;
        else if (key === '35_39' || key === '40_44') result['35-44'] += numValue;
        else if (key === '45_49' || key === '50_54' || key === '55_59') result['45-59'] += numValue;
        else if (key === '60_64' || key === '65_69' || key === '70_74' || key === '75_79' || key === '80_mais' || key === '90_mais') result['60+'] += numValue;
    }

    return result;
}

/**
 * Mapeia escolaridade IBGE para o preset
 */
function mapEducation(escolaridade: Record<string, number>): Record<string, number> {
    const result: Record<string, number> = {
        'sem_instrucao': 0,
        'fund_inc': 0,
        'fund_comp': 0,
        'medio_inc': 0,
        'medio_comp': 0,
        'superior': 0,
    };

    if (!escolaridade || typeof escolaridade !== 'object') {
        return result;
    }

    for (const [key, value] of Object.entries(escolaridade)) {
        const numValue = Number(value) || 0;
        if (key === 'sem_instrucao') result['sem_instrucao'] += numValue;
        else if (key === 'fundamental_incompleto') result['fund_inc'] += numValue;
        else if (key === 'fundamental_completo') result['fund_comp'] += numValue;
        else if (key === 'medio_incompleto') result['medio_inc'] += numValue;
        else if (key === 'medio_completo') result['medio_comp'] += numValue;
        else if (key === 'superior_incompleto' || key === 'superior_completo' || key === 'pos_graduacao') result['superior'] += numValue;
    }

    return result;
}

/**
 * Busca dados demográficos para uma localidade específica
 */
async function getDemographicsForLocality(
    supabase: any,
    locality: LocalityInput,
    state: string,
    city: string,
): Promise<DemographicData | null> {
    try {
        // Se é uma localidade específica (bairro/distrito), buscar do geo_municipios 
        // via geo_dados_demograficos (setor censitário)
        if (locality.geo_level === 'locality') {
            // Tenta buscar municipio_id via nome da cidade
            const { data: municipios } = await supabase
                .from('geo_municipios')
                .select('id_ibge')
                .ilike('nome', `%${city}%`)
                .limit(1);

            if (!municipios || municipios.length === 0) {
                return null;
            }

            const municipioId = municipios[0].id_ibge;

            // Busca dados demográficos municipais
            const { data: demog } = await supabase
                .from('geo_demograficos_municipio')
                .select('populacao_total, populacao_masculina, populacao_feminina, faixas_etarias, escolaridade')
                .eq('municipio_id', municipioId)
                .order('ano_censo', { ascending: false })
                .limit(1);

            if (demog && demog.length > 0) {
                return demog[0];
            }

            return null;
        } else if (locality.geo_level === 'city') {
            // Buscar dados municipais diretamente pela cidade
            const { data: municipios } = await supabase
                .from('geo_municipios')
                .select('id_ibge')
                .ilike('nome', `%${city}%`)
                .limit(1);

            if (!municipios || municipios.length === 0) {
                return null;
            }

            const municipioId = municipios[0].id_ibge;

            // Busca dados demográficos municipais
            const { data: demog } = await supabase
                .from('geo_demograficos_municipio')
                .select('populacao_total, populacao_masculina, populacao_feminina, faixas_etarias, escolaridade')
                .eq('municipio_id', municipioId)
                .order('ano_censo', { ascending: false })
                .limit(1);

            if (demog && demog.length > 0) {
                return demog[0];
            }

            return null;
        }

        return null;
    } catch (error) {
        console.error('Erro ao buscar dados demográficos:', error);
        return null;
    }
}

/**
 * Gera sugestões de cotas a partir dos dados demográficos
 */
function generateSuggestions(demographics: DemographicData[]): CotaSuggestion[] {
    const suggestions: CotaSuggestion[] = [];

    // Agregar dados de todas as localidades
    let totalPopulation = 0;
    let totalMale = 0;
    let totalFemale = 0;
    const allAges: Record<string, number> = {};
    const allEducation: Record<string, number> = {};

    for (const demo of demographics) {
        if (!demo) continue;

        totalPopulation += demo.populacao_total || 0;
        totalMale += demo.populacao_masculina || 0;
        totalFemale += demo.populacao_feminina || 0;

        // Agregar faixas etárias
        if (demo.faixas_etarias && typeof demo.faixas_etarias === 'object') {
            for (const [key, value] of Object.entries(demo.faixas_etarias)) {
                allAges[key] = (allAges[key] || 0) + (Number(value) || 0);
            }
        }

        // Agregar escolaridade
        if (demo.escolaridade && typeof demo.escolaridade === 'object') {
            for (const [key, value] of Object.entries(demo.escolaridade)) {
                allEducation[key] = (allEducation[key] || 0) + (Number(value) || 0);
            }
        }
    }

    // ─── Sexo ───────────────────────────────────────────────
    if (totalPopulation > 0) {
        const malePercent = Math.round((totalMale / totalPopulation) * 100);
        const femalePercent = 100 - malePercent;

        if (totalMale > 0 || totalFemale > 0) {
            suggestions.push({
                category: 'sexo',
                label: 'Sexo',
                suggestions: [
                    { value: 'M', label: 'Masculino', quota_pct: malePercent > 0 ? malePercent : undefined },
                    { value: 'F', label: 'Feminino', quota_pct: femalePercent > 0 ? femalePercent : undefined },
                ].filter(s => s.quota_pct !== undefined),
            });
        }
    }

    // ─── Faixa Etária ───────────────────────────────────────
    const mappedAges = mapAgeRanges(allAges);
    const ageTotal = Object.values(mappedAges).reduce((a, b) => a + b, 0);

    if (ageTotal > 0) {
        const ageSuggestions = [
            { value: '16-24', label: '16 a 24 anos' },
            { value: '25-34', label: '25 a 34 anos' },
            { value: '35-44', label: '35 a 44 anos' },
            { value: '45-59', label: '45 a 59 anos' },
            { value: '60+', label: '60 anos ou mais' },
        ]
            .map(opt => ({
                ...opt,
                quota_pct: mappedAges[opt.value] > 0 ? Math.round((mappedAges[opt.value] / ageTotal) * 100) : undefined,
            }))
            .filter(s => s.quota_pct !== undefined);

        if (ageSuggestions.length > 0) {
            suggestions.push({
                category: 'faixa_etaria',
                label: 'Faixa etária',
                suggestions: ageSuggestions,
            });
        }
    }

    // ─── Escolaridade ───────────────────────────────────────
    const mappedEducation = mapEducation(allEducation);
    const educationTotal = Object.values(mappedEducation).reduce((a, b) => a + b, 0);

    if (educationTotal > 0) {
        const educationSuggestions = [
            { value: 'sem_instrucao', label: 'Sem instrução' },
            { value: 'fund_inc', label: 'Fundamental incompleto' },
            { value: 'fund_comp', label: 'Fundamental completo' },
            { value: 'medio_inc', label: 'Médio incompleto' },
            { value: 'medio_comp', label: 'Médio completo' },
            { value: 'superior', label: 'Superior ou mais' },
        ]
            .map(opt => ({
                ...opt,
                quota_pct: mappedEducation[opt.value] > 0 ? Math.round((mappedEducation[opt.value] / educationTotal) * 100) : undefined,
            }))
            .filter(s => s.quota_pct !== undefined);

        if (educationSuggestions.length > 0) {
            suggestions.push({
                category: 'escolaridade',
                label: 'Escolaridade',
                suggestions: educationSuggestions,
            });
        }
    }

    return suggestions;
}

export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();
        const body = await request.json();
        const { localities } = body;

        if (!Array.isArray(localities) || localities.length === 0) {
            return apiError('Forneça um array de localidades válido.', 400);
        }

        // Buscar dados demográficos para cada localidade
        const demographicsPromises = localities.map((loc: LocalityInput) =>
            getDemographicsForLocality(
                supabase,
                loc,
                loc.parent_state_name || '',
                loc.parent_city_name || loc.name || ''
            )
        );

        const demographics = await Promise.all(demographicsPromises);
        const validDemographics = demographics.filter(d => d !== null);

        if (validDemographics.length === 0) {
            return apiSuccess({
                suggestions: [],
                warning: 'Nenhum dado demográfico encontrado para as localidades selecionadas. Verifique se os dados foram carregados (ETL Demográfico).',
            });
        }

        const suggestions = generateSuggestions(validDemographics);

        return apiSuccess({
            suggestions,
            demographics_count: validDemographics.length,
            message: 'Sugestões de cotas geradas com sucesso.',
        });
    } catch (error) {
        console.error('Erro ao gerar sugestões de estratificação:', error);
        return handleApiUnhandledError(request, error, {
            errorCode: 'STRATIFICATION_SUGGESTION_ERROR',
        });
    }
}
