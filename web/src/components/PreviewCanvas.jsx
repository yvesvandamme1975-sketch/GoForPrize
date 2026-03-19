import { useRef, useEffect } from 'react';
import { formatPrice } from '../lib/fileReader';
import { cleanArticle } from '../lib/textCleaner';
import { getLabelSizeInfo } from '../lib/config';

const CANVAS_W = 500;
const CANVAS_H = 360;

function wrapText(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = current + ' ' + words[i];
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function drawLabel(ctx, product, sizeInfo) {
  // Match desktop: DW=460 fixed, card height from aspect ratio, fonts from pixel height
  const DW = 460;
  const lh = Math.round(DW * sizeInfo.height_mm / sizeInfo.width_mm);
  const x0 = (CANVAS_W - DW) / 2;
  const y0 = Math.max(16, (CANVAS_H - lh) / 2);

  const RATIO = 1.61;
  const m = Math.round(lh * 0.10);
  const fPro = Math.max(9, Math.round(lh * 0.085));
  const fTitle = Math.round(fPro * RATIO);
  const fPrice = Math.round(fTitle * RATIO);

  // Shadow + card
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x0, y0, DW, lh);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = '#BBBBBB';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, DW, lh);

  if (!product) return;

  const article = cleanArticle(product.article || '');
  const priceText = formatPrice(product.pvente || 0) + '\u20AC';
  const proText = `PPHT ${formatPrice(product.ppro_htva || 0)}   PPTTC ${formatPrice(product.ppro || 0)}`;

  // Article — top, bold, centred, up to 2 lines
  ctx.fillStyle = '#000';
  ctx.font = `bold ${fTitle}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let lines = wrapText(ctx, article, DW - 2 * m);
  if (lines.length > 2) lines = [lines[0], lines[1] + '...'];
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x0 + DW / 2, y0 + m + i * (fTitle + 2));
  }

  // Price — centred vertically
  ctx.font = `bold ${fPrice}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.fillText(priceText, x0 + DW / 2, y0 + lh / 2);

  // Pro prices — bottom-right, grey
  ctx.fillStyle = '#444444';
  ctx.font = `${fPro}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(proText, x0 + DW - m, y0 + lh - m);

  // Reset
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

function drawA4(ctx, product, bgImage) {
  // Match desktop: DW=460, ah from aspect ratio, fonts from pixel height
  const DW = 460;
  const ah = Math.round(DW * 210 / 297);
  const x0 = (CANVAS_W - DW) / 2;
  const y0 = Math.max(8, (CANVAS_H - ah) / 2);

  const RATIO = 1.61;
  const m = Math.round(ah * 0.06);
  const fPro = Math.max(9, Math.round(ah * 0.04));
  const fTitle = Math.round(fPro * RATIO * 1.2);
  const fPrice = Math.round(fPro * RATIO * RATIO);

  // Shadow + card
  ctx.shadowColor = 'rgba(0,0,0,0.15)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(x0, y0, DW, ah);
  ctx.shadowColor = 'transparent';

  // Background image
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    ctx.drawImage(bgImage, x0, y0, DW, ah);
  }

  ctx.strokeStyle = '#BBBBBB';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, DW, ah);

  if (!product) return;

  const article = cleanArticle(product.article || '');
  const priceText = formatPrice(product.pvente || 0) + '\u20AC';
  const pl = product.p_l || '';
  const origine = product.origine || '';
  const proText = `PPHT ${formatPrice(product.ppro_htva || 0)}   PPTTC ${formatPrice(product.ppro || 0)}`;

  // Safe-zone geometry (header = 90/210 of page)
  const HEADER_FRAC = 90 / 210;
  const headerPx = Math.round(ah * HEADER_FRAC);
  const safeTop = y0 + headerPx;
  const safeH = ah - headerPx;

  // Article — just below header, centred, up to 2 lines
  ctx.fillStyle = '#000';
  ctx.font = `bold ${fTitle}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  let lines = wrapText(ctx, article, DW - 2 * m);
  if (lines.length > 2) lines = [lines[0], lines[1] + '...'];
  const artY = safeTop + Math.round(safeH * 0.02);
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x0 + DW / 2, artY + i * (fTitle + 2));
  }
  const artBottom = artY + lines.length * (fTitle + 2);

  // Price — centred between article bottom and pro prices area
  ctx.font = `bold ${fPrice}px Arial, Helvetica, sans-serif`;
  ctx.textBaseline = 'middle';
  const proArea = safeTop + Math.round(safeH * 0.72);
  const priceY = artBottom + (proArea - artBottom) / 2;
  ctx.fillText(priceText, x0 + DW / 2, priceY);

  // P/L — bottom-left
  if (pl) {
    ctx.font = `${fPro}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'left';
    ctx.fillText(String(pl), x0 + m, safeTop + Math.round(safeH * 0.72));
  }

  // Origine — bottom-right
  if (origine) {
    ctx.font = `${fPro}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText(`Origine : ${origine}`, x0 + DW - m, safeTop + Math.round(safeH * 0.72));
  }

  // Pro prices — bottom-right, grey
  ctx.fillStyle = '#444444';
  ctx.font = `${fPro}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillText(proText, x0 + DW - m, safeTop + Math.round(safeH * 0.85));

  // Reset
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

export default function PreviewCanvas({ product, format, bgImage }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Fill bg
    ctx.fillStyle = '#EDEEF0';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    if (format === 'label') {
      drawLabel(ctx, product, getLabelSizeInfo());
    } else {
      drawA4(ctx, product, bgImage);
    }
  }, [product, format, bgImage]);

  return (
    <div className="flex justify-center px-4">
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="rounded-lg"
        style={{ maxWidth: '100%', height: 'auto' }}
      />
    </div>
  );
}
