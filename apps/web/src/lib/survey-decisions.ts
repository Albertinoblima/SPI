/**
 * survey-decisions.ts
 * Contrato central de decisão por tipo de pesquisa.
 * Toda regra que antes estava espalhada em condicionais nos componentes vem daqui.
 */

import type { SurveyTechData, PopulationType } from '@/components/surveys/Step1TechnicalData';

export type GeoScope = 'national' | 'state' | 'city' | 'specific_public';
export type GeoLevel = 'state' | 'city' | 'locality';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SurveyDecision {
    /** Usa amostragem estatística (fórmula amostral na Etapa 3). */
    samplingEnabled: boolean;
    /** Público-alvo é segmento específico; não usa base eleitoral/censitária. */
    specificAudience: boolean;
    /** Tipo de público-alvo padrão. */
    defaultPopulationType: PopulationType;
    /** Abrangências geográficas permitidas para este tipo de pesquisa. */
    allowedScopes: GeoScope[];
    /** Mensagem contextual para o seletor de abrangência na Etapa 2. */
    scopeHint: string;
    /** Mensagem metodológica exibida no topo da Etapa 3. */
    methodologyHint: string;
    /** Descrição resumida do tipo de pesquisa (exibida como badge/tooltip). */
    typeDescription: string;
}

// ─── Matriz de Decisão ────────────────────────────────────────────────────────

