// Seed Database Script
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seed() {
    console.log('🌱 Seeding database...');

    // Create tenant
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .upsert({
            name: 'Partido Exemplo',
            slug: 'partido-exemplo',
            is_active: true,
        })
        .select()
        .single();

    if (tenantError) {
        console.error('Failed to create tenant:', tenantError);
        return;
    }

    console.log('✅ Tenant created:', tenant.name);

    // Create a test survey
    // Note: requires a valid user to be created first via Supabase Auth

    console.log('✅ Seed completed!');
    console.log('');
    console.log('Next: Create a user via Supabase Auth, then create surveys.');
}

seed().catch(console.error);
