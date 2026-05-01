// Supabase Admin Client (service role) - SERVER SIDE ONLY
// Bypasses RLS. Never expose to the client.
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
        throw new Error('Missing Supabase admin credentials');
    }

    return createClient(url, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
}
