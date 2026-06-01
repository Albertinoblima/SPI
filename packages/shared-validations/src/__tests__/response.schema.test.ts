import {
  createResponseSchema,
  responseAnswerSchema,
} from '../response.schema';

describe('response.schema', () => {
  describe('responseAnswerSchema', () => {
    it('should accept answer with text', () => {
      const answer = {
        question_id: '123e4567-e89b-12d3-a456-426614174000',
        answer_text: 'Sim',
      };

      const result = responseAnswerSchema.safeParse(answer);
      expect(result.success).toBe(true);
    });

    it('should require question_id as UUID', () => {
      const invalid = {
        question_id: 'not-a-uuid',
        answer_text: 'Test',
      };

      const result = responseAnswerSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('createResponseSchema', () => {
    it('should validate a minimal valid response payload', () => {
      const payload = {
        survey_id: '123e4567-e89b-12d3-a456-426614174000',
        started_at: '2026-06-01T10:00:00Z',
        answers: [
          {
            question_id: '123e4567-e89b-12d3-a456-426614174001',
            answer_text: 'Resposta 1',
          },
        ],
      };

      const result = createResponseSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should require at least one answer', () => {
      const payload = {
        survey_id: '123e4567-e89b-12d3-a456-426614174000',
        started_at: '2026-06-01T10:00:00Z',
        answers: [],
      };

      const result = createResponseSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });
});
