/**
 * Testes para getMobileAuthContext
 *
 * Fase 0.2.2 - Testes iniciais do caminho crítico de autenticação mobile.
 *
 * Foco atual: Early returns (sem header, header mal formado).
 * Estes são estáveis e não requerem mocking pesado.
 *
 * Testes de sucesso (JWT mobile + validação de tenant + fallback Supabase)
 * serão adicionados em iterações seguintes da 0.2.2, com melhor estratégia de
 * mocking do createSupabaseAdminClient centralizado.
 */

import { getMobileAuthContext } from '../mobile/auth';
import type { NextRequest } from 'next/server';

const createMockRequest = (authHeader?: string): NextRequest => ({
  headers: {
    get: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader : null),
  },
} as unknown as NextRequest);

describe('getMobileAuthContext - Critical Mobile Auth Path (Fase 0.2.2)', () => {
  it('returns null when no Authorization header is present', async () => {
    const result = await getMobileAuthContext(createMockRequest());
    expect(result).toBeNull();
  });

  it('returns null when Authorization header does not use Bearer scheme', async () => {
    const result = await getMobileAuthContext(createMockRequest('Basic abc123'));
    expect(result).toBeNull();
  });

  it('returns null when Bearer token is empty', async () => {
    const result = await getMobileAuthContext(createMockRequest('Bearer '));
    expect(result).toBeNull();
  });
});
