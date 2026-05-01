// Generate Analytics - Edge Function
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.0';

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

        const { survey_id } = await req.json();

        if (!survey_id) {
            return new Response(
                JSON.stringify({ error: 'survey_id is required' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Fetch responses for the survey
        const { data: responses, error } = await supabase
            .from('responses')
            .select('answers, geolocation_json, completed_at')
            .eq('survey_id', survey_id)
            .eq('sync_status', 'synced');

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Generate basic analytics
        const analytics = {
            total_responses: responses?.length ?? 0,
            completion_rate: 1.0,
            average_duration_seconds: 0,
            responses_by_day: {} as Record<string, number>,
            geolocation_points: [] as Array<{ lat: number; lng: number }>,
        };

        for (const response of responses ?? []) {
            // Count by day
            const day = response.completed_at?.split('T')[0];
            if (day) {
                analytics.responses_by_day[day] = (analytics.responses_by_day[day] ?? 0) + 1;
            }

            // Collect geolocation points
            if (response.geolocation_json) {
                analytics.geolocation_points.push({
                    lat: response.geolocation_json.latitude,
                    lng: response.geolocation_json.longitude,
                });
            }
        }

        return new Response(JSON.stringify(analytics), {
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
