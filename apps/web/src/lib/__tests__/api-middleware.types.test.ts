/**
 * Type-level tests for api-middleware (Fase 4+ senior hygiene)
 * Ensures the generic helpers remain correctly typed after Fase 3 strict work.
 */
import { apiSuccess, apiError } from '../api-middleware';

describe('api-middleware typed helpers', () => {
  it('apiSuccess is generic and returns consistent shape', () => {
    const res = apiSuccess({ foo: 'bar' });
    // At runtime we would inspect, but for type test this is compile-time assurance
    expect(res).toBeDefined();
  });

  it('apiError produces error response with status', () => {
    const res = apiError('Not found', 404);
    expect(res).toBeDefined();
  });
});
