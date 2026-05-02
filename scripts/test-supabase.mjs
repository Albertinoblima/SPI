import { createClient } from '../node_modules/@supabase/supabase-js/dist/index.mjs';
const supabase = createClient('https://icnclqtwtcbrmuxpujwb.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY_REMOVED');
const { data, error } = await supabase.from('tenants').select('id').limit(1);
console.log(JSON.stringify({ data, error }));
