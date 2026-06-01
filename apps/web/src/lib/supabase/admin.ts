/**
 * @deprecated — LEGACY ONLY. DO NOT USE.
 *
 * All production code has been migrated to:
 *   import { createSupabaseAdminClient } from '@political-research/shared-utils';
 *
 * This file is kept temporarily for any un-migrated scripts or during the final cleanup of Fase 0.
 * It will be **deleted** before or right after Gate 0.
 *
 * If this function is called, it will throw to prevent silent use of the old path.
 */
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
    throw new Error(
        'createAdminClient() is deprecated. Use createSupabaseAdminClient from @political-research/shared-utils instead. ' +
        'This file will be removed soon.'
    );
}
