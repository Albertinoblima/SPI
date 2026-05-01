// Process Media - Edge Function (Image/Audio processing)
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

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const responseId = formData.get('response_id') as string;
        const questionId = formData.get('question_id') as string;

        if (!file || !responseId || !questionId) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Upload to Supabase Storage
        const fileExt = file.name.split('.').pop();
        const filePath = `responses/${responseId}/${questionId}.${fileExt}`;

        const { data, error } = await supabase.storage
            .from('media')
            .upload(filePath, file, {
                contentType: file.type,
                upsert: true,
            });

        if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const { data: urlData } = supabase.storage
            .from('media')
            .getPublicUrl(filePath);

        return new Response(
            JSON.stringify({ url: urlData.publicUrl, path: filePath }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
    } catch (error) {
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});
