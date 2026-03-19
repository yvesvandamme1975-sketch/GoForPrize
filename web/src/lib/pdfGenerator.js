/**
 * PDF generator: creates label PDFs and A4 PDFs for product pricing.
 * Uses pdf-lib. Ported from Python pdf_generator.py.
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { cleanArticle } from './textCleaner';
import { formatPrice } from './fileReader';

// 1mm in PDF points
const MM = 2.83465;

// Golden ratio
const RATIO = 1.61;

// Label font defaults
const F_PRO = 8;
const F_TITLE = 13;
const F_PRICE = 21;
const LABEL_MARGIN = 3 * MM;

// A4 landscape dimensions in points
const A4_WIDTH = 841.89;
const A4_HEIGHT = 595.28;
const A4_MARGIN = 15 * MM;
const A4_HEADER_SAFE = 90 * MM;

/**
 * Word-wrap text to fit within maxWidth using the given font/size.
 * Returns an array of lines.
 */
function wrapText(text, font, fontSize, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];

  const lines = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i];
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Generate a label PDF for a single product.
 *
 * @param {object} product - Product with article, pvente, ppro, ppro_htva fields
 * @param {object} sizeOpts - Label dimensions {width_mm, height_mm}
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function generateLabel(product, sizeOpts = { width_mm: 89, height_mm: 36 }) {
  // Landscape: 89mm wide × 36mm tall (matches Python pdf_generator.py)
  const width = sizeOpts.width_mm * MM;    // 89mm
  const height = sizeOpts.height_mm * MM;  // 36mm

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([width, height]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const article = cleanArticle(product.article || '');
  const price = formatPrice(product.pvente || 0);
  const ppro = formatPrice(product.ppro || 0);
  const pproHtva = formatPrice(product.ppro_htva || 0);

  // Article: bold, centred, 2-line word-wrap
  const maxTextWidth = width - 2 * LABEL_MARGIN;
  let articleFontSize = F_TITLE;
  let lines = wrapText(article, fontBold, articleFontSize, maxTextWidth);

  // Limit to 2 lines
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = lines[1] + '...';
  }

  const lineHeight = articleFontSize * 1.2;
  const articleBlockHeight = lines.length * lineHeight;
  const articleStartY = height - LABEL_MARGIN - articleFontSize;

  for (let i = 0; i < lines.length; i++) {
    const textWidth = fontBold.widthOfTextAtSize(lines[i], articleFontSize);
    const x = (width - textWidth) / 2;
    const y = articleStartY - i * lineHeight;
    page.drawText(lines[i], { x, y, size: articleFontSize, font: fontBold, color: rgb(0, 0, 0) });
  }

  // Pro prices: bottom-right, dark grey
  const proText = `PPHT ${pproHtva}  PPTTC ${ppro}`;
  const proFontSize = Math.max(F_PRO, 7);
  const proWidth = fontRegular.widthOfTextAtSize(proText, proFontSize);
  const proX = width - LABEL_MARGIN - proWidth;
  const proY = LABEL_MARGIN + 1;
  const grey = rgb(0x44 / 255, 0x44 / 255, 0x44 / 255);
  page.drawText(proText, { x: proX, y: proY, size: proFontSize, font: fontRegular, color: grey });

  // Price: bold, centred in the space BETWEEN article bottom and pro prices top
  const priceText = price + ' \u20AC';
  const articleBottom = articleStartY - articleBlockHeight;
  const proTop = proY + proFontSize + 2;
  const priceY = proTop + (articleBottom - proTop) / 2 - F_PRICE / 2;
  const priceWidth = fontBold.widthOfTextAtSize(priceText, F_PRICE);
  const priceX = (width - priceWidth) / 2;
  page.drawText(priceText, { x: priceX, y: Math.max(priceY, proTop), size: F_PRICE, font: fontBold, color: rgb(0, 0, 0) });

  return pdfDoc.save();
}

/**
 * Generate an A4 landscape PDF for a single product (text-only, pre-printed paper).
 *
 * @param {object} product - Product with article, pvente, ppro, ppro_htva, p_l, origine
 * @returns {Promise<Uint8Array>} PDF bytes
 */
