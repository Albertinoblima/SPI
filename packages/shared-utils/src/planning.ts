/**
 * Interface PlanningData
 * Representa a estrutura do campo planning_data salvo em research_plans.
 * Deve refletir todos os campos relevantes para integração futura com o wizard de criação de pesquisa.
 *
 * ATENÇÃO: Atualize este tipo sempre que a estrutura do planejamento evoluir.
 */
export interface PlanningData {
    name: string;
    objective: string;
    researchType: string;
    targetAudience: string;
    // Campos de base geográfica
    localities?: Array<{
        id: string;
        name: string;
        population?: number;
        zone?: 'urban' | 'rural' | 'mixed';
        geo_level?: string;
        [key: string]: unknown;
    }>;
    // Parâmetros amostrais
    population?: number;
    margin?: number;
    confidence?: number;
    sampleSize?: number;
    // Distribuição/cotas
    distribution?: Array<{
        localityId: string;
        interviews: number;
    }>;
    // Outros campos relevantes
    methodology?: string;
    quotas?: Record<string, unknown>;
    [key: string]: unknown;
}

/**
 * Interface WizardInitialData
 * Representa o estado inicial do wizard de criação de pesquisa.
 * Deve ser compatível com o tipo WizardData usado no wizard.
 *
 * ATENÇÃO: Atualize este tipo conforme evolução do wizard.
 */
export interface WizardInitialData {
    tech: {
        title: string;
        description: string;
        research_category: string;
        survey_type: string;
        margin_of_error: number;
        confidence_interval: number;
        total_interviews: number;
        population_size: number | null;
        deff: number;
        p_proportion: number;
        stats_mode: string;
        infinite_population_mode: string;
        infinite_population_threshold: number;
        population_type: string;
        objective: string;
        methodology: string;
        target_audience: string;
        // ...outros campos técnicos
        [key: string]: unknown;
    };
    localities: Array<Record<string, unknown>>;
    premises: Array<Record<string, unknown>>;
    questions: Array<Record<string, unknown>>;
}

/**
 * Função utilitária para mapear PlanningData em WizardInitialData.
 * Permite pré-preencher o wizard de criação de pesquisa a partir de um planejamento salvo.
 *
 * - Campos não existentes em PlanningData são preenchidos com valores padrão do wizard.
 * - Campos extras em PlanningData são ignorados.
 * - ATENÇÃO: Atualize este mapeamento conforme evolução dos tipos.
 */


export function mapPlanningDataToWizardInitialData(planningData: PlanningData): WizardInitialData {
    return {
        tech: {
            title: planningData.name || '',
            description: planningData.objective || '',
            research_category: '', // Não existe em PlanningData, definir padrão
            survey_type: planningData.researchType || '',
            margin_of_error: planningData.margin ?? 5,
            confidence_interval: planningData.confidence ?? 95,
            total_interviews: planningData.sampleSize ?? 0,
            population_size: planningData.population ?? null,
            deff: 1.0,
            p_proportion: 0.5,
            stats_mode: 'auto',
            infinite_population_mode: 'national_only',
            infinite_population_threshold: 50000,
            population_type: 'eleitores',
            objective: planningData.objective || '',
            methodology: planningData.methodology || '',
            target_audience: planningData.targetAudience || '',
            // ...outros campos técnicos default
        },
        localities: planningData.localities ?? [],
        premises: [], // Não existe em PlanningData
        questions: [], // Não existe em PlanningData
    };
}
