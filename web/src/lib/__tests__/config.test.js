import { describe, it, expect, beforeEach } from 'vitest';
import { getConfig, setConfig, getLabelSizeInfo, LABEL_SIZES } from '../config';

describe('config', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getConfig("label_size") returns "89x36" by default', () => {
    expect(getConfig('label_size')).toBe('89x36');
  });

  it('getConfig("printer_url") returns "" by default', () => {
    expect(getConfig('printer_url')).toBe('');
  });

  it('getConfig("last_mapping") returns null by default', () => {
    expect(getConfig('last_mapping')).toBeNull();
  });

  it('getConfig("selected_printer") returns "" by default', () => {
    expect(getConfig('selected_printer')).toBe('');
  });

  it('setConfig then getConfig round-trips a string', () => {
    setConfig('printer_url', 'http://localhost:9100');
    expect(getConfig('printer_url')).toBe('http://localhost:9100');
  });

  it('setConfig then getConfig round-trips an object', () => {
    const mapping = { col_a: 'article', col_b: 'prix' };
    setConfig('last_mapping', mapping);
    expect(getConfig('last_mapping')).toEqual(mapping);
  });

  it('persists to localStorage with gfp_ prefix', () => {
    setConfig('label_size', '60x35');
    const raw = localStorage.getItem('gfp_label_size');
    expect(raw).toBe(JSON.stringify('60x35'));
  });

  it('getLabelSizeInfo() returns info for current label_size', () => {
    const info = getLabelSizeInfo();
    expect(info).toEqual({
      width_mm: 89,
      height_mm: 36,
      label: '89mm × 36mm Dymo (défaut)',
    });
  });

  it('getLabelSizeInfo() reflects changed label_size', () => {
    setConfig('label_size', '50x30');
    const info = getLabelSizeInfo();
    expect(info.width_mm).toBe(50);
    expect(info.height_mm).toBe(30);
  });

  it('LABEL_SIZES has all expected keys', () => {
    expect(Object.keys(LABEL_SIZES)).toEqual([
      '89x36', '60x35', '50x30', '100x50', '75x50',
    ]);
  });
});
