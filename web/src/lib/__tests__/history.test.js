import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addHistory, getHistory, MAX_ENTRIES } from '../history';

describe('history', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getHistory() returns [] when empty', () => {
    expect(getHistory()).toEqual([]);
  });

  it('addHistory + getHistory round-trips', () => {
    const product = {
      article: 'Widget A',
      pvente: '12.50',
      ppro: '8.00',
      ppro_htva: '6.61',
      origine: 'FR',
      p_l: '250g',
      extra_field: 'should be dropped',
    };
    const result = addHistory(product, '89x36');
    expect(result).toHaveLength(1);

    const entry = result[0];
    expect(entry.article).toBe('Widget A');
    expect(entry.pvente).toBe('12.50');
    expect(entry.format).toBe('89x36');
    expect(entry.timestamp).toBeDefined();
    expect(entry.extra_field).toBeUndefined();

    // getHistory returns the same
    expect(getHistory()).toEqual(result);
  });

  it('newest entry is first', () => {
    addHistory({ article: 'First' }, '89x36');
    addHistory({ article: 'Second' }, '89x36');
    const history = getHistory();
    expect(history[0].article).toBe('Second');
    expect(history[1].article).toBe('First');
  });

  it('limits to MAX_ENTRIES (100)', () => {
    expect(MAX_ENTRIES).toBe(100);
    for (let i = 0; i < 105; i++) {
      addHistory({ article: `Item ${i}` }, '89x36');
    }
    const history = getHistory();
    expect(history).toHaveLength(100);
    // Most recent is first
    expect(history[0].article).toBe('Item 104');
  });

  it('each entry has format and timestamp', () => {
    addHistory({ article: 'Test' }, '60x35');
    const entry = getHistory()[0];
    expect(entry.format).toBe('60x35');
    expect(typeof entry.timestamp).toBe('string');
    // fr-BE format: DD/MM/YYYY HH:MM
    expect(entry.timestamp).toMatch(/^\d{2}\/\d{2}\/\d{4}/);
  });

  it('only keeps KEEP_KEYS from product', () => {
    const product = {
      article: 'A',
      pvente: '1',
      ppro: '2',
      ppro_htva: '3',
      origine: 'BE',
      p_l: '100g',
      random: 'nope',
      another: 'nope',
    };
    addHistory(product, '89x36');
    const entry = getHistory()[0];
    expect(Object.keys(entry).sort()).toEqual(
      ['article', 'format', 'origine', 'p_l', 'ppro', 'ppro_htva', 'pvente', 'timestamp'].sort()
    );
  });
});
