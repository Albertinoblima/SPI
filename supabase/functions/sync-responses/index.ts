// Batch Response Sync - Edge Function
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

interface SyncPayload {
    responses: Array<{
        id: string;
        survey_id: string;
        respondent_name?: string;
        respondent_phone?: string;
        respondent_document?: string;
        latitude?: number;
        longitude?: number;
        location_accuracy?: number;
        address_street?: string;
        address_city?: string;
        address_state?: string;
        address_zip?: string;
        started_at: string;
        completed_at?: string;
        device_id?: string;
        local_id: string;
        sync_version: number;
        answers: Array<{
            question_id: string;
            answer_text?: string;
            answer_number?: number;
            answer_date?: string;
            answer_json?: unknown;
            media_url?: string;
        }>;
    }>;
}

serve(async (req: Request) => {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser(
            authHeader.replace('Bearer ', '')
        );

        if (authError || !user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const payload: SyncPayload = await req.json();
        const results = { synced: 0, failed: 0, errors: [] as string[] };

        for (const response of payload.responses) {
            const { answers, ...responseData } = response;
            const { data: upserted, error } = await supabase.from('responses').upsert({
                ...responseData,
                interviewer_id: user.id,
                sync_status: 'synced',
            }, {
                onConflict: 'local_id',
            }).select('id').single();

            if (!error && upserted && answers.length > 0) {
                await supabase.from('response_answers').upsert(
                    answers.map(a => ({ ...a, response_id: upserted.id })),
                    { onConflict: 'response_id,question_id' },
                );
            }

            if (error) {
                results.failed++;
                results.errors.push(`${response.local_id}: ${error.message}`);
            } else {
                results.synced++;

                // Log sync
                await supabase.from('sync_log').insert({
                    user_id: user.id,
                    tenant_id: response.survey_id, // Will be resolved via FK
                    action: 'push',
                    entity_type: 'response',
                    entity_id: response.id,
                    status: 'success',
                });
            }
        }

        return new Response(JSON.stringify(results), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