const DECISIONS: Record<string, SurveyDecision> = {
    // ── Quantitativos amostrais ─────────────────────────────────────────────
    eleitoral: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'eleitores',
        allowedScopes: ['national', 'state', 'city'],
        scopeHint: 'Pesquisas eleitorais abrangem Nacional, Estadual ou Municipal.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Intenção de voto e avaliação de candidatos.',
    },
    opiniao_publica: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'eleitores',
        allowedScopes: ['national', 'state', 'city'],
        scopeHint: 'Pesquisas de opinião pública podem cobrir qualquer abrangência geográfica.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Percepção e opiniões sobre temas públicos.',
    },
    satisfacao: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'publico_geral',
        allowedScopes: ['national', 'state', 'city'],
        scopeHint: 'Avaliações de satisfação são normalmente estaduais ou municipais.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Satisfação com serviços, produtos ou atendimento.',
    },
    avaliacao_servicos: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'publico_geral',
        allowedScopes: ['national', 'state', 'city'],
        scopeHint: 'Avaliações de serviços geralmente têm abrangência municipal.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Avaliação de qualidade de serviços públicos ou privados.',
    },
    avaliacao_administrativa: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'publico_geral',
        allowedScopes: ['national', 'state', 'city'],
        scopeHint: 'Avaliações administrativas abrangem o nível do ente avaliado.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Avaliação de gestão e desempenho administrativo.',
    },
    avaliacao_empresarial: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Pesquisas empresariais podem ter abrangência nacional, regional ou de público específico.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Avaliação de desempenho de empresa ou marca.',
    },
    consumo_produtos: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Pesquisas de consumo podem ser aplicadas em mercados específicos ou abrangentes.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Hábitos e padrões de consumo de produtos.',
    },
    otimizacao_produto: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Pesquisas de produto geralmente têm público-alvo delimitado.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Validação e otimização de produtos.',
    },
    recall: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Pesquisas de recall têm público bem definido por produto ou campanha.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Lembrança espontânea e assistida de marcas/produtos.',
    },
    marca: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Pesquisas de marca podem cobrir mercados amplos ou segmentados.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Percepção, recall e posicionamento de marca.',
    },
    criacao_posicionamento_marca: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Selecione o mercado-alvo da marca.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Criação e posicionamento estratégico de marca.',
    },
    mercado_quantitativa: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['national', 'state', 'city'],
        scopeHint: 'Pesquisas de mercado-território cobrem o território comercial alvo.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Estudo quantitativo de mercado em território definido.',
    },
    segmentacao_mercado: {
        samplingEnabled: true,
        specificAudience: true,
        defaultPopulationType: 'segmento_especifico',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Segmentação de mercado geralmente delimita um público específico em área geográfica.',
        methodologyHint: 'Pesquisa quantitativa amostral com público segmentado: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Estudo de segmentação e perfil de mercado.',
    },
    publico_alvo: {
        samplingEnabled: true,
        specificAudience: true,
        defaultPopulationType: 'segmento_especifico',
        allowedScopes: ['national', 'state', 'city', 'specific_public'],
        scopeHint: 'Pesquisas de público-alvo delimitam um segmento específico da população.',
        methodologyHint: 'Pesquisa quantitativa com público-alvo específico: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Estudo estratégico de público-alvo.',
    },
    ponto_investimento: {
        samplingEnabled: true,
        specificAudience: false,
        defaultPopulationType: 'consumidores',
        allowedScopes: ['city', 'specific_public'],
        scopeHint: 'Avaliação de ponto é sempre municipal ou de localidade específica.',
        methodologyHint: 'Pesquisa quantitativa amostral: utilize margem de erro e intervalo de confiança para dimensionar entrevistas.',
        typeDescription: 'Avaliação de viabilidade de ponto de investimento.',
    },
    // ── Censo (não amostral) ────────────────────────────────────────────────
    censo: {
        samplingEnabled: false,
        specificAudience: false,
        defaultPopulationType: 'habitantes',
        allowedScopes: ['national', 'state', 'city'],
        scopeHint: 'Censos cobrem a totalidade do universo pesquisado.',
        methodologyHint: 'Levantamento censitário: cobertura total do universo. A meta de entrevistas por localidade deve ser definida manualmente na Etapa 3.',
        typeDescription: 'Cobertura total do universo pesquisado.',
    },
    // ── Qualitativos ────────────────────────────────────────────────────────
    qualitativa_motivacional: {
        samplingEnabled: false,
        specificAudience: true,
        defaultPopulationType: 'segmento_especifico',
        allowedScopes: ['city', 'specific_public'],
        scopeHint: 'Pesquisas motivacionais são realizadas com grupos específicos em localidades delimitadas.',
        methodologyHint: 'Pesquisa qualitativa: não utiliza margem de erro estatística. Defina metas de participantes por critério técnico.',
        typeDescription: 'Compreensão profunda de motivações e atitudes.',
    },
    qualitativa_grupo_focal: {
        samplingEnabled: false,
        specificAudience: true,
        defaultPopulationType: 'segmento_especifico',
        allowedScopes: ['city', 'specific_public'],
        scopeHint: 'Grupos focais são realizados em localidades específicas com públicos delimitados.',
        methodologyHint: 'Pesquisa qualitativa (grupo focal): não utiliza margem de erro estatística. Defina metas de sessões e participantes por critério técnico.',
        typeDescription: 'Discussão em grupo para exploração de percepções.',
    },
    qualitativa_profundidade: {
        samplingEnabled: false,
        specificAudience: true,
        defaultPopulationType: 'segmento_especifico',
        allowedScopes: ['city', 'specific_public'],
        scopeHint: 'Entrevistas em profundidade são conduzidas com indivíduos específicos em localidades definidas.',
        methodologyHint: 'Pesquisa qualitativa (entrevista em profundidade): não utiliza margem de erro estatística. Defina o número de participantes por critério técnico.',
        typeDescription: 'Entrevistas individuais exploratórias em profundidade.',
    },
};

// ─── Decisão padrão (tipo ainda não selecionado) ──────────────────────────────

const DEFAULT_DECISION: SurveyDecision = {
    samplingEnabled: false,
    specificAudience: false,
    defaultPopulationType: 'eleitores',
    allowedScopes: ['national', 'state', 'city', 'specific_public'],
    scopeHint: 'Selecione o Foco Específico na Etapa 1 para habilitar regras territoriais dinâmicas.',
    methodologyHint: 'Defina o tipo para habilitar recomendações metodológicas e regras automáticas de amostragem.',
    typeDescription: '',
};

