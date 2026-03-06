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
        max_w = page_w - 2 * margin
        font_size = 32
        while (stringWidth(article, "Helvetica-Bold", font_size) > max_w
               and font_size > 14):
            font_size -= 1
        c.setFont("Helvetica-Bold", font_size)
        art_y = safe_top - 12 * mm           # baseline: 12 mm below safe line
        c.drawCentredString(page_w / 2, art_y, article)

        # ── Price ── large, centred in the safe zone ──────────────────
        c.setFont("Helvetica-Bold", 80)
        price_y = 55 * mm                     # 55 mm from bottom
        c.drawCentredString(page_w / 2, price_y, price_str)

        # ── P/L ── bottom-left ────────────────────────────────────────
        if p_l:
            c.setFont("Helvetica", 18)
            c.drawString(margin, margin + 14 * mm, f"P/L : {p_l}")

        # ── Origine ── bottom-right ───────────────────────────────────
        if origine:
            c.setFont("Helvetica", 18)
            c.drawRightString(page_w - margin, margin + 14 * mm,
                              f"Origine : {origine}")

        # ── Pro prices ── bottom-right, small ─────────────────────────
        c.setFont("Helvetica", 13)
        c.drawRightString(page_w - margin, margin,
                          f"PPHT {ppht_str}    PPTTC {ppttc_str}")

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

        # ── Logo (top-left, small) ──────────────────────────────────
        logo_h_pt = 10 * mm
        logo_w_pt = 15 * mm
        if logo_path and os.path.exists(logo_path):
            from PIL import Image
            pil_img = Image.open(logo_path)
            pil_img.thumbnail((120, 90), Image.LANCZOS)
            buf = io.BytesIO()
            pil_img.save(buf, format="PNG")
            buf.seek(0)
            c.drawImage(ImageReader(buf),
                        page_w - margin - logo_w_pt,
                        page_h - margin - logo_h_pt,
                        width=logo_w_pt, height=logo_h_pt,
                        preserveAspectRatio=True, mask="auto")

        # ── Article title — top-left, bold, up to 2 lines ──────────
        max_text_w = page_w - 2 * margin
        c.setFont("Helvetica-Bold", f_title)
        c.setFillColor(colors.black)

        full_w = stringWidth(article, "Helvetica-Bold", f_title)
        if full_w <= max_text_w:
            # single line
            c.drawString(margin, page_h - margin - f_title, article)
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
            c.drawString(margin, page_h - margin - f_title,           line1)
            c.drawString(margin, page_h - margin - f_title - line_gap, line2)

        # ── Price — centred vertically and horizontally ─────────────
        c.setFont("Helvetica-Bold", f_price)
        c.drawCentredString(page_w / 2, page_h / 2 - f_price / 2, price_str)

        # ── Pro prices — bottom-left, no € ──────────────────────────
        c.setFont("Helvetica", f_pro)
        c.setFillColor(colors.HexColor("#444444"))
        c.drawString(margin, margin, pro_str)

        c.save()
        return output_path
