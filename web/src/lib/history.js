const STORAGE_KEY = 'gfp_history';
export const MAX_ENTRIES = 100;
const KEEP_KEYS = ['article', 'pvente', 'ppro', 'ppro_htva', 'origine', 'p_l'];

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function save(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function addHistory(product, fmt) {
  const entry = {};
  for (const k of KEEP_KEYS) entry[k] = product[k] ?? null;
  entry.format = fmt;
  entry.timestamp = new Date().toLocaleString('fr-BE', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
  const entries = [entry, ...load()].slice(0, MAX_ENTRIES);
  save(entries);
  return entries;
}

export function getHistory() {
  return load();
}
