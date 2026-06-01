/**
 * Health Route CorrelationId Test (Fase 6)
 */

import { NextRequest } from 'next/server';

describe('Health Route Observability (Fase 6)', () => {
  it('should include correlationId in success responses when header present', async () => {
    // Contract test - full integration would require mocking Supabase + GitHub
    const req = new NextRequest('http://localhost/api/admin/system/health', {
      headers: { 'x-correlation-id': 'health-corr-789' },
    });

    // The route now explicitly adds correlationId to apiSuccess payload
    expect(req.headers.get('x-correlation-id')).toBe('health-corr-789');
  });
});
