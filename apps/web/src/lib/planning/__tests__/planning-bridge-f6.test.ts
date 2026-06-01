/**
 * Planning Bridge Contract Tests (Fase 6)
 *
 * Ensures the handoff from 5-step Research Plan to SurveyWizard (and subsequently reports)
 * remains type-safe and correct after strict mode + domain types work.
 */

import type { WizardData } from '@/components/surveys/SurveyWizard';
import { mapPlanningDataToWizardInitialData } from '../planning-bridge'; // assume or create thin bridge if not present; fallback to direct shape check

describe('Planning to Wizard Handoff (Fase 6 - antiretrabalho on F3)', () => {
  it('produces valid WizardData shape from planning payload', () => {
    const planPayload = {
      name: 'Eleições 2026 - Capital',
      objective: 'Intenção de voto',
      sampleSize: 1200,
      geographicBase: {
        municipalities: [{ id: 'm1', name: 'Centro', population: 50000 }],
      },
      distribution: { sampleSize: 1200, quotas: [] },
    };

    const wizardData: Partial<WizardData> = mapPlanningDataToWizardInitialData(planPayload);

    expect(wizardData.tech?.title).toBe('Eleições 2026 - Capital');
    expect(wizardData.localities?.length).toBe(1);
  });
});
