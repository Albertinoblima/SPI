import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';

const SERVICE_KEY = 'SUPABASE_SERVICE_ROLE_KEY_REMOVED';
const PROJECT_REF = 'icnclqtwtcbrmuxpujwb';

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

const body = JSON.stringify({ query: sql });

const opts = {
    hostname: 'api.supabase.com',
    path: `/v1/projects/${PROJECT_REF}/database/query`,
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
    },
};

const req = https.request(opts, (res) => {
    let data = '';
    res.on('data', (d) => data += d);
    res.on('end', () => {
        console.log('Status:', res.statusCode);
        console.log('Response:', data);
    });
});

req.on('error', (e) => console.error('Error:', e));
req.write(body);
req.end();
