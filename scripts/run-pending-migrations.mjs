// Script para aplicar migrações pendentes no Supabase remoto via service_role
// Executa com: node scripts/run-pending-migrations.mjs

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://icnclqtwtcbrmuxpujwb.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
    console.error('Defina SUPABASE_SERVICE_ROLE_KEY no ambiente ou no script.');
    process.exit(1);
}

// Usa a conexão direta via pg para poder executar DDL
// Se não tiver pg instalado, usa fetch para a API de SQL do Supabase
const sql09 = readFileSync(new URL('../supabase/migrations/20260509_survey_technical_data_localities_premises.sql', import.meta.url), 'utf8');
const sql10 = readFileSync(new URL('../supabase/migrations/20260510_survey_registration_and_team_roles_update.sql', import.meta.url), 'utf8');
const sql14 = readFileSync(new URL('../supabase/migrations/20260514_publico_alvo_estratificacao_amostra.sql', import.meta.url), 'utf8');

const allSql = sql09 + '\n' + sql10 + '\n' + sql14;

// Tenta via fetch para a Supabase DB API (precisa de PAT, não service key)
// Alternativa: use a DB connection string diretamente
console.log('SQL a executar:');
console.log(allSql.substring(0, 200) + '...');
console.log('\nPara aplicar, cole o SQL acima no SQL Editor do Supabase Dashboard:');
console.log('https://supabase.com/dashboard/project/icnclqtwtcbrmuxpujwb/sql');
