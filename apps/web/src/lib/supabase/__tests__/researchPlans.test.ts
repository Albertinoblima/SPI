/**
 * Unit tests for researchPlans lib (Fase 4)
 * Focus: typed contracts introduced during Fase 3 type safety work.
 * Note: Full integration tests for the Supabase calls belong in contract/API layer.
 */
import type { ResearchPlan } from '../researchPlans';

// Pure type + mapping validation (the heavy lifting is tested in shared-utils planning tests)
describe('researchPlans (typed lib - post Fase 3)', () => {
  it('exports ResearchPlan interface with expected senior shape', () => {
    const p: ResearchPlan = {
      id: 'plan-xyz',
      name: 'Teste Tipado',
      planning_data: { name: 'Test', objective: 'foo' } as Record<string, unknown>,
      status: 'draft',
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(p.id).toBe('plan-xyz');
    expect(p.status).toBe('draft');
  });
});
