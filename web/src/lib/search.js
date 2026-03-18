/**
 * Search products by article name.
 */
export function searchProducts(rows, query, suggestionLimit = 8) {
  if (!query || !query.trim()) return { suggestions: [], results: rows };
  const q = query.toLowerCase().trim();
  const results = rows.filter(r => (r.article || '').toLowerCase().includes(q));
  const suggestions = results.slice(0, suggestionLimit).map(r => r.article);
  return { suggestions, results };
}