// ─── API pública ──────────────────────────────────────────────────────────────

/** Retorna a decisão para um tipo de pesquisa. Nunca lança exceção. */
export function getSurveyDecision(surveyType: string): SurveyDecision {
    return DECISIONS[surveyType] ?? DEFAULT_DECISION;
}

/** Retorna os níveis territoriais permitidos para uma combinação tipo + abrangência. */
export function allowedGeoLevels(
    scope: SurveyTechData['geographic_scope'],
    _surveyType?: string,
): GeoLevel[] {
    if (scope === 'national') return ['state', 'city', 'locality'];
    if (scope === 'state') return ['city', 'locality'];
    if (scope === 'city') return ['locality'];
    if (scope === 'specific_public') return ['locality'];
    return [];
}

/**
 * Verifica se uma lista de localidades é compatível com o tipo de pesquisa
 * e a abrangência geográfica informados.
 * Retorna null se estiver OK, ou mensagem descrevendo o conflito.
 */
export function checkLocalitiesCompatibility(
    localities: Array<{ geo_level: GeoLevel }>,
    scope: SurveyTechData['geographic_scope'],
    surveyType: string,
): string | null {
    if (!scope || !surveyType) return null;
    const decision = getSurveyDecision(surveyType);

    if (!decision.allowedScopes.includes(scope as GeoScope)) {
        return `O Foco Específico "${surveyType}" não é compatível com a abrangência "${scope}". Corrija a abrangência ou o foco.`;
    }

    const allowed = allowedGeoLevels(scope);
    const incompatible = localities.filter(l => !allowed.includes(l.geo_level));
    if (incompatible.length > 0) {
        return `${incompatible.length} localidade(s) possuem nível territorial incompatível com a abrangência atual. Remova-as e recadastre.`;
    }

    return null;
}

/**
 * Retorna localidades "efetivas" — exclui registros que são cobertos
 * por localidades filhas (evita dupla contagem em estatísticas).
 * Fonte única de verdade, usada pela Etapa 2, Etapa 3 e Wizard.
 */
export function getEffectiveLocalities<T extends { geo_level: GeoLevel; name: string; parent_state_name?: string | null; parent_city_name?: string | null }>(
    localities: T[],
): T[] {
    return localities.filter((loc) => {
        if (loc.geo_level === 'state') {
            return !localities.some(
                (child) => child.geo_level !== 'state' && child.parent_state_name === loc.name,
            );
        }
        if (loc.geo_level === 'city') {
            return !localities.some(
                (child) =>
                    child.geo_level === 'locality' &&
                    child.parent_city_name === loc.name &&
                    child.parent_state_name === loc.parent_state_name,
            );
        }
        return true;
    });
}

// ─── Labels reutilizáveis ─────────────────────────────────────────────────────

export const GEO_SCOPE_LABELS: Record<GeoScope, string> = {
    national: 'Nacional',
    state: 'Estadual',
    city: 'Municipal',
    specific_public: 'Público Específico',
};

export const GEO_LEVEL_LABELS: Record<GeoLevel, string> = {
    state: 'Estado',
    city: 'Cidade',
    locality: 'Localidade Específica',
};

export const GEO_LEVEL_ADD_LABELS: Record<GeoLevel, string> = {
    state: 'Adicionar Estado',
    city: 'Adicionar Cidade',
    locality: 'Adicionar Localidade',
};

export const ZONE_LABELS: Record<'urban' | 'rural' | 'mixed', string> = {
    urban: 'Sede / Urbana',
    rural: 'Interior / Rural',
    mixed: 'Misto (Urbana + Rural)',
};

export const GEO_SCOPE_DESCRIPTION: Record<GeoScope, string> = {
    national: 'Pesquisa realizada em todo o território nacional.',
    state: 'Pesquisa delimitada a um único estado.',
    city: 'Pesquisa delimitada a um único município.',
    specific_public: 'Pesquisa focada em um público específico em localidades definidas.',
};
