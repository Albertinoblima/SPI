import {
  createSurveySchema,
  updateSurveySchema,
  surveyStatusSchema,
} from '../survey.schema';

describe('survey.schema', () => {
  describe('createSurveySchema', () => {
    it('should validate a valid survey creation payload', () => {
      const validInput = {
        title: 'Pesquisa Eleitoral 2026',
        description: 'Levantamento de intenção de voto',
        start_date: '2026-07-01T00:00:00Z',
        requires_geolocation: true,
        allow_offline: true,
      };

      const result = createSurveySchema.safeParse(validInput);
      expect(result.success).toBe(true);
    });

    it('should reject title shorter than 3 characters', () => {
      const invalidInput = {
        title: 'AB',
      };

      const result = createSurveySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should reject title longer than 200 characters', () => {
      const invalidInput = {
        title: 'A'.repeat(201),
      };

      const result = createSurveySchema.safeParse(invalidInput);
      expect(result.success).toBe(false);
    });

    it('should make description optional', () => {
      const input = { title: 'Pesquisa válida' };
      const result = createSurveySchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });

  describe('updateSurveySchema', () => {
    it('should allow partial updates', () => {
      const partialUpdate = {
        status: 'active',
      };

      const result = updateSurveySchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it('should validate status when provided', () => {
      const invalidStatus = {
        status: 'invalid_status',
      };

      const result = updateSurveySchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });
  });

  describe('surveyStatusSchema', () => {
    it.each(['draft', 'active', 'paused', 'closed'])(
      'should accept valid status: %s',
      (status) => {
        const result = surveyStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }
    );

    it('should reject invalid status', () => {
      const result = surveyStatusSchema.safeParse('archived');
      expect(result.success).toBe(false);
    });
  });
});
