import { describe, it, expect } from 'vitest';
import { cleanArticle } from '../textCleaner.js';

describe('cleanArticle', () => {
  it('returns empty string for empty input', () => {
    expect(cleanArticle('')).toBe('');
  });

  it('returns empty string for null input', () => {
    expect(cleanArticle(null)).toBe('');
  });

  it('collapses multiple spaces', () => {
    expect(cleanArticle('hello   world')).toBe('hello world');
  });

  it('inserts space at letter-digit boundary', () => {
    expect(cleanArticle('bouteille1x')).toBe('bouteille 1x');
  });

  it('corrects redbull', () => {
    expect(cleanArticle('redbull 250ml')).toBe('Red Bull 250ml');
  });

  it('corrects "red bul"', () => {
    expect(cleanArticle('red bul canette')).toBe('Red Bull canette');
  });

  it('corrects cocacola', () => {
    expect(cleanArticle('cocacola 1L')).toBe('Coca-Cola 1L');
  });

  it('corrects heiniken', () => {
    expect(cleanArticle('heiniken 33cl')).toBe('Heineken 33cl');
  });

  it('corrects jupiller', () => {
    expect(cleanArticle('jupiller 50cl')).toBe('Jupiler 50cl');
  });

  it('does not change already correct brand names', () => {
    expect(cleanArticle('Red Bull 250ml')).toBe('Red Bull 250ml');
  });

  it('handles uppercase misspellings (case-insensitive)', () => {
    expect(cleanArticle('REDBULL 250ML')).toBe('Red Bull 250ML');
  });

  it('trims whitespace and inserts space at letter-digit boundary', () => {
    expect(cleanArticle('  redbull250ml  ')).toBe('Red Bull 250ml');
  });
});