export async function generateA4(product) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const article = cleanArticle(product.article || '');
  const price = formatPrice(product.pvente || 0);
  const ppro = formatPrice(product.ppro || 0);
  const pproHtva = formatPrice(product.ppro_htva || 0);
  const pl = product.p_l || '';
  const origine = product.origine || '';

  const black = rgb(0, 0, 0);
  const maxTextWidth = A4_WIDTH - 2 * A4_MARGIN;

  // Article: bold, just below 90mm safe zone, shrinks from 48pt to 20pt
  let articleFontSize = 48;
  let lines = wrapText(article, fontBold, articleFontSize, maxTextWidth);

  // Shrink until it fits in 2 lines (min 20pt)
  while (lines.length > 2 && articleFontSize > 20) {
    articleFontSize -= 2;
    lines = wrapText(article, fontBold, articleFontSize, maxTextWidth);
  }
  if (lines.length > 2) {
    lines = lines.slice(0, 2);
    lines[1] = lines[1] + '...';
  }

  const articleLineHeight = articleFontSize * 1.2;
  const articleStartY = A4_HEIGHT - A4_HEADER_SAFE - articleFontSize;

  for (let i = 0; i < lines.length; i++) {
    const textWidth = fontBold.widthOfTextAtSize(lines[i], articleFontSize);
    const x = (A4_WIDTH - textWidth) / 2;
    const y = articleStartY - i * articleLineHeight;
    page.drawText(lines[i], { x, y, size: articleFontSize, font: fontBold, color: black });
  }

  // Price: bold 96pt, centred at y=65mm from bottom
  const priceFontSize = 96;
  const priceText = price + ' \u20AC';
  const priceWidth = fontBold.widthOfTextAtSize(priceText, priceFontSize);
  const priceX = (A4_WIDTH - priceWidth) / 2;
  const priceY = 65 * MM;
  page.drawText(priceText, { x: priceX, y: priceY, size: priceFontSize, font: fontBold, color: black });

  // P/L: 18pt, bottom-left at y=margin+24mm
  if (pl) {
    const plFontSize = 18;
    const plY = A4_MARGIN + 24 * MM;
    page.drawText(String(pl), { x: A4_MARGIN, y: plY, size: plFontSize, font: fontRegular, color: black });
  }

  // Origine: 18pt, bottom-right at y=margin+24mm
  if (origine) {
    const origineFontSize = 18;
    const origineText = `Origine : ${origine}`;
    const origineWidth = fontRegular.widthOfTextAtSize(origineText, origineFontSize);
    const origineX = A4_WIDTH - A4_MARGIN - origineWidth;
    const origineY = A4_MARGIN + 24 * MM;
    page.drawText(origineText, { x: origineX, y: origineY, size: origineFontSize, font: fontRegular, color: black });
  }

  // Pro prices: 18pt, bottom-right at y=margin+10mm, black (pre-printed paper)
  const proFontSize = 18;
  const proText = `PPHT ${pproHtva}    PPTTC ${ppro}`;
  const proWidth = fontRegular.widthOfTextAtSize(proText, proFontSize);
  const proX = A4_WIDTH - A4_MARGIN - proWidth;
  const proY = A4_MARGIN + 10 * MM;
  page.drawText(proText, { x: proX, y: proY, size: proFontSize, font: fontRegular, color: black });

  return pdfDoc.save();
}

/**
 * Merge multiple PDF byte arrays into a single PDF.
 *
 * @param {Uint8Array[]} pdfBytesArray
 * @returns {Promise<Uint8Array>}
 */
export async function mergePdfs(pdfBytesArray) {
  const merged = await PDFDocument.create();
  for (const bytes of pdfBytesArray) {
    const donor = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(donor, donor.getPageIndices());
    for (const page of pages) {
      merged.addPage(page);
    }
  }
  return merged.save();
}

/**
 * Trigger a browser download for PDF bytes.
 *
 * @param {Uint8Array} bytes
 * @param {string} filename
 */
export function downloadPdf(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
