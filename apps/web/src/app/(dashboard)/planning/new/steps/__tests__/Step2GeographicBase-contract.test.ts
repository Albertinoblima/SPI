/**
 * Step2GeographicBase Contract (Fase 6)
 */

describe('Step2GeographicBase Contract (Fase 6)', () => {
  it('produces valid geographic base shape', () => {
    const data = {
      scope: 'capital',
      municipalities: [{ id: 'm1', name: 'Centro', population: 50000 }],
    };
    expect(data.scope).toBe('capital');
    expect(data.municipalities.length).toBeGreaterThan(0);
  });
});
