// Survey Schema - Zod validation
import { z } from 'zod';

export const surveyStatusSchema = z.enum(['draft', 'active', 'paused', 'closed']);

export const createSurveySchema = z.object({
    title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(200),
    description: z.string().max(1000).optional(),
    start_date: z.string().datetime().optional(),
    end_date: z.string().datetime().optional(),
    requires_geolocation: z.boolean().optional(),
    requires_photo: z.boolean().optional(),
    requires_signature: z.boolean().optional(),
    allow_offline: z.boolean().optional(),
});

export const updateSurveySchema = createSurveySchema.partial().extend({
    status: surveyStatusSchema.optional(),
});

export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type UpdateSurveyInput = z.infer<typeof updateSurveySchema>;
