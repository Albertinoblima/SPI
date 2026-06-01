/**
 * Tests for planning utilities (Fase 4)
 * Covers the typed PlanningData / WizardInitialData bridge cleaned during Fase 3 type safety work.
 */
import { mapPlanningDataToWizardInitialData, type PlanningData } from '../planning';

describe('planning utilities (typed bridge)', () => {
  it('maps PlanningData to WizardInitialData with sensible defaults', () => {
    const input: PlanningData = {
      name: 'Eleitoral 2026',
      objective: 'Medir intenção de voto',
      researchType: 'quantitativa',
      targetAudience: 'Eleitores',
      population: 500000,
      sampleSize: 1200,
      margin: 3,
      confidence: 95,
      localities: [{ id: 'loc1', name: 'Centro', population: 10000 }],
      distribution: [{ localityId: 'loc1', interviews: 300 }],
    };

    const result = mapPlanningDataToWizardInitialData(input);

    expect(result.tech.title).toBe('Eleitoral 2026');
    expect(result.tech.total_interviews).toBe(1200);
    expect(result.tech.margin_of_error).toBe(3);
    expect(result.localities.length).toBe(1);
    expect(result.premises).toEqual([]);
    expect(result.questions).toEqual([]);
  });

  it('handles partial / minimal PlanningData gracefully', () => {
    const minimal: PlanningData = {
      name: 'Minimal',
      objective: '',
      researchType: '',
      targetAudience: '',
    };

    const result = mapPlanningDataToWizardInitialData(minimal);

    expect(result.tech.title).toBe('Minimal');
    expect(result.tech.total_interviews).toBe(0);
    expect(result.tech.margin_of_error).toBe(5); // default
  });
});
