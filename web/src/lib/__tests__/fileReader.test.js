import { describe, it, expect } from 'vitest';
import { coerceRow, formatPrice } from '../fileReader.js';

describe('fileReader', () => {
  describe('coerceRow', () => {
    it('parses price strings with euro sign and comma decimal', () => {
      const row = { article: 'Beer', pvente: '5,50\u20AC', ppro: 3.2, ppro_htva: '2.8' };
      const result = coerceRow(row);
      expect(result.pvente).toBe(5.5);
      expect(result.ppro).toBe(3.2);
      expect(result.ppro_htva).toBe(2.8);
    });

    it('returns 0 for non-numeric price values', () => {
      const row = { article: 'Test', pvente: 'N/A', ppro: null };
      const result = coerceRow(row);
      expect(result.pvente).toBe(0);
      expect(result.ppro).toBe(0);
    });

    it('trims string fields', () => {
      const row = { article: '  Beer  ', origine: ' Belgium ', p_l: ' 2,50 ' };
      const result = coerceRow(row);
      expect(result.article).toBe('Beer');
      expect(result.origine).toBe('Belgium');
      expect(result.p_l).toBe('2,50');
    });
  });

  describe('formatPrice', () => {
    it('formats 5.5 as "5,50"', () => {
      expect(formatPrice(5.5)).toBe('5,50');
    });

    it('formats 10 as "10,00"', () => {
      expect(formatPrice(10)).toBe('10,00');
    });

    it('formats 0 as "0,00"', () => {
      expect(formatPrice(0)).toBe('0,00');
    });
  });
});
