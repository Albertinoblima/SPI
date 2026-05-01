// Shared Validation Logic
import { createResponseSchema, createSurveySchema } from '@political-research/shared-validations';

export function validateResponse(data: unknown) {
    return createResponseSchema.safeParse(data);
}

export function validateSurvey(data: unknown) {
    return createSurveySchema.safeParse(data);
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
    return password.length >= 8;
}
