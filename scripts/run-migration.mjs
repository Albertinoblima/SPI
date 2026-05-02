import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY_REMOVED';
const SUPABASE_URL = 'https://icnclqtwtcbrmuxpujwb.supabase.co';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// Primeiro criar a função de execução SQL
const createFn = `
CREATE OR REPLACE FUNCTION public.run_migration(sql_text text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE sql_text;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION public.run_migration(text) TO service_role;
`;

// O Supabase JS client não consegue executar DDL direto via .from()
// Mas podemos usar a REST API com o endpoint correto de rpc
// Vamos tentar via fetch diretamente

const sql = `ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS cnpj VARCHAR(20),
  ADD COLUMN IF NOT EXISTS phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS website VARCHAR(500),
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS address_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS address_complement VARCHAR(100),
  ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100),
  ADD COLUMN IF NOT EXISTS city VARCHAR(100),
  ADD COLUMN IF NOT EXISTS state VARCHAR(2),
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(10),
  ADD COLUMN IF NOT EXISTS responsavel_tecnico VARCHAR(255)`;

// Tenta via rpc se a função run_migration existir
const { data, error } = await supabase.rpc('run_migration', { sql_text: sql });
console.log('RPC result:', JSON.stringify({ data, error }));
