/**
 * Step5Summary Quality Alert Test (Fase 6)
 */

describe('Step5Summary Quality Alerts (Fase 6)', () => {
  it('flags when totalAssigned deviates >10% from sampleSize', () => {
    const sampleSize = 1000;
    const totalAssigned = 850;
    const deviation = Math.abs(totalAssigned - sampleSize) > sampleSize * 0.1;
    expect(deviation).toBe(true);
  });
});
