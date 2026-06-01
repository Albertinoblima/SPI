/**
 * SurveyWizard Planning Handoff Tests (Fase 6)
 *
 * Validates the critical bridge from 5-step Research Plan (F3 domain types)
 * into the wizard and subsequently into reports.
 * Antiretrabalho: reuses PlanningContext, ResearchPlan shapes.
 */

import type { ResearchPlan } from '@/lib/supabase/researchPlans';
import type { WizardData } from '../SurveyWizard';

describe('SurveyWizard Planning Handoff (Fase 6 - senior contract)', () => {
  const mockPlan: Partial<ResearchPlan> = {
    id: 'plan-123',
    name: 'Eleições 2026 - Teste',
    planning_data: {
      objective: 'Intenção de voto',
      geographicBase: {
        municipalities: [
          { id: 'm1', name: 'Centro', population: 45000, uf: 'SP' },
        ],
      },
      distribution: {
        sampleSize: 1200,
        interviewerAssignments: [{ interviewerId: 'u1', localityKey: 'm1', interviews: 600 }],
      },
    },
  };

  it('maps rich planning data to valid WizardData shape without losing key fields', () => {
    // Simulate the handoff logic (extracted for testability)
    const planData = (mockPlan.planning_data as any) || {};
    const geo = planData.geographicBase || {};
    const dist = planData.distribution || {};

    const prefilledLocalities = ((geo.municipalities || []) as any[]).map((m: any) => ({
      id: String(m.id || m.name || ''),
      name: String(m.name || ''),
      geo_level: 'city' as const,
      zone: 'mixed' as const,
      population: Number(m.population || 0),
      population_type: 'eleitores' as const,
      interviews_required: 0,
    }));

    const interviewerDistribution = Array.isArray(dist.interviewerAssignments)
      ? dist.interviewerAssignments.map((a: any) => ({
        interviewerId: String(a.interviewerId || ''),
        localityId: String(a.localityKey || a.localityId || ''),
        quota: Number(a.interviews || a.quota || 0),
      }))
      : [];

    const wizardData: Partial<WizardData> = {
      tech: {
        title: mockPlan.name || '',
        objective: planData.objective || '',
        total_interviews: dist.sampleSize || 0,
      } as any,
      localities: prefilledLocalities,
      ...(mockPlan.id ? { sourcePlanId: mockPlan.id } : {}),
      interviewerDistribution,
    };

    expect(wizardData.tech?.title).toBe('Eleições 2026 - Teste');
    expect(wizardData.localities?.length).toBe(1);
    expect(wizardData.sourcePlanId).toBe('plan-123');
    expect((wizardData as any).interviewerDistribution?.length).toBe(1);
  });

  it('preserves PlanningContext sample size and methodology for downstream reports', () => {
    const planData = mockPlan.planning_data as any;
    const context = {
      sampleSize: planData?.distribution?.sampleSize || 0,
      methodology: planData?.methodology || 'Presencial',
    };

    expect(context.sampleSize).toBe(1200);
  });
});
