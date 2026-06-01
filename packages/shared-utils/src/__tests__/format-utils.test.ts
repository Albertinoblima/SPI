import { truncateText, slugify, formatPercentage } from '../format-utils';

describe('format-utils', () => {
  describe('truncateText', () => {
    it('should truncate long text with ellipsis', () => {
      const result = truncateText('This is a very long text for testing', 15);
      expect(result).toBe('This is a ve...');
    });

    it('should not truncate short text', () => {
      const text = 'Short';
      expect(truncateText(text, 20)).toBe(text);
    });
  });

  describe('slugify', () => {
    it('should create clean slugs', () => {
      expect(slugify('Pesquisa Eleitoral 2026!')).toBe('pesquisa-eleitoral-2026');
    });

    it('should handle accents', () => {
      expect(slugify('São Paulo')).toBe('sao-paulo');
    });
  });

  describe('formatPercentage', () => {
    it('should format numbers as percentage', () => {
      expect(formatPercentage(0.756)).toBe('75.6%');
    });
  });
});
