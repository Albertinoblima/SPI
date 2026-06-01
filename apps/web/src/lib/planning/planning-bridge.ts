import type { WizardData } from '@/components/surveys/SurveyWizard';

type PlanningPayload = {
    name?: string;
    sampleSize?: number;
    geographicBase?: {
        municipalities?: Array<{
            id?: string | number;
            ibge_id?: number;
            name?: string;
            population?: number;
        }>;
    };
};

export function mapPlanningDataToWizardInitialData(payload: PlanningPayload): Partial<WizardData> {
    const municipalities = payload.geographicBase?.municipalities || [];

    return {
        tech: {
            title: payload.name || 'Nova Pesquisa',
            total_interviews: payload.sampleSize || 0,
        } as WizardData['tech'],
        localities: municipalities.map((municipality) => ({
            id: String(municipality.id || municipality.ibge_id || municipality.name || ''),
            name: municipality.name || 'Localidade',
            geo_level: 'city',
            zone: 'mixed',
            population: municipality.population || 0,
            population_type: 'eleitores',
            interviews_required: 0,
        })),
    };
}
