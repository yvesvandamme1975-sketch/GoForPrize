/**
 * File reader: parses Excel/CSV files via SheetJS, auto-maps columns,
 * and coerces row types.
 *
 * Ported from Python file_reader.py
 */

import * as XLSX from 'xlsx';
import { autoMap, applyMapping } from './columnMapper';

const PRICE_FIELDS = ['pvente', 'ppro', 'ppro_htva', 'pa_htva'];
const STRING_FIELDS = ['article', 'origine', 'p_l'];

/**
 * Parse a price string to float.
 * Strips currency symbols, replaces comma decimal separator, handles NaN.
 */
function parsePrice(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return isNaN(value) ? 0 : value;
  const cleaned = String(value).replace(/[€$\s]/g, '').replace(',', '.').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Coerce row field types:
 * - Price fields -> float (strip currency, comma -> dot)
 * - String fields -> trimmed
 */
export function coerceRow(row) {
  const result = { ...row };
  for (const field of PRICE_FIELDS) {
    if (field in result) {
      result[field] = parsePrice(result[field]);
    }
  }
  for (const field of STRING_FIELDS) {
    if (field in result && result[field] != null) {
      result[field] = String(result[field]).trim();
    }
  }
  return result;
}

/**
 * Format a numeric price to French decimal notation "X,XX".
 * @param {number} value
 * @returns {string}
 */
export function formatPrice(value) {
  const num = typeof value === 'number' ? value : parseFloat(value) || 0;
  return num.toFixed(2).replace('.', ',');
}

/**
 * Parse an uploaded File (xlsx, xls, csv) and return structured data.
 *
 * @param {File} file - Browser File object
 * @param {object} [mappingOverride] - Optional column mapping override
 * @returns {Promise<{headers: string[], rows: object[], mapping: object}>}
 */
export async function parseFile(file, mappingOverride) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  if (rawData.length === 0) {
    return { headers: [], rows: [], mapping: {} };
  }

  const headers = Object.keys(rawData[0]);
  const mapping = mappingOverride || autoMap(headers);

  const rows = rawData.map((rawRow) => {
    const mapped = applyMapping(mapping, rawRow);
    return coerceRow(mapped);
  });

  return { headers, rows, mapping };
}
