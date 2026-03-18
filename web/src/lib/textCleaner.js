/**
 * Text cleaner: normalises whitespace, inserts spaces at letter→digit
 * boundaries, and corrects common brand-name misspellings.
 *
 * Ported from Python text_cleaner.py
 */

const CORRECTIONS = {
  'redbull': 'Red Bull',
  'red-bull': 'Red Bull',
  'red bul': 'Red Bull',
  'redbul': 'Red Bull',
  'cocacola': 'Coca-Cola',
  'coca cola': 'Coca-Cola',
  'coka cola': 'Coca-Cola',
  'coka-cola': 'Coca-Cola',
  'pepsy': 'Pepsi',
  'phanta': 'Fanta',
  'sprit': 'Sprite',
  'monster energy': 'Monster Energy',
  'monsteur': 'Monster',
  'heiniken': 'Heineken',
  'heinekin': 'Heineken',
  'heinekn': 'Heineken',
  'heinneken': 'Heineken',
  'jupiller': 'Jupiler',
  'jupilier': 'Jupiler',
  'hoegarden': 'Hoegaarden',
  'stela artois': 'Stella Artois',
  'stella artoi': 'Stella Artois',
  'duvell': 'Duvel',
  'lefe': 'Leffe',
  'leff': 'Leffe',
  'chimaye': 'Chimay',
  'desperado': 'Desperados',
  'kronenburg': 'Kronenbourg',
  'kronenbug': 'Kronenbourg',
  'korona': 'Corona',
  'budweizer': 'Budweiser',
  'budwieser': 'Budweiser',
  'schwepps': 'Schweppes',
  'schweps': 'Schweppes',
  'shweppes': 'Schweppes',
  'perier': 'Perrier',
  'evien': 'Evian',
  'san pellegrino': 'San Pellegrino',
  'san-pellegrino': 'San Pellegrino',
  'lipton ice tea': 'Lipton Ice Tea',
  'tropicanna': 'Tropicana',
  'minut maid': 'Minute Maid',
};

// Build regex patterns sorted longest-first so multi-word keys match before
// shorter substrings.  Each pattern uses word boundaries and is case-insensitive.
const patterns = Object.keys(CORRECTIONS)
  .sort((a, b) => b.length - a.length)
  .map((key) => ({
    regex: new RegExp(`\\b${key.replace(/-/g, '\\-')}\\b`, 'gi'),
    replacement: CORRECTIONS[key],
  }));

/**
 * Clean an article description:
 *  1. Trim, collapse whitespace, insert space at letter→digit boundary
 *  2. Apply brand-name corrections (case-insensitive)
 *
 * @param {string|null|undefined} text
 * @returns {string}
 */
export function cleanArticle(text) {
  if (!text) return '';

  // Pass 1: trim + collapse whitespace + letter→digit boundary
  let result = text.trim().replace(/\s+/g, ' ').replace(/([a-zA-Z])(\d)/g, '$1 $2');

  // Pass 2: brand corrections
  for (const { regex, replacement } of patterns) {
    result = result.replace(regex, replacement);
  }

  return result;
}
