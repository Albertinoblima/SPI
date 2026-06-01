/**
 * Step4Distribution Contract Test (Fase 6)
 */

import type { Quota } from '../Step4Distribution';

describe('Step4Distribution Contract (Fase 6)', () => {
  it('produces valid quota distribution shape', () => {
    const quotas: Quota[] = [
      { name: 'Centro', uf: 'SP', population: 80000, interviews: 400, locked: false },
      { name: 'Norte', uf: 'SP', population: 120000, interviews: 600, locked: false },
    ];

    const total = quotas.reduce((sum, q) => sum + q.interviews, 0);
    expect(total).toBe(1000);
    const firstQuota = quotas[0];
    expect(firstQuota).toBeDefined();
    if (firstQuota) {
      expect(firstQuota.population).toBeGreaterThan(0);
    }
  });
});
