import { describe, it, expect } from 'vitest';
import { autoMap, missingRequired, applyMapping, SYNONYMS, REQUIRED } from '../columnMapper';

describe('columnMapper', () => {
  describe('SYNONYMS & REQUIRED', () => {
    it('exports 9 canonical fields in SYNONYMS', () => {
      expect(Object.keys(SYNONYMS)).toHaveLength(9);
    });

    it('REQUIRED contains article, pvente, ppro, ppro_htva', () => {
      expect(REQUIRED).toEqual(['article', 'pvente', 'ppro', 'ppro_htva']);
    });
  });

  describe('autoMap', () => {
    it('maps exact canonical names', () => {
      const mapping = autoMap(['article', 'pvente', 'ppro', 'ppro_htva', 'origine']);
      expect(mapping).toEqual({
        article: 'article',
        pvente: 'pvente',
        ppro: 'ppro',
        ppro_htva: 'ppro_htva',
        origine: 'origine',
        p_l: null,
        pa_htva: null,
        taux_tva: null,
        ean: null,
      });
    });

    it('maps synonym headers (case-insensitive, substring)', () => {
      const mapping = autoMap(['Nom', 'Prix de vente', 'Pro TTC', 'PPHT', 'Pays']);
      expect(mapping).toEqual({
        article: 'Nom',
        pvente: 'Prix de vente',
        ppro: 'Pro TTC',
        ppro_htva: 'PPHT',
        origine: 'Pays',
        p_l: null,
        pa_htva: null,
        taux_tva: null,
        ean: null,
      });
    });

    it('fuzzy-maps close misspellings', () => {
      const mapping = autoMap(['artcle', 'pvnte', 'ppro', 'ppro_htva']);
      expect(mapping.article).toBe('artcle');
      expect(mapping.ppro).toBe('ppro');
      expect(mapping.ppro_htva).toBe('ppro_htva');
    });

    it('leaves unmapped fields as null', () => {
      const mapping = autoMap(['article', 'pvente']);
      expect(mapping.ppro).toBeNull();
      expect(mapping.ppro_htva).toBeNull();
    });
  });

  describe('missingRequired', () => {
    it('returns missing required fields', () => {
      const result = missingRequired({
        article: 'A',
        pvente: 'B',
        ppro: null,
        ppro_htva: null,
      });
      expect(result).toEqual(['ppro', 'ppro_htva']);
    });

    it('returns empty array when all required fields are mapped', () => {
      const result = missingRequired({
        article: 'A',
        pvente: 'B',
        ppro: 'C',
        ppro_htva: 'D',
      });
      expect(result).toEqual([]);
    });
  });

  describe('applyMapping', () => {
    it('renames raw keys to canonical names, passes through unmapped', () => {
      const mapping = { article: 'Nom', pvente: 'Prix' };
      const row = { Nom: 'Beer', Prix: 5.5, Other: 'x' };
      const result = applyMapping(mapping, row);
      expect(result).toEqual({ article: 'Beer', pvente: 5.5, Other: 'x' });
    });
  });
});
