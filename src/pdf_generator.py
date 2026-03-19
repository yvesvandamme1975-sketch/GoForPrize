import io, os
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from src.text_cleaner import clean_article

PAGE_W, PAGE_H = landscape(A4)
MARGIN = 15 * mm


class PdfGenerator:
    # Height of the pre-printed header zone (logo + red band) from the top of the page.
    # Text must stay below this line.
    A4_HEADER_MM = 90

    @staticmethod
    def generate_a4(product: dict, output_path: str,
                    logo_path=None) -> str:
        """Generate a text-only A4 PDF.

        The physical paper already has the colour layout pre-printed (logo,
        red band, yellow background).  Only black text is written so it
        overlays cleanly on the pre-printed sheet.
        All text is placed below the 90 mm header zone.
        """
        article   = clean_article(str(product.get("article", "")).strip())
        pvente    = float(product.get("pvente",    0))
        ppro      = float(product.get("ppro",      0))
        ppro_htva = float(product.get("ppro_htva", 0))
        origine   = str(product.get("origine", "")).strip()
        p_l       = str(product.get("p_l", "")).strip()

        price_str = f"{pvente:.2f}".replace(".", ",") + "\u20ac"
        ppht_str  = f"{ppro_htva:.2f}".replace(".", ",")
        ppttc_str = f"{ppro:.2f}".replace(".", ",")

        page_w, page_h = landscape(A4)   # 841.89 × 595.28 pt  (297 × 210 mm)
        header    = PdfGenerator.A4_HEADER_MM * mm   # 90 mm in points
        margin    = 15 * mm
        safe_top  = page_h - header           # top of text-safe zone (from bottom)

        c = rl_canvas.Canvas(output_path, pagesize=landscape(A4))
        c.setFillColor(colors.black)          # all text is black — layout is pre-printed

        # ── Article name ── just below the header line, centred ──────
        max_w     = page_w - 2 * margin
        font_size = 48                        # 46 × 1.05
        line_gap  = font_size * 1.2           # leading

        if stringWidth(article, "Helvetica-Bold", font_size) <= max_w:
            # Single line fits
            c.setFont("Helvetica-Bold", font_size)
            c.drawCentredString(page_w / 2, safe_top - 2 * mm, article)
        else:
            # Try to wrap into 2 lines at target font; shrink if needed
            while font_size > 20:
                words  = article.split()
                line1  = ""
                for word in words:
                    test = (line1 + " " + word).strip()
                    if stringWidth(test, "Helvetica-Bold", font_size) <= max_w:
                        line1 = test
                    else:
                        break
                line2 = article[len(line1):].strip()
                if (line1 and
                        stringWidth(line1, "Helvetica-Bold", font_size) <= max_w and
                        stringWidth(line2, "Helvetica-Bold", font_size) <= max_w):
                    break
                font_size -= 1
            line_gap = font_size * 1.2
            words  = article.split()
            line1  = ""
            for word in words:
                test = (line1 + " " + word).strip()
                if stringWidth(test, "Helvetica-Bold", font_size) <= max_w:
                    line1 = test
                else:
                    break
            line2 = article[len(line1):].strip()
            c.setFont("Helvetica-Bold", font_size)
            c.drawCentredString(page_w / 2, safe_top - 2 * mm,            line1)
            c.drawCentredString(page_w / 2, safe_top - 2 * mm - line_gap, line2)

        # ── Price ── large, centred in the safe zone ──────────────────
        c.setFont("Helvetica-Bold", 96)      # 80 × 1.2
        price_y = 65 * mm                     # +10 mm (1 cm up)
        c.drawCentredString(page_w / 2, price_y, price_str)

        # ── Price per litre ── bottom-left ───────────────────────────
        if p_l:
            c.setFont("Helvetica", 18)
            c.drawString(margin, margin + 24 * mm, p_l)   # +10 mm

        # ── Origine ── bottom-right ───────────────────────────────────
        if origine:
            c.setFont("Helvetica", 18)
            c.drawRightString(page_w - margin, margin + 24 * mm,
                              f"Origine : {origine}")      # +10 mm

        # ── Pro prices ── bottom-right, same size as Origine ─────────
        c.setFont("Helvetica", 18)
        c.drawRightString(page_w - margin, margin + 10 * mm,
                          f"PPHT {ppht_str}    PPTTC {ppttc_str}")  # +10 mm

        c.save()
        return output_path

    @staticmethod
    def generate_label(product: dict, output_path: str,
                       logo_path, width_mm: float = 89,
                       height_mm: float = 36) -> str:
        """Generate a label-sized PDF for Dymo LabelWriter 550."""
        article   = clean_article(str(product.get("article", "")).strip())
        pvente    = float(product.get("pvente",    0))
        ppro      = float(product.get("ppro",      0))
        ppro_htva = float(product.get("ppro_htva", 0))

        price_str = f"{pvente:.2f}".replace(".", ",") + "\u20ac"
        ppht_str  = f"{ppro_htva:.2f}".replace(".", ",")
        ppttc_str = f"{ppro:.2f}".replace(".", ",")
        pro_str   = f"PPHT {ppht_str}   PPTTC {ppttc_str}"

        page_w = width_mm  * mm
        page_h = height_mm * mm
        margin = 3 * mm

        # Golden-ratio font stack (8 → 13 → 21 pt)
        RATIO   = 1.61
        f_pro   = 8
        f_title = round(f_pro   * RATIO)   # 13
        f_price = round(f_title * RATIO)   # 21

        c = rl_canvas.Canvas(output_path, pagesize=(page_w, page_h))

        # ── Article title — top-left, bold, up to 2 lines ──────────
        max_text_w = page_w - 2 * margin
        c.setFont("Helvetica-Bold", f_title)
        c.setFillColor(colors.black)

        full_w = stringWidth(article, "Helvetica-Bold", f_title)
        cx = page_w / 2
        if full_w <= max_text_w:
            # single line — centred
            c.drawCentredString(cx, page_h - margin - f_title, article)
            article_bottom = page_h - margin - f_title - f_title * 0.3
        else:
            # wrap to 2 lines at last space that fits
            words  = article.split()
            line1  = ""
            for word in words:
                test = (line1 + " " + word).strip()
                if stringWidth(test, "Helvetica-Bold", f_title) <= max_text_w:
                    line1 = test
                else:
                    break
            line2 = article[len(line1):].strip()
            line_gap = f_title + 2
            c.drawCentredString(cx, page_h - margin - f_title,           line1)
            c.drawCentredString(cx, page_h - margin - f_title - line_gap, line2)
            article_bottom = page_h - margin - f_title - line_gap - f_title * 0.3

        # ── Pro prices — bottom-right, no € ─────────────────────────
        c.setFont("Helvetica", f_pro)
        c.setFillColor(colors.HexColor("#444444"))
        c.drawRightString(page_w - margin, margin, pro_str)
        pro_top = margin + f_pro + 2

        # ── Price — centred in space between article and pro prices ──
        c.setFont("Helvetica-Bold", f_price)
        c.setFillColor(colors.black)
        price_y = pro_top + (article_bottom - pro_top) / 2 - f_price / 2
        c.drawCentredString(page_w / 2, max(price_y, pro_top), price_str)

        c.save()
        return output_path
