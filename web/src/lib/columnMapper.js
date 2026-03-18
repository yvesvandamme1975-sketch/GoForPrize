import Fuse from 'fuse.js';

export const SYNONYMS = {
  article:   ['article', 'nom', 'libellé', 'libelle', 'désignation', 'designation', 'description', 'produit'],
  pvente:    ['pvente', 'pv ', 'prix vente', 'prix de vente', 'selling price', 'vente'],
  ppro:      ['ppro', 'pprottc', 'ppro ttc', 'prix pro ttc', 'pro ttc'],
  ppro_htva: ['ppro htva', 'pprohtva', 'ppro_htva', 'prix pro htva', 'pro htva', 'ppht'],
  origine:   ['origine', 'origin', 'pays', 'country'],
  p_l:       ['p/l', 'p_l', 'prix/litre', 'prix litre', 'prix/l', 'pl'],
  pa_htva:   ['pa htva', 'pa_htva', 'prix achat', 'pa 2026', 'pa htva 2026'],
  taux_tva:  ['taux tva', 'taux_tva', 'tva', 'vat'],
  ean:       ['ean', 'barcode', 'code barre', 'code-barre'],
};

export const REQUIRED = ['article', 'pvente', 'ppro', 'ppro_htva'];

const synList = [];
for (const [key, syns] of Object.entries(SYNONYMS)) {
  for (const syn of syns) {
    synList.push({ name: syn, key });
  }
}

const fuse = new Fuse(synList, {
  keys: ['name'],
  threshold: 0.25,
  includeScore: true,
  ignoreLocation: true,
});

export function autoMap(headers) {
  const used = new Set();
  const mapping = Object.fromEntries(Object.keys(SYNONYMS).map(k => [k, null]));
  const headersLower = headers.map(h => (h || '').toLowerCase().trim());

  // Pass 1: exact + substring synonym match
  for (const [key, synonyms] of Object.entries(SYNONYMS)) {
    for (let i = 0; i < headersLower.length; i++) {
      if (used.has(headers[i])) continue;
      const hl = headersLower[i];
      if (synonyms.includes(hl) || synonyms.some(syn => hl.includes(syn))) {
        mapping[key] = headers[i];
        used.add(headers[i]);
        break;
      }
    }
  }

  // Pass 2: fuzzy fallback via Fuse.js
  for (const key of Object.keys(SYNONYMS)) {
    if (mapping[key] !== null) continue;
    for (let i = 0; i < headersLower.length; i++) {
      if (used.has(headers[i])) continue;
      const results = fuse.search(headersLower[i]);
      if (results.length > 0 && results[0].score < 0.25 && results[0].item.key === key) {
        mapping[key] = headers[i];
        used.add(headers[i]);
        break;
      }
    }
  }

  return mapping;
}

export function missingRequired(mapping) {
  return REQUIRED.filter(k => !mapping[k]);
}

export function applyMapping(mapping, rawRow) {
  const inv = {};
  for (const [k, v] of Object.entries(mapping)) {
    if (v !== null && v !== undefined) inv[v] = k;
  }
  const result = {};
  for (const [h, val] of Object.entries(rawRow)) {
    result[inv[h] || h] = val;
  }
  return result;
}
