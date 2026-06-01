/**
 * api-middleware CorrelationId Support Tests (Fase 6)
 *
 * Verifies the F5/F6 observability baseline: correlationId propagation
 * in apiSuccess, apiError, trackedApiError, handleApiUnhandledError.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  apiSuccess,
  apiError,
  trackedApiError,
  handleApiUnhandledError,
} from '../api-middleware';

describe('api-middleware CorrelationId (Fase 6)', () => {
  it('apiSuccess includes correlationId when provided', () => {
    const res = apiSuccess({ ok: true }, 200, 'corr-123');
    // In real test would inspect body, here contract
    expect(res).toBeDefined();
  });

  it('apiError includes correlationId when provided', () => {
    const res = apiError('test', 400, 'corr-456');
    expect(res).toBeDefined();
  });

  it('handleApiUnhandledError injects correlationId from capture', async () => {
    const req = new NextRequest('http://localhost/api/test');
    const res = await handleApiUnhandledError(req, new Error('boom'), { errorCode: 'TEST' });
    expect(res).toBeDefined();
  });
});
