import { describe, it, expect } from 'vitest';
import { generateLabel, generateA4, mergePdfs } from '../pdfGenerator.js';

const SAMPLE_PRODUCT = {
  article: 'Red Bull 250ml',
  pvente: 2.5,
  ppro: 1.8,
  ppro_htva: 1.5,
  origine: 'Austria',
  p_l: '10,00',
};

describe('pdfGenerator', () => {
  it('generateLabel returns Uint8Array with PDF header', async () => {
    const bytes = await generateLabel(SAMPLE_PRODUCT);
    expect(bytes).toBeInstanceOf(Uint8Array);
    // PDF header: %PDF
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    expect(header).toBe('%PDF');
  });

  it('generateA4 returns Uint8Array with PDF header', async () => {
    const bytes = await generateA4(SAMPLE_PRODUCT);
    expect(bytes).toBeInstanceOf(Uint8Array);
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    expect(header).toBe('%PDF');
  });

  it('generateLabel with custom size works', async () => {
    const bytes = await generateLabel(SAMPLE_PRODUCT, { width_mm: 62, height_mm: 29 });
    expect(bytes).toBeInstanceOf(Uint8Array);
    const header = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    expect(header).toBe('%PDF');
  });

  it('mergePdfs merges two PDFs', async () => {
    const pdf1 = await generateLabel(SAMPLE_PRODUCT);
    const pdf2 = await generateLabel(SAMPLE_PRODUCT);
    const merged = await mergePdfs([pdf1, pdf2]);
    expect(merged).toBeInstanceOf(Uint8Array);
    const header = String.fromCharCode(merged[0], merged[1], merged[2], merged[3]);
    expect(header).toBe('%PDF');
    // Merged PDF should be larger than either individual
    expect(merged.length).toBeGreaterThan(pdf1.length);
  });
});
