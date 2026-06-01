/**
 * ReportInsightsService Correlation Support (Fase 6)
 */

import type { InsightRequest } from '../ReportInsightsService';

describe('ReportInsightsService Observability (Fase 6)', () => {
  it('accepts correlationId in request for tracing', () => {
    const req: InsightRequest = {
      surveyId: 's-1',
      questionId: 'q-1',
      distribution: {} as any,
      correlationId: 'insight-corr-xyz',
    };

    expect(req.correlationId).toBe('insight-corr-xyz');
  });
});
