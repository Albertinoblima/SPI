import {
  formatDate,
  formatDateTime,
  isExpired,
  daysBetween,
} from '../date-utils';

describe('date-utils', () => {
  describe('formatDate', () => {
    it('should format a date to pt-BR by default', () => {
      const date = new Date('2026-06-15T12:00:00Z');
      const result = formatDate(date);
      expect(result).toMatch(/15\/06\/2026/);
    });
  });

  describe('isExpired', () => {
    it('should return true for past dates', () => {
      const past = new Date(Date.now() - 1000 * 60 * 60);
      expect(isExpired(past)).toBe(true);
    });

    it('should return false for future dates', () => {
      const future = new Date(Date.now() + 1000 * 60 * 60);
      expect(isExpired(future)).toBe(false);
    });
  });

  describe('daysBetween', () => {
    it('should calculate correct number of days', () => {
      const start = '2026-06-01';
      const end = '2026-06-10';
      expect(daysBetween(start, end)).toBe(9);
    });
  });
});
