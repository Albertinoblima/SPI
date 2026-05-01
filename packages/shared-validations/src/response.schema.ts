// Response Schema - Zod validation
import { z } from 'zod';

export const geoLocationSchema = z.object({
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    accuracy: z.number().positive(),
    timestamp: z.string().datetime(),
});

export const responseAnswerSchema = z.object({
    question_id: z.string().uuid(),
    answer_text: z.string().optional(),
    answer_number: z.number().optional(),
    answer_date: z.string().datetime().optional(),
    answer_json: z.unknown().optional(),
    media_url: z.string().url().optional(),
});

export const createResponseSchema = z.object({
    survey_id: z.string().uuid(),
    respondent_name: z.string().max(200).optional(),
    respondent_phone: z.string().max(20).optional(),
    respondent_document: z.string().max(20).optional(),
    location: geoLocationSchema.optional(),
    address_street: z.string().max(300).optional(),
    address_city: z.string().max(100).optional(),
    address_state: z.string().max(2).optional(),
    address_zip: z.string().max(10).optional(),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime().optional(),
    device_id: z.string().max(100).optional(),
    local_id: z.string().uuid().optional(),
    answers: z.array(responseAnswerSchema).min(1, 'Pelo menos uma resposta é obrigatória'),
});

export type CreateResponseInput = z.infer<typeof createResponseSchema>;
export type GeoLocationInput = z.infer<typeof geoLocationSchema>;
