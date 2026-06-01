/**
 * Tests for sampling utilities (Fase 4)
 * Pure mathematical functions used in planning/sample size calculation.
 * These were part of the typed planning bridge work in Fase 3.
 */
import {
  getMethodologyHint,
  getZ,
  calcInterviews,
  localityIsInfinite,
} from '../sampling-utils';

describe('sampling-utils (pure math & hints)', () => {
  describe('getMethodologyHint', () => {
    it('returns census message for censo', () => {
      expect(getMethodologyHint('censo')).toContain('censitário');
    });

    it('returns qualitative messages for qualitative types', () => {
      expect(getMethodologyHint('qualitativa_grupo_focal')).toContain('qualitativa');
      expect(getMethodologyHint('qualitativa_profundidade')).toContain('qualitativa');
    });

    it('returns mixed message for quali_quanti', () => {
      expect(getMethodologyHint('quali_quanti')).toContain('mista');
    });

    it('returns default for unknown types', () => {
      expect(getMethodologyHint('unknown')).toContain('Defina o tipo');
    });
  });

  describe('getZ', () => {
    it('returns correct Z values', () => {
      expect(getZ(90)).toBe(1.645);
      expect(getZ(95)).toBe(1.96);
      expect(getZ(99)).toBe(2.576);
    });
  });

  describe('calcInterviews', () => {
    it('returns 0 for invalid margin', () => {
      expect(calcInterviews(10000, 0, 95)).toBe(0);
      expect(calcInterviews(10000, -1, 95)).toBe(0);
    });

    it('calculates finite population sample correctly', () => {
      const n = calcInterviews(50000, 5, 95);
      expect(n).toBeGreaterThan(300);
      expect(n).toBeLessThan(500);
    });

    it('calculates infinite population sample', () => {
      const n = calcInterviews(1000000, 5, 95, true);
      expect(n).toBeGreaterThan(380);
    });

    it('returns 0 for zero or negative population when not infinite', () => {
      expect(calcInterviews(0, 5, 95)).toBe(0);
      expect(calcInterviews(-100, 5, 95)).toBe(0);
    });
  });

  describe('localityIsInfinite', () => {
    it('force_all always returns true', () => {
      expect(localityIsInfinite({ population: 1000 }, 'force_all', 50000, false)).toBe(true);
    });

    it('auto_threshold uses population vs threshold', () => {
      expect(localityIsInfinite({ population: 60000 }, 'auto_threshold', 50000, false)).toBe(true);
      expect(localityIsInfinite({ population: 40000 }, 'auto_threshold', 50000, false)).toBe(false);
    });

    it('national_only returns the isNational flag', () => {
      expect(localityIsInfinite({ population: 1000 }, 'national_only', 50000, true)).toBe(true);
      expect(localityIsInfinite({ population: 1000 }, 'national_only', 50000, false)).toBe(false);
    });
  });
});
