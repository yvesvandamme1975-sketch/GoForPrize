"""
text_cleaner.py
───────────────
Display-time text normalization for article names.
Raw data from Excel is NEVER modified — corrections are applied only when
rendering to the preview canvas or generating PDF output.

Two passes:
  1. Whitespace normalization — collapse multiple spaces, trim, and insert a
     space at letter→digit boundaries (e.g. "bouteille1x" → "bouteille 1x").
  2. Brand spell correction — regex word-boundary replacement for known
     misspellings of popular Belgian drink brands.
     Word boundaries prevent "red bul" from partially matching "red bull".
"""

import re

# ── Brand corrections ────────────────────────────────────────────────────────
# Key   : lowercase misspelling / common variant
# Value : canonical brand spelling
_CORRECTIONS = {
    # Red Bull
    "redbull":          "Red Bull",
    "red-bull":         "Red Bull",
    "red bul":          "Red Bull",
    "redbul":           "Red Bull",
    # Coca-Cola
    "cocacola":         "Coca-Cola",
    "coca cola":        "Coca-Cola",
    "coka cola":        "Coca-Cola",
    "coka-cola":        "Coca-Cola",
    # Pepsi
    "pepsy":            "Pepsi",
    # Fanta
    "phanta":           "Fanta",
    # Sprite
    "sprit":            "Sprite",
    # Monster Energy
    "monster energy":   "Monster Energy",
    "monsteur":         "Monster",
    # Heineken
    "heiniken":         "Heineken",
    "heinekin":         "Heineken",
    "heinekn":          "Heineken",
    "heinneken":        "Heineken",
    # Jupiler
    "jupiller":         "Jupiler",
    "jupilier":         "Jupiler",
    # Hoegaarden
    "hoegarden":        "Hoegaarden",
    # Stella Artois
    "stela artois":     "Stella Artois",
    "stella artoi":     "Stella Artois",
    # Duvel
    "duvell":           "Duvel",
    # Leffe
    "lefe":             "Leffe",
    "leff":             "Leffe",
    # Chimay
    "chimaye":          "Chimay",
    # Desperados
    "desperado":        "Desperados",
    # Kronenbourg
    "kronenburg":       "Kronenbourg",
    "kronenbug":        "Kronenbourg",
    # Corona
    "korona":           "Corona",
    # Budweiser
    "budweizer":        "Budweiser",
    "budwieser":        "Budweiser",
    # Schweppes
    "schwepps":         "Schweppes",
    "schweps":          "Schweppes",
    "shweppes":         "Schweppes",
    # Perrier
    "perier":           "Perrier",
    # Evian
    "evien":            "Evian",
    # San Pellegrino
    "san pellegrino":   "San Pellegrino",
    "san-pellegrino":   "San Pellegrino",
    # Lipton Ice Tea
    "lipton ice tea":   "Lipton Ice Tea",
    # Tropicana
    "tropicanna":       "Tropicana",
    # Minute Maid
    "minut maid":       "Minute Maid",
}

# Pre-compile regex patterns with word boundaries, longest pattern first
# (?<!\w)...\b ensures we don't partial-match "red bul" inside "red bull"
_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'(?<!\w)' + re.escape(wrong) + r'(?!\w)', re.IGNORECASE), right)
    for wrong, right in sorted(_CORRECTIONS.items(), key=lambda kv: len(kv[0]), reverse=True)
]


def clean_article(text: str) -> str:
    """
    Normalize and spell-correct an article name for display/print.
    Source data is never modified — call this only at render time.
    """
    if not text:
        return text

    # Pass 1: whitespace normalization
    text = text.strip()
    text = re.sub(r'\s+', ' ', text)                  # collapse runs of spaces
    text = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', text)  # letter→digit boundary

    # Pass 2: brand corrections
    for pattern, right in _PATTERNS:
        text = pattern.sub(right, text)

    return text
