import { createSupabaseAdminClient } from '../supabase/admin-client';

describe('shared Supabase clients', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('createSupabaseAdminClient', () => {
    it('should throw clear error when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
      process.env['NEXT_PUBLIC_SUPABASE_URL'] = 'https://test.supabase.co';

      expect(() => createSupabaseAdminClient()).toThrow(
        'Missing Supabase admin credentials (SUPABASE_SERVICE_ROLE_KEY)'
      );
    });

    it('should throw when NEXT_PUBLIC_SUPABASE_URL is missing', () => {
      delete process.env['NEXT_PUBLIC_SUPABASE_URL'];
      process.env['SUPABASE_SERVICE_ROLE_KEY'] = 'test-key';

      expect(() => createSupabaseAdminClient()).toThrow(
        'Missing Supabase admin credentials (SUPABASE_SERVICE_ROLE_KEY)'
      );
    });
  });
});
