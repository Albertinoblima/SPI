/**
 * Regression test for the deprecated admin client.
 *
 * Ensures that any remaining or accidental usage of the old path fails loudly.
 * Part of Etapa 0.2.2 / 0.4 cleanup.
 */
import { createAdminClient } from '../supabase/admin';

describe('Legacy createAdminClient (Fase 0 - Deprecation Guard)', () => {
  it('throws a clear error when called (prevents use of deprecated path)', () => {
    expect(() => createAdminClient()).toThrow(
      /createAdminClient\(\) is deprecated/i
    );
  });
});
