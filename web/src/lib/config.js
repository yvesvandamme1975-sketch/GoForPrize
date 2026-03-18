const STORAGE_PREFIX = 'gfp_';

const DEFAULTS = {
  printer_url: '',
  label_size: '89x36',
  last_mapping: null,
  selected_printer: '',
};

export const LABEL_SIZES = {
  '89x36':  { width_mm: 89,  height_mm: 36, label: '89mm × 36mm Dymo (défaut)' },
  '60x35':  { width_mm: 60,  height_mm: 35, label: '60mm × 35mm' },
  '50x30':  { width_mm: 50,  height_mm: 30, label: '50mm × 30mm' },
  '100x50': { width_mm: 100, height_mm: 50, label: '100mm × 50mm' },
  '75x50':  { width_mm: 75,  height_mm: 50, label: '75mm × 50mm' },
};

export function getConfig(key) {
  const stored = localStorage.getItem(STORAGE_PREFIX + key);
  if (stored !== null) {
    try { return JSON.parse(stored); } catch { return stored; }
  }
  return DEFAULTS[key] ?? null;
}

export function setConfig(key, value) {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
}

export function getLabelSizeInfo() {
  const key = getConfig('label_size') || '89x36';
  return LABEL_SIZES[key] || LABEL_SIZES['89x36'];
}
