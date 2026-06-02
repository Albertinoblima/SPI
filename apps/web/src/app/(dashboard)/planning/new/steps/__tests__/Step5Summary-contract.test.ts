/**
 * Step5Summary Contract Test (Fase 6)
 */

import type { PlanningData } from '../Step5Summary';

describe('Step5Summary PlanningData Contract (Fase 6)', () => {
  it('accepts the expected shape from upstream planning steps', () => {
    const data: PlanningData = {
      sampleSize: 1500,
      name: 'Test Plan',
      objective: 'Test',
      researchType: 'eleitoral',
      targetAudience: 'Eleitores',
      geographicBase: {
        municipalities: [{ name: 'Centro', population: 80000 }],
      },
      distribution: {
        sampleSize: 1500,
        quotas: [{ name: 'Centro', population: 80000, interviews: 400 }],
      },
    };

    expect(data.sampleSize).toBe(1500);
    expect(data.name).toBe('Test Plan');
    expect(data.distribution?.quotas?.length).toBe(1);
  });

  it('supports full shape used in Step5Summary UI', () => {
    const full: PlanningData = {
      name: 'Plano Eleitoral 2026',
      objective: 'Intenção de voto',
      researchType: 'eleitoral',
      targetAudience: 'Eleitores',
      sampleSize: 2000,
      geographicBase: { scope: 'capital' },
      distribution: { sampleSize: 2000 },
    };
    expect(full.name).toBeDefined();
    expect(full.objective).toBeDefined();
  });
});
